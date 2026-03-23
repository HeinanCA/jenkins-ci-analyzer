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
  Anchor,
} from '@mantine/core';
import { tigDashboard, tigHealth } from '../../api/tig-client';
import { useAuthStore } from '../../store/auth-store';
import { colors, cardStyle } from '../../theme/mantine-theme';

const HEALTH_COLORS: Record<string, string> = {
  healthy: colors.success,
  degraded: colors.warning,
  unhealthy: colors.failure,
  down: '#ef4444',
};

export function DashboardPage() {
  const instanceId = useAuthStore((s) => s.instanceId);

  const summary = useQuery({
    queryKey: ['dashboard-summary', instanceId],
    queryFn: () => tigDashboard.summary(instanceId ?? undefined),
    refetchInterval: 30_000,
  });

  const failures = useQuery({
    queryKey: ['dashboard-failures', instanceId],
    queryFn: () => tigDashboard.failures(instanceId ?? undefined, 10),
    refetchInterval: 30_000,
  });

  const health = useQuery({
    queryKey: ['health-current', instanceId],
    queryFn: () => (instanceId ? tigHealth.current(instanceId) : null),
    enabled: !!instanceId,
    refetchInterval: 30_000,
  });

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

      {failures.data && failures.data.length > 0 && (
        <Stack gap="xs">
          <Text size="sm" fw={600} c={colors.textSecondary}>Recent failures</Text>
          {failures.data.map((f) => {
            const jobUrl = (f as Record<string, unknown>).jobUrl as string | undefined;
            const aiSummary = (f as Record<string, unknown>).aiSummary as string | undefined;
            return (
              <Card key={f.buildId} radius="md" style={cardStyle} p="sm">
                <Group justify="space-between" wrap="nowrap">
                  <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                    <Group gap="xs">
                      <Text size="sm" fw={500} c={colors.text} truncate>{f.jobName}</Text>
                      <Text size="xs" c={colors.textMuted}>#{f.buildNumber}</Text>
                      {jobUrl && (
                        <Anchor
                          href={`${jobUrl}${f.buildNumber}/`}
                          target="_blank"
                          size="xs"
                          c={colors.textMuted}
                          onClick={(e) => e.stopPropagation()}
                        >
                          Jenkins ↗
                        </Anchor>
                      )}
                    </Group>
                    {aiSummary && (
                      <Text size="xs" c={colors.textSecondary} lineClamp={1}>{aiSummary}</Text>
                    )}
                  </Stack>
                  {f.classification && (
                    <Badge
                      size="xs"
                      variant="light"
                      color={f.classification === 'infrastructure' ? 'red' : 'orange'}
                    >
                      {f.classification === 'infrastructure' ? 'Infra' : 'Code'}
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
