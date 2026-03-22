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
  Alert,
} from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { tigDashboard, tigHealth } from '../../api/tig-client';
import { useAuthStore } from '../../store/auth-store';

export function DashboardPage() {
  const navigate = useNavigate();
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
        <Loader />
        <Text size="sm" c="dimmed">Loading dashboard...</Text>
      </Stack>
    );
  }

  const stats = summary.data;
  const healthData = health.data;

  return (
    <Stack gap="lg">
      <Title order={2}>Dashboard</Title>

      {healthData && (
        <Alert
          color={
            healthData.level === 'healthy'
              ? 'green'
              : healthData.level === 'degraded'
                ? 'yellow'
                : 'red'
          }
          title={`Jenkins is ${healthData.level}`}
        >
          <Text size="sm">
            Score: {healthData.score}/100 — {healthData.agentsOnline}/{healthData.agentsTotal} agents online, {healthData.queueDepth} in queue
          </Text>
        </Alert>
      )}

      {stats && (
        <SimpleGrid cols={{ base: 2, md: 4 }}>
          <Card withBorder>
            <Text size="xs" c="dimmed">Total Pipelines</Text>
            <Text size="xl" fw={700}>{stats.total}</Text>
          </Card>
          <Card withBorder>
            <Text size="xs" c="dimmed">Passing</Text>
            <Text size="xl" fw={700} c="green">{stats.passing}</Text>
          </Card>
          <Card withBorder>
            <Text size="xs" c="dimmed">Failing</Text>
            <Text size="xl" fw={700} c="red">{stats.failing}</Text>
          </Card>
          <Card withBorder>
            <Text size="xs" c="dimmed">Building</Text>
            <Text size="xl" fw={700} c="blue">{stats.building}</Text>
          </Card>
        </SimpleGrid>
      )}

      {failures.data && failures.data.length > 0 && (
        <div>
          <Title order={4} mb="sm">Recent Failures</Title>
          <Stack gap="xs">
            {failures.data.map((f) => (
              <Card key={f.buildId} withBorder style={{ cursor: 'pointer' }}>
                <Group justify="space-between">
                  <div>
                    <Text size="sm" fw={500}>{f.jobName}</Text>
                    <Text size="xs" c="dimmed">
                      #{f.buildNumber} — {new Date(f.startedAt).toLocaleString()}
                    </Text>
                  </div>
                  <Group gap="xs">
                    {f.classification && (
                      <Badge
                        size="sm"
                        color={f.classification === 'infrastructure' ? 'red' : 'orange'}
                      >
                        {f.classification === 'infrastructure' ? 'Infra' : 'Code'}
                      </Badge>
                    )}
                    <Badge size="sm" color="red">{f.result}</Badge>
                  </Group>
                </Group>
              </Card>
            ))}
          </Stack>
        </div>
      )}
    </Stack>
  );
}
