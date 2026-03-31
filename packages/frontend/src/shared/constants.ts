/**
 * UI constants — no more magic numbers scattered across components.
 */

/** Data refresh intervals in milliseconds */
export const REFETCH = {
  fast: 10_000,    // running builds, executors
  normal: 30_000,  // dashboard, health, failures
  slow: 60_000,    // trends, cost
} as const;

/** Stuck/alert thresholds */
export const THRESHOLDS = {
  stuckBuildMs: 4 * 60 * 60 * 1000, // 4 hours
  highQueueDepth: 10,
} as const;

/** Build result → display color mapping */
export const RESULT_COLORS: Record<string, string> = {
  SUCCESS: "#51E2B4",
  FAILURE: "#FF6B6B",
  UNSTABLE: "#FBBF24",
  ABORTED: "#6B6F85",
  NOT_BUILT: "#6B6F85",
};
