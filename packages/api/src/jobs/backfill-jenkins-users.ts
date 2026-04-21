/**
 * Graphile-worker task: backfill-jenkins-users
 *
 * Walks all builds with a non-null triggered_by for a given CI instance
 * and populates the jenkins_users cache. Idempotent — re-running just
 * refreshes fetched_at timestamps.
 */
import type { Task } from "graphile-worker";
import { eq, and, isNotNull } from "drizzle-orm";
import { db } from "../db/connection";
import { ciInstances, jobs, builds } from "../db/schema";
import {
  decryptCredentials,
  type EncryptedCredentials,
} from "../services/credential-vault";
import {
  isCacheFresh,
  fetchAndCacheUser,
} from "../services/jenkins-user-cache";
import Bottleneck from "bottleneck";

interface BackfillPayload {
  readonly instanceId: string;
  readonly organizationId: string;
}

export const backfillJenkinsUsers: Task = async (payload, helpers) => {
  const { instanceId, organizationId } = payload as BackfillPayload;

  if (!organizationId) {
    helpers.logger.error(
      `backfill_jenkins_users for instance ${instanceId} missing organizationId — aborting`,
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
    helpers.logger.error(
      `backfill_jenkins_users: instance ${instanceId} not found`,
    );
    return;
  }

  const credentials = decryptCredentials(
    instance.credentials as EncryptedCredentials,
  );

  // Fetch distinct triggered_by users across all builds for this instance
  const distinctUsers = await db
    .selectDistinct({ triggeredBy: builds.triggeredBy })
    .from(builds)
    .innerJoin(jobs, eq(jobs.id, builds.jobId))
    .where(
      and(eq(jobs.ciInstanceId, instanceId), isNotNull(builds.triggeredBy)),
    );

  if (distinctUsers.length === 0) {
    helpers.logger.info(
      `backfill_jenkins_users: no triggered_by users found for instance ${instanceId}`,
    );
    return;
  }

  const limiter = new Bottleneck({
    maxConcurrent: 3,
    minTime: 200,
  });

  let cached = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of distinctUsers) {
    const userId = row.triggeredBy;
    if (!userId) continue;

    try {
      const fresh = await isCacheFresh(db, instanceId, userId);
      if (fresh) {
        skipped++;
        continue;
      }

      await limiter.schedule(() =>
        fetchAndCacheUser(
          {
            db,
            baseUrl: instance.baseUrl,
            credentials,
            ciInstanceId: instanceId,
            organizationId,
            logger: helpers.logger,
          },
          userId,
        ),
      );
      cached++;
    } catch {
      helpers.logger.warn(
        `backfill_jenkins_users: failed to cache user "${userId}" — skipping`,
      );
      failed++;
    }
  }

  helpers.logger.info(
    `backfill_jenkins_users for instance ${instanceId}: ${cached} cached, ${skipped} skipped (fresh), ${failed} failed out of ${distinctUsers.length} users`,
  );
};
