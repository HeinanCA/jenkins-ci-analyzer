import type { Task } from 'graphile-worker';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection';
import { ciInstances } from '../db/schema';

export const scheduleCrawls: Task = async (_payload, helpers) => {
  const activeInstances = await db
    .select({ id: ciInstances.id, name: ciInstances.name })
    .from(ciInstances)
    .where(eq(ciInstances.isActive, true));

  for (const instance of activeInstances) {
    await helpers.addJob('crawl_instance', { instanceId: instance.id }, {
      jobKey: `crawl:${instance.id}`,
      jobKeyMode: 'replace',
    });
  }

  if (activeInstances.length > 0) {
    helpers.logger.info(
      `Scheduled crawls for ${activeInstances.length} instance(s)`,
    );
  }
};
