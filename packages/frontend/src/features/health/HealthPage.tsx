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
        <Title order={2} c="gray.1">Health</Title>
        <Card withBorder radius="md" style={CARD_STYLE} p="xl">
          <Text size="sm" c="dimmed">No Jenkins instance configured.</Text>
        </Card>
      </Stack>
    );
  }

  if (current.isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader color="blue" />
        <Text size="sm" c="dimmed">Loading health data...</Text>
      </Stack>
    );
  }

  const h = current.data;

  if (!h) {
    return (
      <Stack gap="md">
        <Title order={2} c="gray.1">Health</Title>
        <Card withBorder radius="md" style={CARD_STYLE} p="xl">
          <Text size="sm" c="dimmed">Waiting for first health snapshot...</Text>
        </Card>
      </Stack>
    );
  }

  const color = HEALTH_COLORS[h.level] ?? '#475569';

  return (
    <Stack gap="lg">
      <Title order={2} c="gray.1">Jenkins Health</Title>

      <Box
        p="lg"
        style={{
          borderRadius: 12,
          border: `1px solid ${color}33`,
          background: `linear-gradient(135deg, ${color}08, transparent)`,
        }}
      >
        <Group justify="space-between">
          <Group gap="sm">
            <Box
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: color,
                boxShadow: `0 0 10px ${color}80`,
              }}
            />
            <Text size="lg" fw={600} c="gray.1">
              Jenkins is {h.level}
            </Text>
          </Group>
          <Text
            size="xl"
            fw={700}
            style={{ color }}
          >
            {h.score}/100
          </Text>
        </Group>
        {h.issues.length > 0 && (
          <Text size="sm" c="dimmed" mt="xs">
            {h.issues.join(' · ')}
          </Text>
        )}
      </Box>

      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <Card withBorder radius="md" style={CARD_STYLE}>
          <Text size="xs" c="dimmed" tt="uppercase" ls={1}>Agents</Text>
          <Group gap="xs" align="baseline" mt={4}>
            <Text size="xl" fw={700} c="gray.1">{h.agentsOnline}</Text>
            <Text size="sm" c="dimmed">/ {h.agentsTotal}</Text>
          </Group>
        </Card>
        <Card withBorder radius="md" style={CARD_STYLE}>
          <Text size="xs" c="dimmed" tt="uppercase" ls={1}>Executors</Text>
          <Group gap="xs" align="baseline" mt={4}>
            <Text size="xl" fw={700} c="gray.1">{h.executorsBusy}</Text>
            <Text size="sm" c="dimmed">/ {h.executorsTotal}</Text>
          </Group>
        </Card>
        <Card withBorder radius="md" style={CARD_STYLE}>
          <Text size="xs" c="dimmed" tt="uppercase" ls={1}>Queue</Text>
          <Text size="xl" fw={700} c={h.queueDepth > 10 ? '#f87171' : 'gray.1'} mt={4}>
            {h.queueDepth}
          </Text>
        </Card>
        <Card withBorder radius="md" style={CARD_STYLE}>
          <Text size="xs" c="dimmed" tt="uppercase" ls={1}>Stuck</Text>
          <Text size="xl" fw={700} c={h.stuckBuilds > 0 ? '#f87171' : '#34d399'} mt={4}>
            {h.stuckBuilds}
          </Text>
        </Card>
      </SimpleGrid>

      {history.data && history.data.length > 1 && (
        <div>
          <Title order={4} c="gray.2" mb="sm">Last Hour</Title>
          <Stack gap={4}>
            {history.data.slice(-12).map((s, i) => (
              <Group key={i} gap="sm" style={{ padding: '4px 0' }}>
                <Text size="xs" c="dimmed" w={80} style={{ fontFamily: 'monospace' }}>
                  {new Date(s.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Badge
                  size="xs"
                  variant="filled"
                  style={{ backgroundColor: HEALTH_COLORS[s.level] ?? '#475569' }}
                >
                  {s.score}
                </Badge>
                <Text size="xs" c="dimmed">
                  {s.agentsOnline}/{s.agentsTotal} agents · {s.queueDepth} queued
                </Text>
              </Group>
            ))}
          </Stack>
        </div>
      )}
    </Stack>
  );
}
