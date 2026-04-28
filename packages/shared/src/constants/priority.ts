import type { FailurePriority } from "../types/priority";

export const PRIORITY_ORDER: Record<FailurePriority, number> = {
  BLOCKER: 4,
  ACTIONABLE: 3,
  FLAKY: 2,
  INFRA: 1,
  UNKNOWN: 0,
};

export const PRIORITY_LABEL: Record<FailurePriority, string> = {
  BLOCKER: "Blocker",
  ACTIONABLE: "Actionable",
  FLAKY: "Flaky",
  INFRA: "Infra",
  UNKNOWN: "Unknown",
};
