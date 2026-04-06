import { run, type TaskList } from "graphile-worker";
import { crawlInstance } from "./jobs/crawl-instance";
import { scheduleCrawls } from "./jobs/schedule-crawls";
import { syncBuilds } from "./jobs/sync-builds";
import { analyzeBuild } from "./jobs/analyze-build";
import { snapshotHealth } from "./jobs/snapshot-health";
import { checkAiHealth } from "./jobs/check-ai-health";

const connectionString =
  process.env["DATABASE_URL"] ?? "postgres://tig:tig@localhost:5432/tig";

// Configurable AI health check interval (default 5 min, minimum 60s)
const rawInterval = Number(
  process.env["AI_HEALTH_CHECK_INTERVAL_MS"] ?? 300_000,
);
const AI_HEALTH_INTERVAL_MS = Math.max(60_000, rawInterval);
const AI_HEALTH_CRON_MINUTES = Math.max(
  1,
  Math.round(AI_HEALTH_INTERVAL_MS / 60_000),
);

if (rawInterval < 60_000) {
  console.warn(
    `AI_HEALTH_CHECK_INTERVAL_MS=${rawInterval} is below minimum (60000). Using 60000.`,
  );
}

// Configurable crawl interval (default 5 min, minimum 1 min)
const CRAWL_INTERVAL_MINUTES = Math.max(
  1,
  Math.round(Number(process.env["CRAWL_INTERVAL_MINUTES"] ?? 5)),
);

const taskList: TaskList = {
  crawl_instance: crawlInstance,
  sync_builds: syncBuilds,
  analyze_build: analyzeBuild,
  schedule_crawls: scheduleCrawls,
  snapshot_health: snapshotHealth,
  check_ai_health: checkAiHealth,
};

async function main() {
  const runner = await run({
    connectionString,
    concurrency: 5,
    noHandleSignals: false,
    taskList,
    crontab: [
      `*/${CRAWL_INTERVAL_MINUTES} * * * * schedule_crawls`,
      `*/${AI_HEALTH_CRON_MINUTES} * * * * check_ai_health`,
    ].join("\n"),
  });

  console.log(
    `TIG Worker running (crawl every ${CRAWL_INTERVAL_MINUTES}min, AI health every ${AI_HEALTH_CRON_MINUTES}min)`,
  );
  await runner.promise;
}

main().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});
