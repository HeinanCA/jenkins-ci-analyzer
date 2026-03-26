import type { Task } from "graphile-worker";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../db/connection";
import { ciInstances, jobs, builds, buildAnalyses } from "../db/schema";
import {
  decryptCredentials,
  type EncryptedCredentials,
} from "../services/credential-vault";
import { jenkinsGet } from "../services/jenkins-client";
import Bottleneck from "bottleneck";

interface JenkinsBuildEntry {
  readonly number: number;
  readonly result: string | null;
  readonly timestamp: number;
  readonly duration: number;
  readonly estimatedDuration: number;
}

interface JenkinsBuildHistoryResponse {
  readonly builds: readonly JenkinsBuildEntry[];
}

function jobPathToJenkinsUrl(baseUrl: string, fullPath: string): string {
  const segments = fullPath.split("/");
  const jenkinsPath = segments
    .map((s) => `job/${encodeURIComponent(s)}`)
    .join("/");
  return `${baseUrl}/${jenkinsPath}`;
}

export const syncBuilds: Task = async (payload, helpers) => {
  const { instanceId, organizationId } = payload as {
    instanceId: string;
    organizationId: string;
  };

  if (!organizationId) {
    helpers.logger.error(
      `sync_builds for instance ${instanceId} missing organizationId — aborting`,
    );
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

  const credentials = decryptCredentials(
    instance.credentials as EncryptedCredentials,
  );

  const activeJobs = await db
    .select({ id: jobs.id, fullPath: jobs.fullPath })
    .from(jobs)
    .where(and(eq(jobs.ciInstanceId, instanceId), eq(jobs.isActive, true)));

  if (activeJobs.length === 0) {
    helpers.logger.info(`No active jobs for instance ${instanceId}`);
    return;
  }

  const limiter = new Bottleneck({
    maxConcurrent: 5,
    minTime: 100,
  });

  let synced = 0;
  let failed = 0;

  for (const job of activeJobs) {
    try {
      const jobUrl = jobPathToJenkinsUrl(instance.baseUrl, job.fullPath);
      const url = `${jobUrl}/api/json?tree=builds[number,result,timestamp,duration,estimatedDuration]{0,10}`;

      const data = await limiter.schedule(() =>
        jenkinsGet<JenkinsBuildHistoryResponse>(url, credentials),
      );

      if (!data.builds || data.builds.length === 0) continue;

      for (const build of data.builds) {
        await db
          .insert(builds)
          .values({
            organizationId,
            jobId: job.id,
            buildNumber: build.number,
            result: build.result,
            startedAt: new Date(build.timestamp),
            durationMs: build.duration,
            estimatedDurationMs: build.estimatedDuration,
          })
          .onConflictDoUpdate({
            target: [builds.jobId, builds.buildNumber],
            set: {
              result: build.result,
              durationMs: build.duration,
            },
          });
      }

      synced++;
    } catch {
      failed++;
    }
  }

  helpers.logger.info(
    `Build sync for instance ${instanceId}: ${synced} jobs synced, ${failed} failed`,
  );

  // Enqueue analysis for failed builds that haven't been analyzed yet
  const unanalyzedFailures = await db
    .select({ id: builds.id })
    .from(builds)
    .leftJoin(buildAnalyses, eq(buildAnalyses.buildId, builds.id))
    .innerJoin(jobs, eq(jobs.id, builds.jobId))
    .where(
      and(
        eq(jobs.ciInstanceId, instanceId),
        sql`${builds.result} IN ('FAILURE', 'UNSTABLE')`,
        sql`${buildAnalyses.id} IS NULL`,
      ),
    )
    .limit(20);

  for (const build of unanalyzedFailures) {
    await helpers.addJob(
      "analyze_build",
      { buildId: build.id, instanceId, organizationId },
      { jobKey: `analyze:${build.id}`, jobKeyMode: "preserve_run_at" },
    );
  }

  if (unanalyzedFailures.length > 0) {
    helpers.logger.info(
      `Queued ${unanalyzedFailures.length} builds for analysis`,
    );
  }
};
