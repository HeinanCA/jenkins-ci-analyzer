import { useQuery } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Text,
  SimpleGrid,
  Card,
  Loader,
  Group,
  Box,
  Tooltip,
} from '@mantine/core';
import { tigHealth } from '../../api/tig-client';
import { useAuthStore } from '../../store/auth-store';
import { colors, cardStyle } from '../../theme/mantine-theme';

const HEALTH_COLORS: Record<string, string> = {
  healthy: colors.success,
  degraded: colors.warning,
  unhealthy: colors.failure,
  down: '#ef4444',
};

function HealthSparkline({ data }: { data: { score: number; level: string; recordedAt: string }[] }) {
  if (data.length < 2) return null;
  const maxScore = 100;

  return (
    <Group gap={1} align="flex-end" h={40}>
      {data.slice(-30).map((s, i) => {
        const height = Math.max(2, (s.score / maxScore) * 40);
        const color = HEALTH_COLORS[s.level] ?? colors.textMuted;
        return (
          <Tooltip
            key={i}
            label={`${new Date(s.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — ${s.level} (${s.score})`}
          >
            <Box
              style={{
                width: 6,
                height,
                backgroundColor: color,
                borderRadius: 2,
                transition: 'height 0.3s ease',
              }}
            />
          </Tooltip>
        );
      })}
    </Group>
  );
}

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
        <Title order={3} c={colors.text}>Health</Title>
        <Card radius="md" style={cardStyle} p="xl">
          <Text size="sm" c={colors.textTertiary}>No Jenkins instance configured.</Text>
        </Card>
      </Stack>
    );
  }

  if (current.isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader color="violet" size="sm" />
      </Stack>
    );
  }

  const h = current.data;

  if (!h) {
    return (
      <Stack gap="md">
        <Title order={3} c={colors.text}>Health</Title>
        <Card radius="md" style={cardStyle} p="xl">
          <Text size="sm" c={colors.textTertiary}>Waiting for first health snapshot...</Text>
        </Card>
      </Stack>
    );
  }

  const color = HEALTH_COLORS[h.level] ?? colors.textMuted;

  return (
    <Stack gap="md">
      <Title order={3} c={colors.text}>Jenkins Health</Title>

      <Card radius="md" style={cardStyle} p="md">
        <Group justify="space-between" align="center">
          <Group gap="sm">
            <Box
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: color,
                boxShadow: `0 0 8px ${color}80`,
              }}
            />
            <Text size="md" fw={600} c={colors.text}>
              {h.level}
            </Text>
            <Text size="xl" fw={700} style={{ color }}>
              {h.score}
            </Text>
            <Text size="xs" c={colors.textMuted}>/100</Text>
          </Group>
          {history.data && <HealthSparkline data={history.data} />}
        </Group>
        {h.issues.length > 0 && (
          <Text size="xs" c={colors.textTertiary} mt="xs">{h.issues.join(' · ')}</Text>
        )}
      </Card>

      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <Card radius="md" style={cardStyle} p="sm">
          <Text size="xs" c={colors.textTertiary}>Agents</Text>
          <Group gap={4} align="baseline">
            <Text size="lg" fw={700} c={colors.text}>{h.agentsOnline}</Text>
            <Text size="xs" c={colors.textMuted}>/ {h.agentsTotal}</Text>
          </Group>
        </Card>
        <Card radius="md" style={cardStyle} p="sm">
          <Text size="xs" c={colors.textTertiary}>Executors</Text>
          <Group gap={4} align="baseline">
            <Text size="lg" fw={700} c={colors.text}>{h.executorsBusy}</Text>
            <Text size="xs" c={colors.textMuted}>/ {h.executorsTotal}</Text>
          </Group>
        </Card>
        <Card radius="md" style={cardStyle} p="sm">
          <Text size="xs" c={colors.textTertiary}>Queue</Text>
          <Text size="lg" fw={700} c={h.queueDepth > 10 ? colors.failure : colors.text}>
            {h.queueDepth}
          </Text>
        </Card>
        <Card radius="md" style={cardStyle} p="sm">
          <Text size="xs" c={colors.textTertiary}>Stuck</Text>
          <Text size="lg" fw={700} c={h.stuckBuilds > 0 ? colors.failure : colors.success}>
            {h.stuckBuilds}
          </Text>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}
