import type { Task } from 'graphile-worker';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection';
import { ciInstances, jobs } from '../db/schema';
import {
  decryptCredentials,
  type EncryptedCredentials,
} from '../services/credential-vault';
import {
  crawlJenkinsInstance,
  type CrawlConfig,
} from '../services/jenkins-crawler';

export const crawlInstance: Task = async (payload, helpers) => {
  const { instanceId } = payload as { instanceId: string };

  helpers.logger.info(`Starting crawl for instance ${instanceId}`);

  const [instance] = await db
    .select({
      id: ciInstances.id,
      baseUrl: ciInstances.baseUrl,
      credentials: ciInstances.credentials,
      crawlConfig: ciInstances.crawlConfig,
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
  const crawlConfig = instance.crawlConfig as CrawlConfig;

  const discovered = await crawlJenkinsInstance(
    instance.baseUrl,
    credentials,
    crawlConfig,
  );

  helpers.logger.info(
    `Discovered ${discovered.length} jobs for instance ${instanceId}`,
  );

  // Upsert discovered jobs
  for (const job of discovered) {
    await db
      .insert(jobs)
      .values({
        ciInstanceId: instanceId,
        fullPath: job.fullPath,
        name: job.name,
        url: job.url,
        jobClass: job.jobClass,
        color: job.color,
        healthScore: job.healthScore ?? null,
        lastSeenAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [jobs.ciInstanceId, jobs.fullPath],
        set: {
          color: job.color,
          healthScore: job.healthScore ?? null,
          lastSeenAt: new Date(),
          isActive: true,
        },
      });
  }

  // Mark jobs not seen in this crawl as inactive
  // (jobs whose lastSeenAt is before this crawl started)
  const crawlStartTime = new Date();
  await db
    .update(ciInstances)
    .set({ lastCrawlAt: crawlStartTime })
    .where(eq(ciInstances.id, instanceId));

  helpers.logger.info(
    `Crawl complete for instance ${instanceId}: ${discovered.length} jobs synced`,
  );
};
