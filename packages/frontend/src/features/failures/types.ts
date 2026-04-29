import type { FailurePriority } from '@tig/shared';

export type FailureStatus = 'broken' | 'in_progress' | 'fixed'

// ─── BuildRow ────────────────────────────────────────────────
export interface BuildRow {
  readonly buildId: string;
  readonly buildNumber: number;
  readonly result: string;
  readonly startedAt: string;
  readonly durationMs: number;
  readonly jobName: string;
  readonly jobFullPath: string;
  readonly jobUrl: string;
  readonly gitSha: string | null;
  readonly gitRemoteUrl: string | null;
  readonly analysisId: string | null;
  readonly classification: string | null;
  readonly confidence: number | null;
  readonly matches: unknown;
  readonly aiSummary: string | null;
  readonly aiRootCause: string | null;
  readonly aiSuggestedFixes: Record<string, unknown> | null;
  readonly logNoisePercent: number | null;
  readonly logTopNoise: string | null;
  readonly triggeredBy: string | null;
  readonly priority: FailurePriority | null;
}

// ─── JobFailureGroup (new API shape) ─────────────────────────
export interface JobFailureGroup {
  readonly status: FailureStatus;
  readonly jobName: string;
  readonly jobFullPath: string;
  readonly jobUrl: string;
  readonly streak: number;
  readonly latestBuild: BuildRow;
  readonly failureBuilds: readonly BuildRow[];
  readonly recoveryBuildId?: string;
  readonly logNoisePercent?: number;
  readonly logTopNoise?: string;
}

// ─── Failures API response envelope ──────────────────────────
export interface FailuresResponse {
  readonly data: readonly JobFailureGroup[];
  readonly scope: 'mine' | 'all';
  readonly mineUnavailable: boolean;
  readonly error: null;
}

// ─── Legacy types (kept for group-by-job util compatibility) ─
export interface FailureEntry {
  readonly buildId: string;
  readonly buildNumber: number;
  readonly result: string;
  readonly startedAt: string;
  readonly durationMs: number;
  readonly jobName: string;
  readonly jobFullPath: string;
  readonly analysisId: string | null;
  readonly classification: string | null;
  readonly confidence: number | null;
  readonly matches: unknown;
  readonly triggeredBy: string | null;
  readonly [key: string]: unknown;
}

export interface GroupedFailure {
  readonly jobFullPath: string;
  readonly jobName: string;
  readonly latest: FailureEntry;
  readonly streak: number;
  readonly builds: readonly FailureEntry[];
}
