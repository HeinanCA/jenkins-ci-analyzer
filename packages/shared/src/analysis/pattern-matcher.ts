import type { FailurePattern, MatchResult, FailureSeverity, ExtractedContext } from './types';

const MAX_SCAN_LINES = 2000;

const SEVERITY_ORDER: Record<FailureSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const SEVERITY_CONFIDENCE: Record<FailureSeverity, number> = {
  critical: 0.95,
  high: 0.85,
  medium: 0.7,
  low: 0.5,
};

export function analyzeLog(
  log: string,
  patterns: readonly FailurePattern[],
): readonly MatchResult[] {
  if (log.length === 0) {
    return [];
  }

  const allLines = log.split('\n');
  const startIndex = Math.max(0, allLines.length - MAX_SCAN_LINES);
  const lines = allLines.slice(startIndex);
  const lineOffset = startIndex;

  const results: MatchResult[] = [];

  for (const pattern of patterns) {
    const match = findFirstMatch(allLines, lines, pattern, lineOffset);
    if (match !== null) {
      results.push(match);
    }
  }

  return results.toSorted(
    (a, b) =>
      SEVERITY_ORDER[a.pattern.severity] - SEVERITY_ORDER[b.pattern.severity],
  );
}

function findFirstMatch(
  allLines: readonly string[],
  scanLines: readonly string[],
  pattern: FailurePattern,
  lineOffset: number,
): MatchResult | null {
  for (let i = scanLines.length - 1; i >= 0; i--) {
    const line = scanLines[i];
    for (const regex of pattern.patterns) {
      if (regex.test(line)) {
        const absoluteIndex = i + lineOffset;

        // Run context extractor if available
        const context: ExtractedContext = pattern.contextExtractor
          ? pattern.contextExtractor(allLines, absoluteIndex)
          : {};

        return {
          pattern,
          matchedLine: line,
          lineNumber: absoluteIndex + 1,
          confidence: SEVERITY_CONFIDENCE[pattern.severity],
          context,
        };
      }
    }
  }
  return null;
}
