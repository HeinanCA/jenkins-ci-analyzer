import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Text,
  Badge,
  Loader,
  Code,
  Accordion,
  Select,
  List,
  Card,
  Group,
  SegmentedControl,
  Anchor,
  ActionIcon,
  Tooltip,
  CopyButton,
} from '@mantine/core';
import { tigDashboard, tigTeams } from '../../api/tig-client';
import { useAuthStore } from '../../store/auth-store';

const CARD = { backgroundColor: '#1e2030', border: 'none' };

type Filter = 'all' | 'code' | 'infrastructure';

interface FailureEntry {
  buildId: string;
  buildNumber: number;
  result: string;
  startedAt: string;
  durationMs: number;
  jobName: string;
  jobFullPath: string;
  classification: string | null;
  confidence: number | null;
  matches: unknown;
  [key: string]: unknown;
}

interface GroupedFailure {
  jobFullPath: string;
  jobName: string;
  latest: FailureEntry;
  streak: number;
  builds: FailureEntry[];
}

function groupByJob(failures: FailureEntry[]): GroupedFailure[] {
  const map = new Map<string, FailureEntry[]>();
  for (const f of failures) {
    const key = f.jobFullPath;
    const arr = map.get(key) ?? [];
    arr.push(f);
    map.set(key, arr);
  }

  const groups: GroupedFailure[] = [];
  for (const [path, builds] of map) {
    const sorted = builds.toSorted(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );
    groups.push({
      jobFullPath: path,
      jobName: sorted[0].jobName,
      latest: sorted[0],
      streak: sorted.length,
      builds: sorted,
    });
  }

  // Sort by streak (most failures first), then by latest time
  return groups.toSorted((a, b) => {
    if (b.streak !== a.streak) return b.streak - a.streak;
    return new Date(b.latest.startedAt).getTime() - new Date(a.latest.startedAt).getTime();
  });
}

function FailureDetail({ f }: { f: FailureEntry }) {
  const aiSummary = f.aiSummary as string | undefined;
  const aiRootCause = f.aiRootCause as string | undefined;
  const aiFixes = f.aiSuggestedFixes as Record<string, unknown> | undefined;
  const jobUrl = f.jobUrl as string | undefined;
  const hasAi = !!aiSummary;
  const fixes = Array.isArray(aiFixes?.fixes) ? aiFixes.fixes as string[] : [];
  const firstFix = fixes[0];
  const matches = Array.isArray(f.matches) ? f.matches as Record<string, unknown>[] : [];
  const primary = matches[0];
  const noisePercent = f.logNoisePercent as number | undefined;
  const topNoise = f.logTopNoise as string | undefined;

  return (
    <Stack gap="sm">
      {aiRootCause && (
        <Code block style={{ backgroundColor: '#161822', border: 'none', fontSize: 12 }}>
          {aiRootCause}
        </Code>
      )}

      {aiFixes?.failingTest && (
        <Text size="xs" c="#64748b">
          Test: <Text span c="#94a3b8" fw={500}>{String(aiFixes.failingTest)}</Text>
        </Text>
      )}
      {aiFixes?.filePath && (
        <Text size="xs" c="#64748b">
          File: <Text span c="#94a3b8">{String(aiFixes.filePath)}{aiFixes.lineNumber ? `:${aiFixes.lineNumber}` : ''}</Text>
        </Text>
      )}
      {aiFixes?.assertion && (
        <Text size="xs" c="#64748b">
          Assertion: <Text span c="#94a3b8">{String(aiFixes.assertion)}</Text>
        </Text>
      )}

      {fixes.length > 0 && (
        <Stack gap="xs">
          <Text size="xs" fw={600} c="#94a3b8">Fix:</Text>
          {firstFix && (
            <Group gap="xs">
              <Code style={{ backgroundColor: '#161822', border: 'none', fontSize: 11, flex: 1 }}>
                {firstFix}
              </Code>
              <CopyButton value={firstFix}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? 'Copied' : 'Copy command'}>
                    <ActionIcon size="xs" variant="subtle" color={copied ? 'green' : 'gray'} onClick={copy}>
                      <Text size="xs">{copied ? '✓' : '⎘'}</Text>
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            </Group>
          )}
          {fixes.length > 1 && (
            <List size="xs" type="ordered" styles={{ item: { color: '#64748b' } }}>
              {fixes.slice(1).map((step, i) => (
                <List.Item key={i}>{step}</List.Item>
              ))}
            </List>
          )}
        </Stack>
      )}

      {!hasAi && primary && (
        <Stack gap="xs">
          <Text size="xs" c="#94a3b8">{String(primary.description ?? '')}</Text>
          {primary.matchedLine && (
            <Code block style={{ backgroundColor: '#161822', border: 'none', fontSize: 11 }}>
              {String(primary.matchedLine)}
            </Code>
          )}
        </Stack>
      )}

      {noisePercent && noisePercent >= 30 && (
        <Text size="xs" c="#475569" style={{ fontStyle: 'italic' }}>
          💡 {noisePercent}% of this log is noise{topNoise ? ` (mostly ${topNoise})` : ''}
        </Text>
      )}

      {jobUrl && (
        <Anchor href={`${jobUrl}${f.buildNumber}/console`} target="_blank" size="xs" c="#475569">
          Open in Jenkins ↗
        </Anchor>
      )}
    </Stack>
  );
}

export function FailuresPage() {
  const instanceId = useAuthStore((s) => s.instanceId);
  const [filter, setFilter] = useState<Filter>('all');
  const [teamId, setTeamId] = useState<string | null>(null);

  const { data: teamsData } = useQuery({
    queryKey: ['teams'],
    queryFn: () => tigTeams.list(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['all-failures', instanceId, teamId],
    queryFn: () => tigDashboard.failures(instanceId ?? undefined, 50, teamId ?? undefined),
    refetchInterval: 30_000,
  });

  const allFailures = (data ?? []) as FailureEntry[];
  const filtered = filter === 'all'
    ? allFailures
    : allFailures.filter((f) => f.classification === filter);
  const grouped = useMemo(() => groupByJob(filtered), [filtered]);

  const codeJobs = useMemo(() => {
    const g = groupByJob(allFailures.filter((f) => f.classification === 'code'));
    return g.length;
  }, [allFailures]);
  const infraJobs = useMemo(() => {
    const g = groupByJob(allFailures.filter((f) => f.classification === 'infrastructure'));
    return g.length;
  }, [allFailures]);
  const totalJobs = useMemo(() => groupByJob(allFailures).length, [allFailures]);

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader color="blue" size="sm" />
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group gap="sm">
          <Title order={3} c="#e2e8f0">Failures</Title>
          {teamsData && teamsData.length > 0 && (
            <Select
              size="xs"
              placeholder="All teams"
              clearable
              value={teamId}
              onChange={setTeamId}
              data={teamsData.map((t) => ({ value: t.id, label: t.name }))}
              styles={{ input: { backgroundColor: '#1e2030', border: 'none', minWidth: 130 } }}
            />
          )}
        </Group>
        <SegmentedControl
          size="xs"
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
          data={[
            { label: `All (${totalJobs} jobs)`, value: 'all' },
            { label: `Code (${codeJobs})`, value: 'code' },
            { label: `Infra (${infraJobs})`, value: 'infrastructure' },
          ]}
          styles={{ root: { backgroundColor: '#1e2030' } }}
        />
      </Group>

      {grouped.length === 0 && (
        <Card radius="md" style={CARD} p="xl">
          <Text size="sm" c="#34d399" ta="center">
            {filter === 'all' ? 'No recent failures' : `No ${filter} failures`}
          </Text>
        </Card>
      )}

      {grouped.length > 0 && (
        <Accordion
          variant="separated"
          radius="md"
          styles={{
            item: { backgroundColor: '#1e2030', border: 'none' },
            control: { padding: '10px 14px' },
            panel: { padding: '0 14px 14px' },
          }}
        >
          {grouped.map((g) => {
            const f = g.latest;
            const aiSummary = f.aiSummary as string | undefined;
            const hasAi = !!aiSummary;

            return (
              <Accordion.Item key={g.jobFullPath} value={g.jobFullPath}>
                <Accordion.Control>
                  <Group justify="space-between" wrap="nowrap" style={{ width: '100%', paddingRight: 8 }}>
                    <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                      <Group gap="xs">
                        <Text size="sm" fw={500} c="#e2e8f0" truncate>{g.jobName}</Text>
                        {g.streak > 1 && (
                          <Badge size="xs" variant="filled" color="red">
                            {g.streak}× failed
                          </Badge>
                        )}
                      </Group>
                      {hasAi && (
                        <Text size="xs" c="#94a3b8" lineClamp={1}>{aiSummary}</Text>
                      )}
                    </Stack>
                    <Group gap={4}>
                      {f.classification && (
                        <Badge
                          size="xs"
                          variant="light"
                          color={f.classification === 'infrastructure' ? 'red' : 'orange'}
                        >
                          {f.classification === 'infrastructure' ? 'Infra' : 'Code'}
                        </Badge>
                      )}
                      {hasAi ? (
                        <Badge size="xs" variant="light" color="violet">AI</Badge>
                      ) : (
                        <Tooltip label="AI was offline. Classification may be inaccurate." multiline w={250}>
                          <Badge size="xs" variant="light" color="gray">regex</Badge>
                        </Tooltip>
                      )}
                    </Group>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="md">
                    {/* Latest build analysis */}
                    <FailureDetail f={f} />

                    {/* Older builds from same job */}
                    {g.builds.length > 1 && (
                      <Stack gap="xs">
                        <Text size="xs" c="#475569" fw={500}>
                          Previous failures ({g.builds.length - 1} more):
                        </Text>
                        {g.builds.slice(1).map((older) => (
                          <Card key={older.buildId} radius="sm" p="xs" style={{ backgroundColor: '#161822' }}>
                            <Group justify="space-between">
                              <Group gap="xs">
                                <Text size="xs" c="#64748b">#{older.buildNumber}</Text>
                                <Text size="xs" c="#475569">
                                  {new Date(older.startedAt).toLocaleString()}
                                </Text>
                              </Group>
                              {(older.aiSummary as string | undefined) && (
                                <Text size="xs" c="#64748b" lineClamp={1} style={{ flex: 1, textAlign: 'right' }}>
                                  {String(older.aiSummary)}
                                </Text>
                              )}
                            </Group>
                          </Card>
                        ))}
                      </Stack>
                    )}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            );
          })}
        </Accordion>
      )}
    </Stack>
  );
}
