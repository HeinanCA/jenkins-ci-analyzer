import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  Stack,
  Text,
  Accordion,
  Select,
  Card,
  Group,
  SegmentedControl,
  Box,
} from '@mantine/core';
import { tigDashboard, tigTeams } from '../../api/tig-client';
import { useAuthStore } from '../../store/auth-store';
import { colors, cardStyle, metricStyle } from '../../theme/mantine-theme';
import { QueryError } from '../../shared/components/QueryError';
import { LoadingState } from '../../shared/components/LoadingState';
import { useHover } from '../../shared/hooks/use-hover';
import { REFETCH } from '../../shared/constants';
import { BrokenJobCard } from './components/BrokenJobCard';
import { FixedJobCard } from './components/FixedJobCard';
import { SectionHeader } from './components/SectionHeader';
import { useFailuresScope } from './hooks/use-failures-scope';
import { useDismissalQueue } from './hooks/use-dismissal-queue';
import { usePriorityFilter } from './hooks/usePriorityFilter';
import { PRIORITY_DISPLAY } from './constants/priority-display';
import type { JobFailureGroup } from './types';
import { PRIORITY_ORDER, type FailurePriority } from '@tig/shared';

// ─── Filter types ─────────────────────────────────────────────
type ClassFilter = 'all' | 'code' | 'infrastructure';

// ─── Styles ───────────────────────────────────────────────────
const FILTER_INPUT_STYLES = {
  input: {
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    minWidth: 150,
    height: 36,
    fontSize: 13,
  },
};

const ACCORDION_STYLES = {
  item: {
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
    overflow: 'hidden' as const,
  },
  control: { padding: '18px 20px' },
  panel: { padding: '0 20px 20px' },
};

// ─── Priority chips (visible priorities only — UNKNOWN omitted) ─
const VISIBLE_PRIORITIES = ['BLOCKER', 'ACTIONABLE', 'FLAKY', 'INFRA'] as const;

// ─── Helpers ──────────────────────────────────────────────────
function applyClassFilter(
  groups: readonly JobFailureGroup[],
  filter: ClassFilter,
): readonly JobFailureGroup[] {
  if (filter === 'all') return groups;
  return groups.filter(
    (g) => g.latestBuild.classification === filter,
  );
}

function countByClass(
  groups: readonly JobFailureGroup[],
  filter?: ClassFilter,
): number {
  if (!filter || filter === 'all') return groups.length;
  return groups.filter((g) => g.latestBuild.classification === filter).length;
}

// Sort failed builds: BLOCKER → ACTIONABLE → FLAKY → INFRA → UNKNOWN (highest priority weight first)
function sortByPriority(
  groups: readonly JobFailureGroup[],
): readonly JobFailureGroup[] {
  return [...groups].sort((a, b) => {
    const weightA = PRIORITY_ORDER[a.latestBuild.priority ?? 'UNKNOWN'] ?? 0;
    const weightB = PRIORITY_ORDER[b.latestBuild.priority ?? 'UNKNOWN'] ?? 0;
    return (
      weightB - weightA ||
      (b.latestBuild.startedAt ?? '').localeCompare(a.latestBuild.startedAt ?? '')
    ); // descending: higher weight = higher priority; newest first when tied
  });
}

// ─── Empty state copy per priority filter ────────────────────
const PRIORITY_EMPTY_STATES: Record<
  FailurePriority,
  { headline: string; subline: string }
> = {
  BLOCKER: {
    headline: 'No blockers right now.',
    subline: 'All builds are either passing or have a clear fix path.',
  },
  ACTIONABLE: {
    headline: 'Nothing actionable in the current scope.',
    subline: 'Try switching to Everyone or clearing team and author filters.',
  },
  FLAKY: {
    headline: 'No flaky failures detected.',
    subline:
      'Flakiness is identified when a build passes on retry. If you expected one here, it may have been marked Actionable.',
  },
  INFRA: {
    headline: 'No infrastructure failures.',
    subline: 'Jenkins agents and executors are behaving normally.',
  },
  UNKNOWN: {
    headline: 'No matches',
    subline: 'Try clearing the priority filter.',
  },
};

// ─── Priority chip button ────────────────────────────────────
interface PriorityChipButtonProps {
  readonly selected: boolean;
  readonly onClick: () => void;
  readonly bg: string;
  readonly fg: string;
  readonly border: string;
  readonly dim?: boolean;
  readonly icon?: ReactNode;
  readonly children: ReactNode;
}

function PriorityChipButton({
  selected,
  onClick,
  bg,
  fg,
  border,
  dim = false,
  icon,
  children,
}: PriorityChipButtonProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 12px',
        borderRadius: 999,
        border: `1px solid ${border}`,
        backgroundColor: selected ? bg : 'transparent',
        color: fg,
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1.2,
        cursor: 'pointer',
        opacity: dim ? 0.55 : 1,
        transition: 'background-color 0.15s, opacity 0.15s',
        fontFamily: 'inherit',
      }}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

export function FailuresPage() {
  const instanceId = useAuthStore((s) => s.instanceId);
  const [classFilter, setClassFilter] = useState<ClassFilter>('all');
  const [teamId, setTeamId] = useState<string | null>(null);
  const [authorFilter, setAuthorFilter] = useState<string | null>(null);
  const [scope, setScope] = useFailuresScope();
  const { hovered, bind } = useHover<string>();

  // ─── Dismissed ids (optimistic local removal) ──────────────
  const [dismissedIds, setDismissedIds] = useState<ReadonlySet<string>>(
    new Set(),
  );

  const handleDismissed = useCallback((ids: readonly string[]) => {
    setDismissedIds((prev) => new Set([...prev, ...ids]));
  }, []);

  const { enqueue: enqueueDismissal } = useDismissalQueue(handleDismissed);

  // ─── Queries ───────────────────────────────────────────────
  const summaryQuery = useQuery({
    queryKey: ['dashboard-summary', instanceId],
    queryFn: () => tigDashboard.summary(instanceId ?? undefined),
    refetchInterval: REFETCH.normal,
  });

  const { data: teamsData } = useQuery({
    queryKey: ['teams'],
    queryFn: () => tigTeams.list(),
  });

  const { data: authorsData } = useQuery({
    queryKey: ['authors', instanceId],
    queryFn: () => tigDashboard.authors(instanceId ?? undefined),
  });

  const failuresQuery = useQuery({
    queryKey: ['all-failures', instanceId, teamId, authorFilter, scope],
    queryFn: () =>
      tigDashboard.failures(
        instanceId ?? undefined,
        50,
        teamId ?? undefined,
        authorFilter ?? undefined,
        scope,
      ),
    refetchInterval: REFETCH.normal,
  });

  const { data: rawResponse, isLoading } = failuresQuery;

  // ─── Derive sections ───────────────────────────────────────
  const apiGroups: readonly JobFailureGroup[] = rawResponse?.data ?? [];
  const mineUnavailable = rawResponse?.mineUnavailable ?? false;

  const visibleGroups = useMemo(
    () => apiGroups.filter((g) => !dismissedIds.has(g.latestBuild.buildId)),
    [apiGroups, dismissedIds],
  );

  const fixedGroups = useMemo(
    () => visibleGroups.filter((g) => g.status === 'fixed'),
    [visibleGroups],
  );
  const buildingGroups = useMemo(
    () => visibleGroups.filter((g) => g.status === 'in_progress'),
    [visibleGroups],
  );

  // Broken groups after class filter (for priority counts and filter chip counts)
  const classFilteredBroken = useMemo(
    () =>
      applyClassFilter(
        visibleGroups.filter((g) => g.status === 'broken'),
        classFilter,
      ),
    [visibleGroups, classFilter],
  );

  // Wire usePriorityFilter against class-filtered broken groups
  const { priorityFilter, setPriorityFilter, priorityCounts, filteredGroups: priorityFilteredBroken } =
    usePriorityFilter(classFilteredBroken);

  // Final broken groups: priority-filtered, then sorted by priority weight desc
  const brokenGroups = useMemo(
    () => sortByPriority(priorityFilteredBroken),
    [priorityFilteredBroken],
  );

  // For classification filter counts use only broken groups (pre-class-filter)
  const allBroken = useMemo(
    () => visibleGroups.filter((g) => g.status === 'broken'),
    [visibleGroups],
  );

  const totalBroken = useMemo(
    () => countByClass(allBroken),
    [allBroken],
  );
  const codeBroken = useMemo(
    () => countByClass(allBroken, 'code'),
    [allBroken],
  );
  const infraBroken = useMemo(
    () => countByClass(allBroken, 'infrastructure'),
    [allBroken],
  );

  // Total broken after class filter (for "All" chip)
  const totalClassFilteredBroken = classFilteredBroken.length;

  // Show FAILING section header always so the page surface stays consistent
  const showSectionHeaders = true;

  // ─── Early states ──────────────────────────────────────────
  if (isLoading) return <LoadingState />;

  if (failuresQuery.isError) {
    return (
      <QueryError
        message={failuresQuery.error?.message}
        onRetry={failuresQuery.refetch}
      />
    );
  }

  const summary = summaryQuery.data;
  // Hero count must match what's visible on the page. We use allBroken (after
  // dismissals + scope filter, before class+priority filters) so the number
  // reconciles with the cards rendered below. The summary endpoint returns a
  // wider Jenkins-color count that includes failures older than the window.
  const visibleFailureCount = allBroken.length;

  // ─── Mine + empty + unavailable ───────────────────────────
  const showMinePositiveEmpty =
    scope === 'mine' &&
    !mineUnavailable &&
    brokenGroups.length === 0 &&
    buildingGroups.length === 0 &&
    priorityFilter === 'all';

  return (
    <Stack gap={36}>
      {/* Hero header — reflects what's visible on the page */}
      <Stack gap={4}>
        <Group gap={12} align="baseline">
          <Text
            c={visibleFailureCount > 0 ? colors.failure : colors.success}
            fw={800}
            style={{
              ...metricStyle,
              fontSize: 48,
              lineHeight: 1,
              textShadow:
                visibleFailureCount > 0
                  ? '0 0 40px rgba(248, 113, 113, 0.3), 0 0 80px rgba(248, 113, 113, 0.1)'
                  : undefined,
              animation: 'countUp 0.5s ease',
            }}
          >
            {visibleFailureCount}
          </Text>
          <Text size="lg" c={colors.textSecondary} fw={500}>
            {visibleFailureCount === 1 ? 'failure' : 'failures'}
          </Text>
        </Group>
        {summary ? (
          <Text size="sm" c={colors.textTertiary}>
            across {summary.total} monitored{' '}
            {summary.total === 1 ? 'job' : 'jobs'}
          </Text>
        ) : null}
      </Stack>

      {/* Filters row */}
      <Box>
        <Group gap="md" pb={16} mb={8} justify="space-between">
          <Group gap="md">
            <Select
              size="sm"
              placeholder="All teams"
              clearable
              disabled={!teamsData || teamsData.length === 0}
              value={teamId}
              onChange={setTeamId}
              data={(teamsData ?? []).map((t) => ({ value: t.id, label: t.name }))}
              styles={FILTER_INPUT_STYLES}
            />
            <Select
              size="sm"
              placeholder="All authors"
              clearable
              disabled={!authorsData || authorsData.length === 0}
              value={authorFilter}
              onChange={setAuthorFilter}
              data={(authorsData ?? []).map((a) => ({ value: a, label: a }))}
              styles={FILTER_INPUT_STYLES}
            />
            <SegmentedControl
              size="sm"
              value={classFilter}
              onChange={(v) => setClassFilter(v as ClassFilter)}
              data={[
                { label: `All (${totalBroken})`, value: 'all' },
                { label: `Code (${codeBroken})`, value: 'code' },
                { label: `Infra (${infraBroken})`, value: 'infrastructure' },
              ]}
              styles={{
                root: {
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                },
              }}
            />
          </Group>

          {/* Mine / Everyone scope toggle — hidden when mineUnavailable */}
          {!mineUnavailable && (
            <SegmentedControl
              size="sm"
              value={scope}
              onChange={(v) => setScope(v as 'mine' | 'all')}
              data={[
                { label: 'Mine', value: 'mine' },
                { label: 'Everyone', value: 'all' },
              ]}
              styles={{
                root: {
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                },
              }}
            />
          )}
        </Group>

        {/* Priority filter row — always shown */}
        <Group gap="xs" pt={4} pb={12}>
            <Text
              size="xs"
              c={colors.textMuted}
              style={{ lineHeight: '28px' }}
            >
              Priority:
            </Text>
            <Group
              gap={6}
              role="radiogroup"
              aria-label="Priority filter"
            >
              <PriorityChipButton
                selected={priorityFilter === 'all'}
                onClick={() => setPriorityFilter('all')}
                bg={colors.surface}
                fg={colors.textSecondary}
                border={colors.border}
              >
                All ({totalClassFilteredBroken})
              </PriorityChipButton>
              {VISIBLE_PRIORITIES.map((p) => {
                const config = PRIORITY_DISPLAY[p];
                const Icon = config.icon;
                const count = priorityCounts[p] ?? 0;
                const isSelected = priorityFilter === p;
                return (
                  <PriorityChipButton
                    key={p}
                    selected={isSelected}
                    onClick={() => setPriorityFilter(p)}
                    bg={config.bg}
                    fg={config.fg}
                    border={config.border}
                    dim={count === 0}
                    icon={Icon ? <Icon size={12} stroke={2} /> : null}
                  >
                    {config.label} ({count})
                  </PriorityChipButton>
                );
              })}
            </Group>
          </Group>

        {/* mineUnavailable inline notice */}
        {mineUnavailable && (
          <Text size="sm" c={colors.textMuted} mb={8}>
            Connect your Jenkins account to see your failures — contact your
            admin.
          </Text>
        )}

        <Box
          style={{
            height: 1,
            background: `linear-gradient(90deg, ${colors.border}, transparent)`,
          }}
        />
      </Box>

      {/* ── Section A: Recently fixed ───────────────────────── */}
      {fixedGroups.length > 0 && (
        <Stack gap={12}>
          <SectionHeader variant="fixed" count={fixedGroups.length} />
          <Accordion variant="separated" radius="md" styles={ACCORDION_STYLES}>
            {fixedGroups.map((g) => (
              <FixedJobCard
                key={g.jobFullPath}
                group={g}
                isHovered={hovered === g.jobFullPath}
                onHover={bind(g.jobFullPath)}
                onVisible={enqueueDismissal}
              />
            ))}
          </Accordion>
        </Stack>
      )}

      {/* ── Section B: Building ─────────────────────────────── */}
      {buildingGroups.length > 0 && (
        <Stack gap={12}>
          <SectionHeader variant="building" count={buildingGroups.length} />
          <Accordion variant="separated" radius="md" styles={ACCORDION_STYLES}>
            {buildingGroups.map((g) => (
              <BrokenJobCard
                key={g.jobFullPath}
                group={g}
                isHovered={hovered === g.jobFullPath}
                onHover={bind(g.jobFullPath)}
              />
            ))}
          </Accordion>
        </Stack>
      )}

      {/* ── Section C: Failing ──────────────────────────────── */}
      <Stack gap={12}>
        {showSectionHeaders && (
          <SectionHeader variant="failing" count={brokenGroups.length} />
        )}

        {/* Positive empty state for Mine scope */}
        {showMinePositiveEmpty && (
          <Card radius="md" style={cardStyle} p={40}>
            <Text size="md" c={colors.success} ta="center">
              ✓ No failures in the last 14 days — nice work
            </Text>
          </Card>
        )}

        {/* Priority-specific empty state */}
        {!showMinePositiveEmpty &&
          brokenGroups.length === 0 &&
          priorityFilter !== 'all' && (
            <Card radius="md" style={cardStyle} p={40}>
              <Stack gap={4} align="center">
                <Text size="md" c={colors.textTertiary} ta="center">
                  {PRIORITY_EMPTY_STATES[priorityFilter].headline}
                </Text>
                <Text size="sm" c={colors.textMuted} ta="center">
                  {PRIORITY_EMPTY_STATES[priorityFilter].subline}
                </Text>
              </Stack>
            </Card>
          )}

        {/* Standard empty state for non-Mine or with class filter */}
        {!showMinePositiveEmpty &&
          brokenGroups.length === 0 &&
          priorityFilter === 'all' && (
            <Card radius="md" style={cardStyle} p={40}>
              <Text size="md" c={colors.success} ta="center">
                {classFilter === 'all'
                  ? 'No failures in the last 14 days.'
                  : `No ${classFilter} failures in the last 14 days.`}
              </Text>
            </Card>
          )}

        {brokenGroups.length > 0 && (
          <Accordion variant="separated" radius="md" styles={ACCORDION_STYLES}>
            {brokenGroups.map((g) => (
              <BrokenJobCard
                key={g.jobFullPath}
                group={g}
                isHovered={hovered === g.jobFullPath}
                onHover={bind(g.jobFullPath)}
              />
            ))}
          </Accordion>
        )}
      </Stack>
    </Stack>
  );
}
