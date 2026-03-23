import { describe, it, expect } from 'vitest';
import { groupByJob } from '../../src/features/failures/utils/group-by-job';
import type { FailureEntry } from '../../src/features/failures/types';

function makeFailure(overrides: Partial<FailureEntry>): FailureEntry {
  return {
    buildId: 'b-' + Math.random().toString(36).slice(2, 8),
    buildNumber: 1,
    result: 'FAILURE',
    startedAt: new Date().toISOString(),
    durationMs: 1000,
    jobName: 'test-job',
    jobFullPath: 'github/Service/test-job/main',
    classification: 'code',
    confidence: 0.9,
    matches: [],
    ...overrides,
  };
}

describe('groupByJob', () => {
  it('returns empty array for empty input', () => {
    expect(groupByJob([])).toEqual([]);
  });

  it('groups by jobFullPath', () => {
    const failures = [
      makeFailure({ jobFullPath: 'a/b/c', buildNumber: 1 }),
      makeFailure({ jobFullPath: 'a/b/c', buildNumber: 2 }),
      makeFailure({ jobFullPath: 'x/y/z', buildNumber: 1 }),
    ];
    const grouped = groupByJob(failures);
    expect(grouped.length).toBe(2);
  });

  it('sets streak to the number of builds per job', () => {
    const failures = [
      makeFailure({ jobFullPath: 'a/b/c', buildNumber: 1 }),
      makeFailure({ jobFullPath: 'a/b/c', buildNumber: 2 }),
      makeFailure({ jobFullPath: 'a/b/c', buildNumber: 3 }),
    ];
    const grouped = groupByJob(failures);
    expect(grouped[0].streak).toBe(3);
  });

  it('sorts by streak descending', () => {
    const failures = [
      makeFailure({ jobFullPath: 'single', buildNumber: 1 }),
      makeFailure({ jobFullPath: 'triple', buildNumber: 1 }),
      makeFailure({ jobFullPath: 'triple', buildNumber: 2 }),
      makeFailure({ jobFullPath: 'triple', buildNumber: 3 }),
      makeFailure({ jobFullPath: 'double', buildNumber: 1 }),
      makeFailure({ jobFullPath: 'double', buildNumber: 2 }),
    ];
    const grouped = groupByJob(failures);
    expect(grouped[0].jobFullPath).toBe('triple');
    expect(grouped[1].jobFullPath).toBe('double');
    expect(grouped[2].jobFullPath).toBe('single');
  });

  it('latest is the most recent build', () => {
    const failures = [
      makeFailure({ jobFullPath: 'a/b/c', buildNumber: 1, startedAt: '2026-01-01T00:00:00Z' }),
      makeFailure({ jobFullPath: 'a/b/c', buildNumber: 3, startedAt: '2026-01-03T00:00:00Z' }),
      makeFailure({ jobFullPath: 'a/b/c', buildNumber: 2, startedAt: '2026-01-02T00:00:00Z' }),
    ];
    const grouped = groupByJob(failures);
    expect(grouped[0].latest.buildNumber).toBe(3);
  });

  it('builds are sorted newest first', () => {
    const failures = [
      makeFailure({ jobFullPath: 'a/b/c', buildNumber: 1, startedAt: '2026-01-01T00:00:00Z' }),
      makeFailure({ jobFullPath: 'a/b/c', buildNumber: 3, startedAt: '2026-01-03T00:00:00Z' }),
      makeFailure({ jobFullPath: 'a/b/c', buildNumber: 2, startedAt: '2026-01-02T00:00:00Z' }),
    ];
    const grouped = groupByJob(failures);
    expect(grouped[0].builds.map((b) => b.buildNumber)).toEqual([3, 2, 1]);
  });

  it('ties in streak are broken by recency', () => {
    const failures = [
      makeFailure({ jobFullPath: 'old', buildNumber: 1, startedAt: '2026-01-01T00:00:00Z' }),
      makeFailure({ jobFullPath: 'new', buildNumber: 1, startedAt: '2026-01-03T00:00:00Z' }),
    ];
    const grouped = groupByJob(failures);
    expect(grouped[0].jobFullPath).toBe('new');
  });
});
