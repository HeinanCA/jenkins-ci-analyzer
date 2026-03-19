export type FailureCategory = 'infra' | 'code';
export type FailureSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface FailurePattern {
  readonly id: string;
  readonly name: string;
  readonly category: FailureCategory;
  readonly severity: FailureSeverity;
  readonly patterns: readonly RegExp[];
  readonly description: string;
  readonly remediationSteps: readonly string[];
  readonly docUrl?: string;
}

export interface MatchResult {
  readonly pattern: FailurePattern;
  readonly matchedLine: string;
  readonly lineNumber: number;
  readonly confidence: number;
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
