/**
 * Cleanup scan-triggered build noise.
 *
 * Deletes failed builds that have no user attribution and are older than the
 * configured buffer. These are almost always multi-branch pipeline scan
 * artifacts from dead PR branches — they pollute the Failures page and erode
 * user trust.
 *
 * Target criteria (all must match):
 *   - triggered_by IS NULL
 *   - started_at < now() - 14 days
 *   - result IN ('FAILURE', 'UNSTABLE')
 *
 * SAFETY:
 *   - Runs in dry-run mode by default (reports counts, deletes nothing)
 *   - Pass --apply to actually delete
 *   - Wraps deletes in a single transaction
 *   - Cleans dependent rows (analysis_feedback, pattern_candidates,
 *     build_analyses) before deleting builds
 *
 * Usage:
 *   pnpm --filter @tig/api exec tsx scripts/cleanup-scan-noise.ts
 *   pnpm --filter @tig/api exec tsx scripts/cleanup-scan-noise.ts --apply
 */

import { db, sql as pgClient } from "../src/db/connection";
import { sql } from "drizzle-orm";

const BUFFER_DAYS = 14;

interface Counts {
  readonly builds: number;
  readonly analyses: number;
  readonly feedback: number;
  readonly candidates: number;
}

async function countTargets(): Promise<Counts> {
  const [{ count: buildCount }] = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*)::int AS count FROM builds
    WHERE triggered_by IS NULL
      AND started_at < now() - (${BUFFER_DAYS} || ' days')::interval
      AND result IN ('FAILURE', 'UNSTABLE')
  `);

  const [{ count: analysisCount }] = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*)::int AS count FROM build_analyses ba
    WHERE ba.build_id IN (
      SELECT id FROM builds
      WHERE triggered_by IS NULL
        AND started_at < now() - (${BUFFER_DAYS} || ' days')::interval
        AND result IN ('FAILURE', 'UNSTABLE')
    )
  `);

  const [{ count: feedbackCount }] = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*)::int AS count FROM analysis_feedback af
    WHERE af.build_analysis_id IN (
      SELECT ba.id FROM build_analyses ba
      JOIN builds b ON b.id = ba.build_id
      WHERE b.triggered_by IS NULL
        AND b.started_at < now() - (${BUFFER_DAYS} || ' days')::interval
        AND b.result IN ('FAILURE', 'UNSTABLE')
    )
  `);

  const [{ count: candidateCount }] = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*)::int AS count FROM pattern_candidates pc
    WHERE pc.build_analysis_id IN (
      SELECT ba.id FROM build_analyses ba
      JOIN builds b ON b.id = ba.build_id
      WHERE b.triggered_by IS NULL
        AND b.started_at < now() - (${BUFFER_DAYS} || ' days')::interval
        AND b.result IN ('FAILURE', 'UNSTABLE')
    )
  `);

  return {
    builds: buildCount,
    analyses: analysisCount,
    feedback: feedbackCount,
    candidates: candidateCount,
  };
}

async function applyCleanup(): Promise<Counts> {
  return await db.transaction(async (tx) => {
    // Lock the target build IDs for the duration of the transaction
    const targets = await tx.execute<{ id: string }>(sql`
      SELECT id FROM builds
      WHERE triggered_by IS NULL
        AND started_at < now() - (${BUFFER_DAYS} || ' days')::interval
        AND result IN ('FAILURE', 'UNSTABLE')
      FOR UPDATE
    `);
    const buildIds = targets.map((r) => r.id);

    if (buildIds.length === 0) {
      return { builds: 0, analyses: 0, feedback: 0, candidates: 0 };
    }

    const feedbackDeleted = await tx.execute<{ id: string }>(sql`
      DELETE FROM analysis_feedback
      WHERE build_analysis_id IN (
        SELECT id FROM build_analyses WHERE build_id = ANY(${buildIds}::uuid[])
      )
      RETURNING id
    `);

    const candidatesDeleted = await tx.execute<{ id: string }>(sql`
      DELETE FROM pattern_candidates
      WHERE build_analysis_id IN (
        SELECT id FROM build_analyses WHERE build_id = ANY(${buildIds}::uuid[])
      )
      RETURNING id
    `);

    const analysesDeleted = await tx.execute<{ id: string }>(sql`
      DELETE FROM build_analyses
      WHERE build_id = ANY(${buildIds}::uuid[])
      RETURNING id
    `);

    const buildsDeleted = await tx.execute<{ id: string }>(sql`
      DELETE FROM builds
      WHERE id = ANY(${buildIds}::uuid[])
      RETURNING id
    `);

    return {
      builds: buildsDeleted.length,
      analyses: analysesDeleted.length,
      feedback: feedbackDeleted.length,
      candidates: candidatesDeleted.length,
    };
  });
}

async function main() {
  const apply = process.argv.includes("--apply");
  const mode = apply ? "APPLY" : "DRY RUN";

  console.log(`\n[cleanup-scan-noise] Mode: ${mode}`);
  console.log(
    `[cleanup-scan-noise] Target: triggered_by IS NULL, older than ${BUFFER_DAYS} days, FAILURE/UNSTABLE\n`,
  );

  const before = await countTargets();
  console.log("Targets matched:");
  console.log(`  builds:             ${before.builds}`);
  console.log(`  build_analyses:     ${before.analyses}`);
  console.log(`  analysis_feedback:  ${before.feedback}`);
  console.log(`  pattern_candidates: ${before.candidates}\n`);

  if (!apply) {
    console.log("Dry run — no rows deleted. Re-run with --apply to commit.\n");
    await pgClient.end();
    return;
  }

  if (before.builds === 0) {
    console.log("Nothing to delete.\n");
    await pgClient.end();
    return;
  }

  const deleted = await applyCleanup();
  console.log("Rows deleted:");
  console.log(`  builds:             ${deleted.builds}`);
  console.log(`  build_analyses:     ${deleted.analyses}`);
  console.log(`  analysis_feedback:  ${deleted.feedback}`);
  console.log(`  pattern_candidates: ${deleted.candidates}\n`);

  await pgClient.end();
}

main().catch((err) => {
  console.error("[cleanup-scan-noise] FAILED:", err);
  process.exit(1);
});
