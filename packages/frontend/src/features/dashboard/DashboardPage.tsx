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

const CARD = { backgroundColor: '#1e2030', border: 'none' };

const HEALTH_COLORS: Record<string, string> = {
  healthy: '#34d399',
  degraded: '#fbbf24',
  unhealthy: '#f87171',
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
        <Loader color="blue" size="sm" />
      </Stack>
    );
  }

  const stats = summary.data;
  const h = health.data;

  return (
    <Stack gap="md">
      <Title order={3} c="#e2e8f0">Dashboard</Title>

      {h && (
        <Group gap="sm">
          <Box
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: HEALTH_COLORS[h.level] ?? '#475569',
            }}
          />
          <Text size="sm" c="#94a3b8">
            Jenkins {h.level} · {h.score}/100 · {h.agentsOnline}/{h.agentsTotal} agents · {h.queueDepth} queued
          </Text>
        </Group>
      )}

      {stats && (
        <SimpleGrid cols={{ base: 2, md: 4 }}>
          <Card radius="md" style={CARD} p="sm">
            <Text size="xs" c="#64748b">Pipelines</Text>
            <Text size="lg" fw={700} c="#e2e8f0">{stats.total}</Text>
          </Card>
          <Card radius="md" style={CARD} p="sm">
            <Text size="xs" c="#64748b">Passing</Text>
            <Text size="lg" fw={700} c="#34d399">{stats.passing}</Text>
          </Card>
          <Card radius="md" style={CARD} p="sm">
            <Text size="xs" c="#64748b">Failing</Text>
            <Text size="lg" fw={700} c="#f87171">{stats.failing}</Text>
          </Card>
          <Card radius="md" style={CARD} p="sm">
            <Text size="xs" c="#64748b">Building</Text>
            <Text size="lg" fw={700} c="#60a5fa">{stats.building}</Text>
          </Card>
        </SimpleGrid>
      )}

      {failures.data && failures.data.length > 0 && (
        <Stack gap="xs">
          <Text size="sm" fw={600} c="#94a3b8">Recent failures</Text>
          {failures.data.map((f) => {
            const jobUrl = (f as Record<string, unknown>).jobUrl as string | undefined;
            const aiSummary = (f as Record<string, unknown>).aiSummary as string | undefined;
            return (
              <Card key={f.buildId} radius="md" style={CARD} p="sm">
                <Group justify="space-between" wrap="nowrap">
                  <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                    <Group gap="xs">
                      <Text size="sm" fw={500} c="#e2e8f0" truncate>{f.jobName}</Text>
                      <Text size="xs" c="#475569">#{f.buildNumber}</Text>
                      {jobUrl && (
                        <Anchor
                          href={`${jobUrl}${f.buildNumber}/`}
                          target="_blank"
                          size="xs"
                          c="#475569"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Jenkins ↗
                        </Anchor>
                      )}
                    </Group>
                    {aiSummary && (
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
                  </Group>
                </Group>
              </Card>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
