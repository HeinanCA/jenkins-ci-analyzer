import type { Task } from "graphile-worker";
import { eq } from "drizzle-orm";
import { db } from "../db/connection";
import { builds, jobs, ciInstances, buildAnalyses } from "../db/schema";
import {
  decryptCredentials,
  type EncryptedCredentials,
} from "../services/credential-vault";
import { jenkinsGetText } from "../services/jenkins-client";
import { analyzeLog, classifyFailure, FAILURE_PATTERNS } from "@tig/shared";
import { analyzeWithAi } from "../services/ai-analyzer";

function jobPathToConsoleUrl(
  baseUrl: string,
  fullPath: string,
  buildNumber: number,
): string {
  const segments = fullPath.split("/");
  const jenkinsPath = segments
    .map((s) => `job/${encodeURIComponent(s)}`)
    .join("/");
  return `${baseUrl}/${jenkinsPath}/${buildNumber}/consoleText`;
}

export const analyzeBuild: Task = async (payload, helpers) => {
  const { buildId, instanceId } = payload as {
    buildId: string;
    instanceId: string;
  };

  const [existing] = await db
    .select({ id: buildAnalyses.id })
    .from(buildAnalyses)
    .where(eq(buildAnalyses.buildId, buildId))
    .limit(1);

  if (existing) {
    helpers.logger.info(`Build ${buildId} already analyzed, skipping`);
    return;
  }

  const [build] = await db
    .select({
      id: builds.id,
      buildNumber: builds.buildNumber,
      jobId: builds.jobId,
    })
    .from(builds)
    .where(eq(builds.id, buildId))
    .limit(1);

  if (!build) {
    helpers.logger.error(`Build ${buildId} not found`);
    return;
  }

  const [job] = await db
    .select({
      fullPath: jobs.fullPath,
      name: jobs.name,
      ciInstanceId: jobs.ciInstanceId,
    })
    .from(jobs)
    .where(eq(jobs.id, build.jobId))
    .limit(1);

  if (!job) {
    helpers.logger.error(`Job ${build.jobId} not found`);
    return;
  }

  const [instance] = await db
    .select({
      baseUrl: ciInstances.baseUrl,
      credentials: ciInstances.credentials,
    })
    .from(ciInstances)
    .where(eq(ciInstances.id, instanceId))
    .limit(1);

  if (!instance) {
    helpers.logger.error(`Instance ${instanceId} not found`);
    return;
  }

  // Fetch log
  const credentials = decryptCredentials(
    instance.credentials as EncryptedCredentials,
  );
  const logUrl = jobPathToConsoleUrl(
    instance.baseUrl,
    job.fullPath,
    build.buildNumber,
  );

  let log: string;
  try {
    log = await jenkinsGetText(logUrl, credentials);
  } catch (error) {
    helpers.logger.error(
      `Failed to fetch log for build ${buildId}: ${error instanceof Error ? error.message : "unknown"}`,
    );
    return;
  }

  // Layer 1: Fast regex classification
  const matches = analyzeLog(log, FAILURE_PATTERNS);
  const regexClassification = classifyFailure(matches);

  // Layer 2: AI analysis — the real intelligence
  const aiResponse = await analyzeWithAi(
    log,
    job.fullPath,
    build.buildNumber,
    regexClassification.classification,
  );

  const aiResult = aiResponse.result;
  const aiUsage = aiResponse.usage;

  // Store combined result
  const classification =
    aiResult?.classification ?? regexClassification.classification;
  const confidence = aiResult?.confidence ?? regexClassification.confidence;

  await db.insert(buildAnalyses).values({
    buildId,
    classification,
    confidence,
    matches: matches.map((m) => ({
      patternId: m.pattern.id,
      patternName: m.pattern.name,
      category: m.pattern.category,
      severity: m.pattern.severity,
      matchedLine: m.matchedLine,
      lineNumber: m.lineNumber,
      confidence: m.confidence,
      context: m.context,
    })),
    aiSummary: aiResult?.summary ?? null,
    aiRootCause: aiResult?.rootCause ?? null,
    aiSuggestedFixes: aiResult
      ? {
          fixes: aiResult.suggestedFixes,
          failingTest: aiResult.failingTest,
          assertion: aiResult.assertion,
          filePath: aiResult.filePath,
          lineNumber: aiResult.lineNumber,
          exceptionType: aiResult.exceptionType,
          stackTrace: aiResult.stackTrace,
        }
      : null,
    aiSkippedReason: aiResult ? null : "disabled",
    aiInputTokens: aiUsage?.inputTokens ?? null,
    aiOutputTokens: aiUsage?.outputTokens ?? null,
    aiCostUsd: aiUsage?.costUsd ?? null,
  });

  await db
    .update(builds)
    .set({ logFetched: true, logSizeBytes: log.length })
    .where(eq(builds.id, buildId));

  if (aiResult && aiUsage) {
    helpers.logger.info(
      `Analyzed build ${buildId} [AI]: ${aiResult.summary} ($${aiUsage.costUsd.toFixed(4)})`,
    );
  } else {
    helpers.logger.info(
      `Analyzed build ${buildId} [regex-only]: ${regexClassification.classification} (${Math.round(regexClassification.confidence * 100)}%)`,
    );
  }
};
