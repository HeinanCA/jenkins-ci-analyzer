import { run, type TaskList } from 'graphile-worker';

const connectionString = process.env['DATABASE_URL'] ?? 'postgres://tig:tig@localhost:5432/tig';

const taskList: TaskList = {
  crawl_instance: async (_payload, _helpers) => {
    console.log('Crawl instance job - not yet implemented');
  },
  analyze_build: async (_payload, _helpers) => {
    console.log('Analyze build job - not yet implemented');
  },
  snapshot_health: async (_payload, _helpers) => {
    console.log('Health snapshot job - not yet implemented');
  },
};

async function main() {
  const runner = await run({
    connectionString,
    concurrency: 5,
    noHandleSignals: false,
    taskList,
  });

  console.log('TIG Worker running');

  await runner.promise;
}

main().catch((err) => {
  console.error('Worker failed to start:', err);
  process.exit(1);
});
