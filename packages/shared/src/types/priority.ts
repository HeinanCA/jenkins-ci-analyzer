import { z } from "zod";

export const FAILURE_PRIORITY_VALUES = [
  "BLOCKER",
  "ACTIONABLE",
  "FLAKY",
  "INFRA",
  "UNKNOWN",
] as const;

export type FailurePriority = (typeof FAILURE_PRIORITY_VALUES)[number];

export const FailurePrioritySchema = z.enum(FAILURE_PRIORITY_VALUES);
