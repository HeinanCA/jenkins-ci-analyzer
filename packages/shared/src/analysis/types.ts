export type FailureCategory = 'infra' | 'code';
export type FailureSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface ExtractedContext {
  readonly testName?: string;
  readonly testClass?: string;
  readonly assertion?: string;
  readonly expected?: string;
  readonly actual?: string;
  readonly filePath?: string;
  readonly fileLine?: number;
  readonly exceptionType?: string;
  readonly stackTrace?: readonly string[];
  readonly rootCause?: string;
  readonly module?: string;
  readonly details?: Readonly<Record<string, string>>;
}

export type ContextExtractor = (
  lines: readonly string[],
  matchIndex: number,
) => ExtractedContext;

export interface FailurePattern {
  readonly id: string;
  readonly name: string;
  readonly category: FailureCategory;
  readonly severity: FailureSeverity;
  readonly patterns: readonly RegExp[];
  readonly description: string;
  readonly remediationSteps: readonly string[];
  readonly contextExtractor?: ContextExtractor;
  readonly docUrl?: string;
}

export interface MatchResult {
  readonly pattern: FailurePattern;
  readonly matchedLine: string;
  readonly lineNumber: number;
  readonly confidence: number;
  readonly context: ExtractedContext;
}

export type Classification = 'infrastructure' | 'code' | 'unknown';

export interface ClassificationResult {
  readonly classification: Classification;
  readonly confidence: number;
  readonly reasons: readonly string[];
}

export interface AiAnalysisResult {
  readonly summary: string;
  readonly rootCause: string;
  readonly classification: FailureCategory;
  readonly suggestedFixes: readonly string[];
  readonly confidence: number;
}
