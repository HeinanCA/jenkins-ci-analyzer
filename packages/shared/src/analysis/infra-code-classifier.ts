import type {
  MatchResult,
  ClassificationResult,
  FailureCategory,
  FailureSeverity,
} from './types';

const SEVERITY_WEIGHT: Record<FailureSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function classifyFailure(
  matches: readonly MatchResult[],
): ClassificationResult {
  if (matches.length === 0) {
    return {
      classification: 'unknown',
      confidence: 0,
      reasons: ['No recognized failure patterns found in the build log.'],
    };
  }

  const scores: Record<FailureCategory, number> = { infra: 0, code: 0 };
  const reasons: string[] = [];

  for (const match of matches) {
    const weight = SEVERITY_WEIGHT[match.pattern.severity];
    scores[match.pattern.category] += weight;
    reasons.push(
      `${match.pattern.name} (${match.pattern.category}, severity: ${match.pattern.severity})`,
    );
  }

  const totalWeight = scores.infra + scores.code;
  const dominantCategory: FailureCategory =
    scores.infra >= scores.code ? 'infra' : 'code';
  const dominantScore = Math.max(scores.infra, scores.code);
  const confidence = dominantScore / totalWeight;

  const classification =
    dominantCategory === 'infra' ? 'infrastructure' : 'code';

  const summaryReason =
    classification === 'infrastructure'
      ? `Classified as infrastructure issue because: ${reasons.join(', ')}`
      : `Classified as code issue because: ${reasons.join(', ')}`;

  return {
    classification,
    confidence,
    reasons: [summaryReason],
  };
}
