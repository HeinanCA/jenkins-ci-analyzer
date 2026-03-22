export { analyzeLog } from "./analysis/pattern-matcher";
export { classifyFailure } from "./analysis/infra-code-classifier";
export { FAILURE_PATTERNS } from "./analysis/failure-patterns";
export { calculateHealth } from "./health/health-calculator";

export type {
  FailurePattern,
  FailureCategory,
  FailureSeverity,
  MatchResult,
  Classification,
  ClassificationResult,
  AiAnalysisResult,
  ExtractedContext,
  ContextExtractor,
} from "./analysis/types";

export type {
  HealthMetrics,
  HealthLevel,
  HealthReport,
} from "./health/health-calculator";

export type {
  JenkinsJob,
  JenkinsBuild,
  JenkinsAgent,
  JenkinsQueueItem,
} from "./schemas/jenkins-api";

export {
  JenkinsJobSchema,
  JenkinsBuildSchema,
  JenkinsAgentSchema,
  JenkinsQueueItemSchema,
  JenkinsJobsResponseSchema,
  JenkinsBuildHistorySchema,
  JenkinsComputerSetSchema,
  JenkinsQueueSchema,
  JenkinsInfoSchema,
} from "./schemas/jenkins-api";

export {
  POLLING_INTERVALS,
  STUCK_AGENT_THRESHOLD_MS,
  ZOMBIE_AGENT_THRESHOLD_MS,
  MAX_LOG_SCAN_LINES,
  MAX_LOG_CHARS_FOR_AI,
  BUILD_STATUS_COLORS,
} from "./constants";
