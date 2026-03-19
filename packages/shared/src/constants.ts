export const POLLING_INTERVALS = {
  AGENTS: 30_000,
  BUILDS: 15_000,
  QUEUE: 15_000,
  METRICS: 300_000,
} as const;

export const STUCK_AGENT_THRESHOLD_MS = 4 * 60 * 60 * 1000;
export const ZOMBIE_AGENT_THRESHOLD_MS = 24 * 60 * 60 * 1000;
export const MAX_LOG_SCAN_LINES = 2000;
export const MAX_LOG_CHARS_FOR_AI = 50_000;

export const BUILD_STATUS_COLORS: Record<string, string> = {
  blue: 'green',
  green: 'green',
  red: 'red',
  yellow: 'yellow',
  aborted: 'gray',
  disabled: 'gray',
  notbuilt: 'gray',
} as const;
