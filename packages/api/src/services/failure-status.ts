/**
 * failure-status.ts
 *
 * Pure TypeScript status-resolution for the failures dashboard.
 *
 * Given a list of builds for a job (ranked newest-first), determines:
 *   - broken      : latest meaningful build is FAILURE/UNSTABLE
 *   - in_progress : latest build is running (result IS NULL) AND
 *                   the build before it was FAILURE/UNSTABLE
 *   - fixed       : latest meaningful build is SUCCESS AND the one before
 *                   it was FAILURE/UNSTABLE (and user has not yet dismissed it)
 *   - stable      : omit (consecutive SUCCESSes)
 *
 * ABORTED builds are skipped when determining "latest meaningful".
 */

export type FailureStatus = "broken" | "in_progress" | "fixed";

export interface BuildRow {
  readonly id: string;
  readonly buildNumber: number;
  readonly result: string | null;
  readonly startedAt: Date;
  readonly durationMs: number | null;
  readonly jobId: string;
  readonly organizationId: string;
  readonly gitSha: string | null;
  readonly gitRemoteUrl: string | null;
  readonly triggeredBy: string | null;
  readonly culprits: string[];
}

export interface AnalysisRow {
  readonly id: string | null;
  readonly buildId: string;
  readonly classification: string | null;
  readonly confidence: number | null;
  readonly matches: unknown;
  readonly aiSummary: string | null;
  readonly aiRootCause: string | null;
  readonly aiSuggestedFixes: unknown;
  readonly logNoisePercent: number | null;
  readonly logTopNoise: string | null;
  readonly priority: string | null;
}

export interface JobMeta {
  readonly jobId: string;
  readonly jobName: string;
  readonly jobFullPath: string;
  readonly jobUrl: string;
}

export interface StatusResolution {
  readonly status: FailureStatus;
  readonly jobName: string;
  readonly jobFullPath: string;
  readonly jobUrl: string;
  readonly streak: number;
  readonly latestBuild: BuildRow;
  readonly failureBuilds: readonly BuildRow[];
  readonly recoveryBuildId?: string;
  readonly logNoisePercent?: number | null;
  readonly logTopNoise?: string | null;
  readonly priority?: string | null;
}

const FAILURE_RESULTS = new Set(["FAILURE", "UNSTABLE"]);

/**
 * Returns builds filtered to exclude ABORTED ones.
 * Preserves original order (newest-first assumed).
 */
function meaningfulBuilds(builds: readonly BuildRow[]): BuildRow[] {
  return builds.filter((b) => b.result !== "ABORTED");
}

/**
 * Count the consecutive failure streak starting from the most recent
 * meaningful failure build.
 */
function countStreak(builds: readonly BuildRow[]): number {
  let count = 0;
  for (const b of builds) {
    if (FAILURE_RESULTS.has(b.result ?? "")) {
      count += 1;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Resolve status for one job given its builds (newest-first),
 * a map of analysisRows keyed by buildId, and the set of buildIds
 * the current user has already dismissed (viewed).
 *
 * Returns null if the job should be omitted (stable).
 */
export function resolveJobStatus(
  meta: JobMeta,
  buildsNewestFirst: readonly BuildRow[],
  analysisByBuildId: ReadonlyMap<string, AnalysisRow>,
  dismissedBuildIds: ReadonlySet<string>,
): StatusResolution | null {
  if (buildsNewestFirst.length === 0) return null;

  const latest = buildsNewestFirst[0];
  const meaningful = meaningfulBuilds(buildsNewestFirst);

  // in_progress: latest build has no result (running)
  if (latest.result === null) {
    // meaningful excludes ABORTED but includes the running build (result=null).
    // We want the first completed meaningful build — skip the running one.
    const completedMeaningful = meaningful.filter((b) => b.result !== null);
    const previousMeaningful = completedMeaningful[0];
    if (
      previousMeaningful === undefined ||
      !FAILURE_RESULTS.has(previousMeaningful.result ?? "")
    ) {
      return null; // running after a success — not a failure scenario
    }

    const failureBuilds = completedMeaningful.filter((b) =>
      FAILURE_RESULTS.has(b.result ?? ""),
    );
    const streak = failureBuilds.length;
    const latestFailure = failureBuilds[0];
    const analysis = latestFailure
      ? analysisByBuildId.get(latestFailure.id)
      : undefined;

    return {
      status: "in_progress",
      jobName: meta.jobName,
      jobFullPath: meta.jobFullPath,
      jobUrl: meta.jobUrl,
      streak,
      latestBuild: latest,
      failureBuilds,
      logNoisePercent: analysis?.logNoisePercent ?? null,
      logTopNoise: analysis?.logTopNoise ?? null,
      priority: analysis?.priority ?? null,
    };
  }

  const latestMeaningful = meaningful[0];
  if (!latestMeaningful) return null;

  // fixed: latest meaningful = SUCCESS, previous meaningful = FAILURE/UNSTABLE
  if (latestMeaningful.result === "SUCCESS") {
    const previousMeaningful = meaningful[1];
    if (
      !previousMeaningful ||
      !FAILURE_RESULTS.has(previousMeaningful.result ?? "")
    ) {
      return null; // stable — omit
    }

    // Dismissed: user has already viewed this recovery build
    if (dismissedBuildIds.has(latestMeaningful.id)) {
      return null;
    }

    const failureBuilds = meaningful
      .slice(1)
      .filter((b) => FAILURE_RESULTS.has(b.result ?? ""));

    const streak = failureBuilds.length;
    const latestFailure = failureBuilds[0];
    const analysis = latestFailure
      ? analysisByBuildId.get(latestFailure.id)
      : undefined;

    return {
      status: "fixed",
      jobName: meta.jobName,
      jobFullPath: meta.jobFullPath,
      jobUrl: meta.jobUrl,
      streak,
      latestBuild: latestMeaningful,
      failureBuilds,
      recoveryBuildId: latestMeaningful.id,
      logNoisePercent: analysis?.logNoisePercent ?? null,
      logTopNoise: analysis?.logTopNoise ?? null,
      priority: analysis?.priority ?? null,
    };
  }

  // broken: latest meaningful = FAILURE/UNSTABLE
  if (FAILURE_RESULTS.has(latestMeaningful.result ?? "")) {
    const failureBuilds = meaningful.filter((b) =>
      FAILURE_RESULTS.has(b.result ?? ""),
    );
    const streak = countStreak(meaningful);
    const latestFailure = failureBuilds[0];
    const analysis = latestFailure
      ? analysisByBuildId.get(latestFailure.id)
      : undefined;

    return {
      status: "broken",
      jobName: meta.jobName,
      jobFullPath: meta.jobFullPath,
      jobUrl: meta.jobUrl,
      streak,
      latestBuild: latestMeaningful,
      failureBuilds,
      logNoisePercent: analysis?.logNoisePercent ?? null,
      logTopNoise: analysis?.logTopNoise ?? null,
      priority: analysis?.priority ?? null,
    };
  }

  return null;
}
