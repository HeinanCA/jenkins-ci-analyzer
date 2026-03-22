import { useQuery } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Text,
  SimpleGrid,
  Card,
  Badge,
  Loader,
  Group,
  Box,
} from '@mantine/core';
import { tigHealth } from '../../api/tig-client';
import { useAuthStore } from '../../store/auth-store';

const CARD = { backgroundColor: '#1e2030', border: 'none' };

const HEALTH_COLORS: Record<string, string> = {
  healthy: '#34d399',
  degraded: '#fbbf24',
  unhealthy: '#f87171',
  down: '#ef4444',
};

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
        <Title order={3} c="#e2e8f0">Health</Title>
        <Card radius="md" style={CARD} p="xl">
          <Text size="sm" c="#64748b">No Jenkins instance configured.</Text>
        </Card>
      </Stack>
    );
  }

  if (current.isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader color="blue" size="sm" />
      </Stack>
    );
  }

  const h = current.data;

  if (!h) {
    return (
      <Stack gap="md">
        <Title order={3} c="#e2e8f0">Health</Title>
        <Card radius="md" style={CARD} p="xl">
          <Text size="sm" c="#64748b">Waiting for first health snapshot...</Text>
        </Card>
      </Stack>
    );
  }

  const color = HEALTH_COLORS[h.level] ?? '#475569';

  return (
    <Stack gap="md">
      <Title order={3} c="#e2e8f0">Jenkins Health</Title>

      <Group gap="sm">
        <Box
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: color,
          }}
        />
        <Text size="sm" fw={600} c="#e2e8f0">
          {h.level}
        </Text>
        <Text size="lg" fw={700} style={{ color }}>
          {h.score}
        </Text>
        <Text size="xs" c="#475569">/100</Text>
        {h.issues.length > 0 && (
          <Text size="xs" c="#64748b">— {h.issues.join(' · ')}</Text>
        )}
      </Group>

      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <Card radius="md" style={CARD} p="sm">
          <Text size="xs" c="#64748b">Agents</Text>
          <Group gap={4} align="baseline">
            <Text size="lg" fw={700} c="#e2e8f0">{h.agentsOnline}</Text>
            <Text size="xs" c="#475569">/ {h.agentsTotal}</Text>
          </Group>
        </Card>
        <Card radius="md" style={CARD} p="sm">
          <Text size="xs" c="#64748b">Executors</Text>
          <Group gap={4} align="baseline">
            <Text size="lg" fw={700} c="#e2e8f0">{h.executorsBusy}</Text>
            <Text size="xs" c="#475569">/ {h.executorsTotal}</Text>
          </Group>
        </Card>
        <Card radius="md" style={CARD} p="sm">
          <Text size="xs" c="#64748b">Queue</Text>
          <Text size="lg" fw={700} c={h.queueDepth > 10 ? '#f87171' : '#e2e8f0'}>
            {h.queueDepth}
          </Text>
        </Card>
        <Card radius="md" style={CARD} p="sm">
          <Text size="xs" c="#64748b">Stuck</Text>
          <Text size="lg" fw={700} c={h.stuckBuilds > 0 ? '#f87171' : '#34d399'}>
            {h.stuckBuilds}
          </Text>
        </Card>
      </SimpleGrid>

      {history.data && history.data.length > 1 && (
        <Stack gap="xs">
          <Text size="sm" fw={600} c="#94a3b8">Last hour</Text>
          {history.data.slice(-10).map((s, i) => (
            <Group key={i} gap="sm">
              <Text size="xs" c="#475569" w={60} style={{ fontFamily: 'monospace' }}>
                {new Date(s.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <Badge
                size="xs"
                variant="filled"
                style={{ backgroundColor: HEALTH_COLORS[s.level] ?? '#475569', minWidth: 28 }}
              >
                {s.score}
              </Badge>
              <Text size="xs" c="#475569">
                {s.agentsOnline}/{s.agentsTotal} agents · {s.queueDepth} queued
              </Text>
            </Group>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
