import { run, type TaskList } from 'graphile-worker';
import { crawlInstance } from './jobs/crawl-instance';
import { scheduleCrawls } from './jobs/schedule-crawls';
import { syncBuilds } from './jobs/sync-builds';

const connectionString =
  process.env['DATABASE_URL'] ?? 'postgres://tig:tig@localhost:5432/tig';

const taskList: TaskList = {
  crawl_instance: crawlInstance,
  sync_builds: syncBuilds,
  schedule_crawls: scheduleCrawls,
  analyze_build: async (_payload, helpers) => {
    helpers.logger.info('Analyze build job — not yet implemented');
  },
  snapshot_health: async (_payload, helpers) => {
    helpers.logger.info('Health snapshot job — not yet implemented');
  },
};

async function main() {
  const runner = await run({
    connectionString,
    concurrency: 5,
    noHandleSignals: false,
    taskList,
    crontab: '* * * * * schedule_crawls',
  });

  console.log('TIG Worker running');
  await runner.promise;
}

main().catch((err) => {
  console.error('Worker failed to start:', err);
  process.exit(1);
});
