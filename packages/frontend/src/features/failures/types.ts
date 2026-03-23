export interface FailureEntry {
  readonly buildId: string;
  readonly buildNumber: number;
  readonly result: string;
  readonly startedAt: string;
  readonly durationMs: number;
  readonly jobName: string;
  readonly jobFullPath: string;
  readonly classification: string | null;
  readonly confidence: number | null;
  readonly matches: unknown;
  readonly [key: string]: unknown;
}

export interface GroupedFailure {
  readonly jobFullPath: string;
  readonly jobName: string;
  readonly latest: FailureEntry;
  readonly streak: number;
  readonly builds: readonly FailureEntry[];
}
