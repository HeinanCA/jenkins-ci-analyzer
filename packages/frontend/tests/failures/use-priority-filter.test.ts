import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePriorityFilter } from '../../src/features/failures/hooks/usePriorityFilter';
import type { JobFailureGroup, BuildRow } from '../../src/features/failures/types';
import type { FailurePriority } from '@tig/shared';

// ─── Helpers ──────────────────────────────────────────────────
function makeBuildRow(overrides: Partial<BuildRow> = {}): BuildRow {
  return {
    buildId: 'b1',
    buildNumber: 1,
    result: 'FAILURE',
    startedAt: '2024-01-01T00:00:00Z',
    durationMs: 1000,
    jobName: 'test-job',
    jobFullPath: 'test-job',
    jobUrl: 'http://jenkins/job/test-job',
    gitSha: null,
    gitRemoteUrl: null,
    analysisId: null,
    classification: null,
    confidence: null,
    matches: null,
    aiSummary: null,
    aiRootCause: null,
    aiSuggestedFixes: null,
    logNoisePercent: null,
    logTopNoise: null,
    triggeredBy: null,
    priority: null,
    ...overrides,
  };
}

function makeGroup(
  priority: FailurePriority | null,
  status: 'broken' | 'fixed' | 'in_progress' = 'broken',
  jobFullPath = `job-${priority ?? 'null'}`,
): JobFailureGroup {
  return {
    status,
    jobName: jobFullPath,
    jobFullPath,
    jobUrl: 'http://jenkins',
    streak: 1,
    latestBuild: makeBuildRow({ priority, jobFullPath, jobName: jobFullPath }),
    failureBuilds: [],
  };
}

const GROUPS: readonly JobFailureGroup[] = [
  makeGroup('BLOCKER'),
  makeGroup('ACTIONABLE'),
  makeGroup('FLAKY'),
  makeGroup('INFRA'),
  makeGroup('UNKNOWN'),
  makeGroup(null),
  makeGroup('BLOCKER', 'fixed'), // fixed groups should NOT be counted
  makeGroup('ACTIONABLE', 'in_progress'), // in_progress should NOT be counted
];

describe('usePriorityFilter', () => {
  it('defaults to priorityFilter = "all"', () => {
    const { result } = renderHook(() => usePriorityFilter(GROUPS));
    expect(result.current.priorityFilter).toBe('all');
  });

  it('counts only broken-status groups per priority', () => {
    const { result } = renderHook(() => usePriorityFilter(GROUPS));
    const { priorityCounts } = result.current;
    expect(priorityCounts.BLOCKER).toBe(1);
    expect(priorityCounts.ACTIONABLE).toBe(1);
    expect(priorityCounts.FLAKY).toBe(1);
    expect(priorityCounts.INFRA).toBe(1);
    // UNKNOWN and null priority groups are still broken but UNKNOWN is not filterable in UI
    expect(priorityCounts.UNKNOWN).toBe(1);
  });

  it('returns all groups (regardless of status) when filter is "all"', () => {
    const { result } = renderHook(() => usePriorityFilter(GROUPS));
    expect(result.current.filteredGroups.length).toBe(GROUPS.length);
  });

  it('filters to only BLOCKER groups when priorityFilter is set to BLOCKER', () => {
    const { result } = renderHook(() => usePriorityFilter(GROUPS));
    act(() => {
      result.current.setPriorityFilter('BLOCKER');
    });
    const filtered = result.current.filteredGroups;
    expect(filtered.every((g) => g.latestBuild.priority === 'BLOCKER')).toBe(true);
    // GROUPS has 2 BLOCKER entries: one broken, one fixed — both appear in filteredGroups
    expect(filtered.length).toBe(2);
  });

  it('setPriorityFilter toggles back to "all"', () => {
    const { result } = renderHook(() => usePriorityFilter(GROUPS));
    act(() => {
      result.current.setPriorityFilter('FLAKY');
    });
    expect(result.current.priorityFilter).toBe('FLAKY');
    act(() => {
      result.current.setPriorityFilter('all');
    });
    expect(result.current.priorityFilter).toBe('all');
  });

  it('exposing priorityCounts and filteredGroups are separate concerns — counts always reflect input groups broken status', () => {
    const brokenOnly: readonly JobFailureGroup[] = [
      makeGroup('BLOCKER'),
      makeGroup('BLOCKER'),
      makeGroup('ACTIONABLE'),
    ];
    const { result } = renderHook(() => usePriorityFilter(brokenOnly));
    expect(result.current.priorityCounts.BLOCKER).toBe(2);
    expect(result.current.priorityCounts.ACTIONABLE).toBe(1);
    expect(result.current.priorityCounts.FLAKY).toBe(0);
    expect(result.current.priorityCounts.INFRA).toBe(0);
  });
});
