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

const CARD_STYLE = {
  backgroundColor: 'rgba(255, 255, 255, 0.03)',
  borderColor: 'rgba(255, 255, 255, 0.08)',
};

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
        <Loader color="blue" />
        <Text size="sm" c="dimmed">Loading dashboard...</Text>
      </Stack>
    );
  }

  const stats = summary.data;
  const h = health.data;

  return (
    <Stack gap="lg">
      <Title order={2} c="gray.1">Dashboard</Title>

      {h && (
        <Box
          p="md"
          style={{
            borderRadius: 12,
            border: `1px solid ${HEALTH_COLORS[h.level] ?? '#475569'}33`,
            background: `linear-gradient(135deg, ${HEALTH_COLORS[h.level] ?? '#475569'}08, transparent)`,
          }}
        >
          <Group justify="space-between">
            <Group gap="sm">
              <Box
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: HEALTH_COLORS[h.level] ?? '#475569',
                  boxShadow: `0 0 8px ${HEALTH_COLORS[h.level] ?? '#475569'}80`,
                }}
              />
              <Text size="sm" fw={600} c="gray.2">
                Jenkins is {h.level}
              </Text>
            </Group>
            <Group gap="md">
              <Text size="xs" c="dimmed">
                Score {h.score}/100
              </Text>
              <Text size="xs" c="dimmed">
                {h.agentsOnline}/{h.agentsTotal} agents
              </Text>
              <Text size="xs" c="dimmed">
                {h.queueDepth} queued
              </Text>
            </Group>
          </Group>
        </Box>
      )}

      {stats && (
        <SimpleGrid cols={{ base: 2, md: 4 }}>
          <Card withBorder radius="md" style={CARD_STYLE}>
            <Text size="xs" c="dimmed" tt="uppercase" ls={1}>Pipelines</Text>
            <Text size="xl" fw={700} c="gray.1" mt={4}>{stats.total}</Text>
          </Card>
          <Card withBorder radius="md" style={CARD_STYLE}>
            <Text size="xs" c="dimmed" tt="uppercase" ls={1}>Passing</Text>
            <Text size="xl" fw={700} c="#34d399" mt={4}>{stats.passing}</Text>
          </Card>
          <Card withBorder radius="md" style={CARD_STYLE}>
            <Text size="xs" c="dimmed" tt="uppercase" ls={1}>Failing</Text>
            <Text size="xl" fw={700} c="#f87171" mt={4}>{stats.failing}</Text>
          </Card>
          <Card withBorder radius="md" style={CARD_STYLE}>
            <Text size="xs" c="dimmed" tt="uppercase" ls={1}>Building</Text>
            <Text size="xl" fw={700} c="#60a5fa" mt={4}>{stats.building}</Text>
          </Card>
        </SimpleGrid>
      )}

      {failures.data && failures.data.length > 0 && (
        <div>
          <Title order={4} c="gray.2" mb="sm">Recent Failures</Title>
          <Stack gap="xs">
            {failures.data.map((f) => (
              <Card
                key={f.buildId}
                withBorder
                radius="md"
                style={{
                  ...CARD_STYLE,
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease',
                }}
              >
                <Group justify="space-between">
                  <div>
                    <Text size="sm" fw={500} c="gray.2">{f.jobName}</Text>
                    <Text size="xs" c="dimmed">
                      #{f.buildNumber} — {new Date(f.startedAt).toLocaleString()}
                    </Text>
                  </div>
                  <Group gap="xs">
                    {f.classification && (
                      <Badge
                        size="sm"
                        variant="light"
                        color={f.classification === 'infrastructure' ? 'red' : 'orange'}
                      >
                        {f.classification === 'infrastructure' ? 'Infra Issue' : 'Code Issue'}
                      </Badge>
                    )}
                    <Badge size="sm" variant="filled" color="red">
                      {f.result}
                    </Badge>
                  </Group>
                </Group>
              </Card>
            ))}
          </Stack>
        </div>
      )}

      {failures.data && failures.data.length === 0 && (
        <Card withBorder radius="md" style={CARD_STYLE} p="xl">
          <Stack align="center" gap="xs">
            <Text size="lg" c="#34d399">All builds passing</Text>
            <Text size="xs" c="dimmed">No recent failures to report.</Text>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
