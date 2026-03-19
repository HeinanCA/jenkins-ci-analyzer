import { describe, it, expect } from 'vitest';
import { classifyFailure } from '../../src/features/build-analysis/engine/infra-code-classifier';
import type { MatchResult, FailurePattern } from '../../src/features/build-analysis/engine/types';

function makeMatch(
  overrides: Partial<FailurePattern> & { id: string; category: 'infra' | 'code' },
): MatchResult {
  return {
    pattern: {
      id: overrides.id,
      name: overrides.name ?? overrides.id,
      category: overrides.category,
      severity: overrides.severity ?? 'medium',
      patterns: [],
      description: '',
      remediationSteps: [],
    },
    matchedLine: 'some error line',
    lineNumber: 1,
    confidence: overrides.severity === 'critical' ? 0.9 : 0.7,
  };
}

describe('classifyFailure', () => {
  it('returns "unknown" with zero confidence for empty matches', () => {
    const result = classifyFailure([]);
    expect(result.classification).toBe('unknown');
    expect(result.confidence).toBe(0);
    expect(result.reasons.length).toBeGreaterThanOrEqual(1);
  });

  it('classifies as "infrastructure" when all matches are infra', () => {
    const matches = [
      makeMatch({ id: 'oom', category: 'infra', severity: 'critical' }),
      makeMatch({ id: 'disk-full', category: 'infra', severity: 'critical' }),
    ];
    const result = classifyFailure(matches);
    expect(result.classification).toBe('infrastructure');
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it('classifies as "code" when all matches are code', () => {
    const matches = [
      makeMatch({ id: 'test-failure', category: 'code', severity: 'medium' }),
      makeMatch({ id: 'compilation', category: 'code', severity: 'high' }),
    ];
    const result = classifyFailure(matches);
    expect(result.classification).toBe('code');
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it('classifies as "infrastructure" when infra matches outweigh code by severity', () => {
    const matches = [
      makeMatch({ id: 'oom', category: 'infra', severity: 'critical' }),
      makeMatch({ id: 'lint', category: 'code', severity: 'low' }),
    ];
    const result = classifyFailure(matches);
    expect(result.classification).toBe('infrastructure');
  });

  it('classifies as "code" when code matches outweigh infra by severity', () => {
    const matches = [
      makeMatch({ id: 'compilation', category: 'code', severity: 'high' }),
      makeMatch({ id: 'network', category: 'infra', severity: 'high' }),
      makeMatch({ id: 'test-failure', category: 'code', severity: 'medium' }),
    ];
    const result = classifyFailure(matches);
    expect(result.classification).toBe('code');
  });

  it('provides human-readable reasons', () => {
    const matches = [
      makeMatch({ id: 'oom', name: 'Out of Memory', category: 'infra', severity: 'critical' }),
    ];
    const result = classifyFailure(matches);
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.reasons[0]).toContain('Out of Memory');
  });

  it('classifies single infra match correctly', () => {
    const matches = [
      makeMatch({ id: 'agent-disconnected', category: 'infra', severity: 'critical' }),
    ];
    const result = classifyFailure(matches);
    expect(result.classification).toBe('infrastructure');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('classifies single code match correctly', () => {
    const matches = [
      makeMatch({ id: 'test-failure', category: 'code', severity: 'medium' }),
    ];
    const result = classifyFailure(matches);
    expect(result.classification).toBe('code');
    expect(result.confidence).toBeGreaterThan(0.8);
  });
});
