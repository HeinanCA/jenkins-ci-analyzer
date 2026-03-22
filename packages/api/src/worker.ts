import { run, type TaskList } from 'graphile-worker';
import { crawlInstance } from './jobs/crawl-instance';
import { scheduleCrawls } from './jobs/schedule-crawls';
import { syncBuilds } from './jobs/sync-builds';
import { analyzeBuild } from './jobs/analyze-build';
import { snapshotHealth } from './jobs/snapshot-health';

const connectionString =
  process.env['DATABASE_URL'] ?? 'postgres://tig:tig@localhost:5432/tig';

const taskList: TaskList = {
  crawl_instance: crawlInstance,
  sync_builds: syncBuilds,
  analyze_build: analyzeBuild,
  schedule_crawls: scheduleCrawls,
  snapshot_health: snapshotHealth,
};

async function main() {
  const runner = await run({
    connectionString,
    concurrency: 5,
    noHandleSignals: false,
    taskList,
    crontab: '* * * * * schedule_crawls',
  });

  console.log('TIG Worker running — all tasks live');
  await runner.promise;
}

main().catch((err) => {
  console.error('Worker failed to start:', err);
  process.exit(1);
});
