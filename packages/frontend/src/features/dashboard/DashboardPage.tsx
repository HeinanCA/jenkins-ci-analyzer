import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Text,
  SimpleGrid,
  Card,
  Group,
  Badge,
  Loader,
  Box,
} from '@mantine/core';
import { tigDashboard, tigHealth } from '../../api/tig-client';
import { useAuthStore } from '../../store/auth-store';
import { colors, cardStyle, HEALTH_COLORS } from '../../theme/mantine-theme';
import { groupByJob } from '../failures/utils/group-by-job';
import type { FailureEntry } from '../failures/types';

export function DashboardPage() {
  const instanceId = useAuthStore((s) => s.instanceId);

  const summary = useQuery({
    queryKey: ['dashboard-summary', instanceId],
    queryFn: () => tigDashboard.summary(instanceId ?? undefined),
    refetchInterval: 30_000,
  });

  const failures = useQuery({
    queryKey: ['dashboard-failures', instanceId],
    queryFn: () => tigDashboard.failures(instanceId ?? undefined, 20),
    refetchInterval: 30_000,
  });

  const health = useQuery({
    queryKey: ['health-current', instanceId],
    queryFn: () => (instanceId ? tigHealth.current(instanceId) : null),
    enabled: !!instanceId,
    refetchInterval: 30_000,
  });

  const grouped = useMemo(
    () => groupByJob((failures.data ?? []) as FailureEntry[]).slice(0, 8),
    [failures.data],
  );

  if (summary.isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader color="violet" size="sm" />
      </Stack>
    );
  }

  const stats = summary.data;
  const h = health.data;

  return (
    <Stack gap="md">
      <Title order={3} c={colors.text}>Dashboard</Title>

      {h && (
        <Group gap="sm">
          <Box
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: HEALTH_COLORS[h.level] ?? colors.textMuted,
            }}
          />
          <Text size="sm" c={colors.textSecondary}>
            Jenkins {h.level} · {h.score}/100 · {h.agentsOnline}/{h.agentsTotal} agents · {h.queueDepth} queued
          </Text>
        </Group>
      )}

      {stats && (
        <SimpleGrid cols={{ base: 2, md: 4 }}>
          <Card radius="md" style={cardStyle} p="sm">
            <Text size="xs" c={colors.textTertiary}>Pipelines</Text>
            <Text size="lg" fw={700} c={colors.text}>{stats.total}</Text>
          </Card>
          <Card radius="md" style={cardStyle} p="sm">
            <Text size="xs" c={colors.textTertiary}>Passing</Text>
            <Text size="lg" fw={700} c={colors.success}>{stats.passing}</Text>
          </Card>
          <Card radius="md" style={cardStyle} p="sm">
            <Text size="xs" c={colors.textTertiary}>Failing</Text>
            <Text size="lg" fw={700} c={colors.failure}>{stats.failing}</Text>
          </Card>
          <Card radius="md" style={cardStyle} p="sm">
            <Text size="xs" c={colors.textTertiary}>Building</Text>
            <Text size="lg" fw={700} c={colors.info}>{stats.building}</Text>
          </Card>
        </SimpleGrid>
      )}

      {grouped.length > 0 && (
        <Stack gap="xs">
          <Text size="sm" fw={600} c={colors.textSecondary}>Failing jobs</Text>
          {grouped.map((g) => {
            const aiSummary = g.latest.aiSummary as string | undefined;
            return (
              <Card key={g.jobFullPath} radius="md" style={cardStyle} p="sm">
                <Group justify="space-between" wrap="nowrap">
                  <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                    <Group gap="xs">
                      <Text size="sm" fw={500} c={colors.text} truncate>{g.jobName}</Text>
                      {g.streak > 1 && (
                        <Badge size="xs" variant="filled" color="red">
                          {g.streak}×
                        </Badge>
                      )}
                    </Group>
                    {aiSummary && (
                      <Text size="xs" c={colors.textSecondary} lineClamp={1}>{aiSummary}</Text>
                    )}
                  </Stack>
                  {g.latest.classification && (
                    <Badge
                      size="xs"
                      variant="light"
                      color={g.latest.classification === 'infrastructure' ? 'red' : 'orange'}
                    >
                      {g.latest.classification === 'infrastructure' ? 'Infra' : 'Code'}
                    </Badge>
                  )}
                </Group>
              </Card>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
