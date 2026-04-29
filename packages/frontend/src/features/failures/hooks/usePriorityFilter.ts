import { useState, useMemo } from 'react';
import { FAILURE_PRIORITY_VALUES, type FailurePriority } from '@tig/shared';
import type { JobFailureGroup } from '../types';

// ─── Types ────────────────────────────────────────────────────
export type PriorityFilterValue = 'all' | FailurePriority;

export interface UsePriorityFilterResult {
  readonly priorityFilter: PriorityFilterValue;
  readonly setPriorityFilter: (value: PriorityFilterValue) => void;
  readonly priorityCounts: Record<FailurePriority, number>;
  readonly filteredGroups: readonly JobFailureGroup[];
}

// ─── Hook ─────────────────────────────────────────────────────
/**
 * Manages priority filter state for the failures page.
 *
 * `priorityCounts` is derived ONLY from broken-status groups in the input.
 * `filteredGroups` reflects the full input filtered by the active priority selection.
 * When filter is 'all', filteredGroups === groups (referentially stable via useMemo).
 */
export function usePriorityFilter(
  groups: readonly JobFailureGroup[],
): UsePriorityFilterResult {
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilterValue>('all');

  const priorityCounts = useMemo((): Record<FailurePriority, number> => {
    const counts = Object.fromEntries(
      FAILURE_PRIORITY_VALUES.map((p) => [p, 0]),
    ) as Record<FailurePriority, number>;

    for (const group of groups) {
      if (group.status !== 'broken') continue;
      const p = group.latestBuild.priority;
      if (p != null && p in counts) {
        counts[p] += 1;
      }
    }

    return counts;
  }, [groups]);

  const filteredGroups = useMemo((): readonly JobFailureGroup[] => {
    if (priorityFilter === 'all') return groups;
    return groups.filter((g) => g.latestBuild.priority === priorityFilter);
  }, [groups, priorityFilter]);

  return { priorityFilter, setPriorityFilter, priorityCounts, filteredGroups };
}
