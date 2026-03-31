import { useQuery } from "@tanstack/react-query";
import {
  Stack,
  SimpleGrid,
  Card,
  Text,
  Group,
} from "@mantine/core";
import { tigHealth } from "../../api/tig-client";
import { useAuthStore } from "../../store/auth-store";
import { colors, cardStyle, HEALTH_COLORS } from "../../theme/mantine-theme";
import { PageHeader } from "../../shared/components/PageHeader";
import { LoadingState } from "../../shared/components/LoadingState";
import { QueryError } from "../../shared/components/QueryError";
import { MetricCard } from "../../shared/components/MetricCard";
import { StatusDot } from "../../shared/components/StatusDot";
import { REFETCH, THRESHOLDS } from "../../shared/constants";
import { HealthSparkline } from "./components/HealthSparkline";
import { ExecutorTable } from "./components/ExecutorTable";
import { QueueDetail } from "./components/QueueDetail";

function healthToStatus(level: string): "healthy" | "degraded" | "unhealthy" {
  if (level === "healthy") return "healthy";
  if (level === "degraded") return "degraded";
  return "unhealthy";
}

export function HealthPage() {
  const instanceId = useAuthStore((s) => s.instanceId);

  const current = useQuery({
    queryKey: ["health-current", instanceId],
    queryFn: () => (instanceId ? tigHealth.current(instanceId) : null),
    enabled: !!instanceId,
    refetchInterval: REFETCH.normal,
  });

  const history = useQuery({
    queryKey: ["health-history", instanceId],
    queryFn: () => (instanceId ? tigHealth.history(instanceId, "1h") : null),
    enabled: !!instanceId,
    refetchInterval: REFETCH.slow,
  });

  if (!instanceId) {
    return (
      <Stack gap="md">
        <PageHeader title="Health" />
        <Card radius="md" style={cardStyle} p="xl">
          <Text size="sm" c={colors.textTertiary}>
            No Jenkins instance configured.
          </Text>
        </Card>
      </Stack>
    );
  }

  if (current.isLoading) return <LoadingState />;

  if (current.isError) {
    return <QueryError message={current.error?.message} onRetry={current.refetch} />;
  }

  const h = current.data;

  if (!h) {
    return (
      <Stack gap="md">
        <PageHeader title="Health" />
        <Card radius="md" style={cardStyle} p="xl">
          <Text size="sm" c={colors.textTertiary}>
            Waiting for first health snapshot...
          </Text>
        </Card>
      </Stack>
    );
  }

  const color = HEALTH_COLORS[h.level] ?? colors.textMuted;

  return (
    <Stack gap="md">
      <PageHeader title="Jenkins Health" />

      {/* Score banner */}
      <Card radius="md" style={cardStyle} p="md">
        <Group justify="space-between" align="center">
          <Group gap="sm">
            <StatusDot status={healthToStatus(h.level)} size={10} glow />
            <Text size="md" fw={600} c={colors.text}>
              {h.level}
            </Text>
            <Text size="xl" fw={700} style={{ color }}>
              {h.score}
            </Text>
            <Text size="xs" c={colors.textMuted}>
              /100
            </Text>
          </Group>
          {history.data && <HealthSparkline data={history.data} />}
        </Group>
        {h.issues.length > 0 && (
          <Text size="xs" c={colors.textTertiary} mt="xs">
            {h.issues.join(" · ")}
          </Text>
        )}
      </Card>

      {/* Summary metrics */}
      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <MetricCard
          label="Agents"
          value={h.agentsOnline}
          suffix={`/ ${h.agentsTotal}`}
        />
        <MetricCard
          label="Executors"
          value={h.executorsBusy}
          suffix={`/ ${h.executorsTotal}`}
        />
        <MetricCard
          label="Queue"
          value={h.queueDepth}
          color={h.queueDepth > THRESHOLDS.highQueueDepth ? colors.failure : undefined}
        />
        <MetricCard
          label="Stuck"
          value={h.stuckBuilds}
          color={h.stuckBuilds > 0 ? colors.failure : colors.success}
        />
      </SimpleGrid>

      {/* Detail tables */}
      <ExecutorTable instanceId={instanceId} />
      <QueueDetail instanceId={instanceId} />
    </Stack>
  );
}
