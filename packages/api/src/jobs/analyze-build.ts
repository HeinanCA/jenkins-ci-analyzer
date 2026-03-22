import type { Task } from 'graphile-worker';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection';
import { builds, jobs, ciInstances, buildAnalyses } from '../db/schema';
import {
  decryptCredentials,
  type EncryptedCredentials,
} from '../services/credential-vault';
import { jenkinsGetText } from '../services/jenkins-client';
import { analyzeLog, classifyFailure, FAILURE_PATTERNS } from '@tig/shared';

function jobPathToConsoleUrl(baseUrl: string, fullPath: string, buildNumber: number): string {
  const segments = fullPath.split('/');
  const jenkinsPath = segments
    .map((s) => `job/${encodeURIComponent(s)}`)
    .join('/');
  return `${baseUrl}/${jenkinsPath}/${buildNumber}/consoleText`;
}

export const analyzeBuild: Task = async (payload, helpers) => {
  const { buildId, instanceId } = payload as {
    buildId: string;
    instanceId: string;
  };

  // Check if already analyzed
  const [existing] = await db
    .select({ id: buildAnalyses.id })
    .from(buildAnalyses)
    .where(eq(buildAnalyses.buildId, buildId))
    .limit(1);

  if (existing) {
    helpers.logger.info(`Build ${buildId} already analyzed, skipping`);
    return;
  }

  // Get build + job + instance info
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
    .select({ fullPath: jobs.fullPath, ciInstanceId: jobs.ciInstanceId })
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

  // Fetch log from Jenkins
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
      `Failed to fetch log for build ${buildId}: ${error instanceof Error ? error.message : 'unknown'}`,
    );
    return;
  }

  // Run pattern matcher + classifier from @tig/shared
  const matches = analyzeLog(log, FAILURE_PATTERNS);
  const classification = classifyFailure(matches);

  // Store analysis
  await db.insert(buildAnalyses).values({
    buildId,
    classification: classification.classification,
    confidence: classification.confidence,
    matches: matches.map((m) => ({
      patternId: m.pattern.id,
      patternName: m.pattern.name,
      category: m.pattern.category,
      severity: m.pattern.severity,
      matchedLine: m.matchedLine,
      lineNumber: m.lineNumber,
      confidence: m.confidence,
      description: m.pattern.description,
      remediationSteps: m.pattern.remediationSteps,
    })),
    aiSkippedReason: classification.confidence >= 0.7
      ? 'high_confidence_match'
      : null,
  });

  // Update build log_fetched flag
  await db
    .update(builds)
    .set({ logFetched: true, logSizeBytes: log.length })
    .where(eq(builds.id, buildId));

  helpers.logger.info(
    `Analyzed build ${buildId}: ${classification.classification} (${Math.round(classification.confidence * 100)}% confidence, ${matches.length} pattern(s) matched)`,
  );
};
