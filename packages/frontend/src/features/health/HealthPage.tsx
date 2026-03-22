import { useQuery } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Text,
  Alert,
  SimpleGrid,
  Card,
  Badge,
  Loader,
  Group,
} from '@mantine/core';
import { tigHealth } from '../../api/tig-client';
import { useAuthStore } from '../../store/auth-store';

export function HealthPage() {
  const instanceId = useAuthStore((s) => s.instanceId);

  const current = useQuery({
    queryKey: ['health-current', instanceId],
    queryFn: () => (instanceId ? tigHealth.current(instanceId) : null),
    enabled: !!instanceId,
    refetchInterval: 30_000,
  });

  const history = useQuery({
    queryKey: ['health-history', instanceId],
    queryFn: () => (instanceId ? tigHealth.history(instanceId, '1h') : null),
    enabled: !!instanceId,
    refetchInterval: 60_000,
  });

  if (!instanceId) {
    return (
      <Stack gap="md">
        <Title order={2}>Health</Title>
        <Alert color="yellow">No Jenkins instance configured.</Alert>
      </Stack>
    );
  }

  if (current.isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader />
        <Text size="sm" c="dimmed">Loading health data...</Text>
      </Stack>
    );
  }

  const h = current.data;

  if (!h) {
    return (
      <Stack gap="md">
        <Title order={2}>Health</Title>
        <Alert color="yellow">No health data yet. Waiting for first snapshot...</Alert>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Title order={2}>Jenkins Health</Title>

      <Alert
        color={
          h.level === 'healthy'
            ? 'green'
            : h.level === 'degraded'
              ? 'yellow'
              : 'red'
        }
        title={`Jenkins is ${h.level}`}
      >
        <Text size="sm">
          Score: {h.score}/100
          {h.issues.length > 0 && ` — ${h.issues.join(', ')}`}
        </Text>
      </Alert>

      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <Card withBorder>
          <Text size="xs" c="dimmed">Agents Online</Text>
          <Group gap="xs" align="baseline">
            <Text size="xl" fw={700}>{h.agentsOnline}</Text>
            <Text size="sm" c="dimmed">/ {h.agentsTotal}</Text>
          </Group>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed">Executors Busy</Text>
          <Group gap="xs" align="baseline">
            <Text size="xl" fw={700}>{h.executorsBusy}</Text>
            <Text size="sm" c="dimmed">/ {h.executorsTotal}</Text>
          </Group>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed">Queue Depth</Text>
          <Text size="xl" fw={700} c={h.queueDepth > 10 ? 'red' : undefined}>
            {h.queueDepth}
          </Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed">Stuck Builds</Text>
          <Text size="xl" fw={700} c={h.stuckBuilds > 0 ? 'red' : 'green'}>
            {h.stuckBuilds}
          </Text>
        </Card>
      </SimpleGrid>

      {history.data && history.data.length > 1 && (
        <div>
          <Title order={4} mb="sm">Last Hour</Title>
          <Stack gap="xs">
            {history.data.slice(-10).map((s, i) => (
              <Group key={i} gap="sm">
                <Text size="xs" c="dimmed" w={140}>
                  {new Date(s.recordedAt).toLocaleTimeString()}
                </Text>
                <Badge
                  size="xs"
                  color={s.level === 'healthy' ? 'green' : s.level === 'degraded' ? 'yellow' : 'red'}
                >
                  {s.score}
                </Badge>
                <Text size="xs" c="dimmed">
                  {s.agentsOnline}/{s.agentsTotal} agents, {s.queueDepth} queued
                </Text>
              </Group>
            ))}
          </Stack>
        </div>
      )}
    </Stack>
  );
}
