import { useQuery } from "@tanstack/react-query";
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
  Badge,
} from "@mantine/core";
import { tigHealth } from "../../api/tig-client";
import { useAuthStore } from "../../store/auth-store";
import { colors, cardStyle, HEALTH_COLORS } from "../../theme/mantine-theme";
import { QueryError } from "../../shared/components/QueryError";

function HealthSparkline({
  data,
}: {
  data: { score: number; level: string; recordedAt: string }[];
}) {
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
            label={`${new Date(s.recordedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — ${s.level} (${s.score})`}
          >
            <Box
              style={{
                width: 6,
                height,
                backgroundColor: color,
                borderRadius: 2,
                transition: "height 0.3s ease",
              }}
            />
          </Tooltip>
        );
      })}
    </Group>
  );
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms <= 0) return "< 1m";
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function ExecutorTable({ instanceId }: { instanceId: string }) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["health-executors", instanceId],
    queryFn: () => tigHealth.executors(instanceId),
    enabled: !!instanceId,
    refetchInterval: 15_000,
  });

  return (
    <Card radius="md" style={cardStyle} p="md">
      <Text size="sm" fw={600} c={colors.text} mb="sm">
        Executors
      </Text>

      {isLoading && (
        <Stack align="center" py="sm">
          <Loader color="orange" size="xs" />
        </Stack>
      )}

      {isError && <QueryError message={error?.message} onRetry={refetch} />}

      {data && data.length === 0 && (
        <Text size="xs" c={colors.textTertiary}>
          No executors reported.
        </Text>
      )}

      {data && data.length > 0 && (
        <Stack gap={0}>
          {data.map((executor, i) => (
            <Group
              key={`${executor.agent}-${i}`}
              justify="space-between"
              align="center"
              py="xs"
              style={
                i < data.length - 1
                  ? { borderBottom: `1px solid ${colors.border}` }
                  : undefined
              }
            >
              {/* Agent */}
              <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                <Box
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: executor.offline
                      ? colors.failure
                      : colors.success,
                    flexShrink: 0,
                  }}
                />
                <Text size="sm" c={colors.text} truncate>
                  {executor.agent}
                </Text>
              </Group>

              {/* Status */}
              <Box style={{ flex: 2, minWidth: 0 }}>
                {executor.idle ? (
                  <Text size="sm" c={colors.textTertiary}>
                    Idle
                  </Text>
                ) : (
                  <Text size="sm" c={colors.text} truncate>
                    {executor.jobName}
                    {executor.buildNumber != null &&
                      ` #${executor.buildNumber}`}
                  </Text>
                )}
              </Box>

              {/* Duration + Stuck */}
              <Group gap="xs" justify="flex-end" style={{ flexShrink: 0 }}>
                {!executor.idle && (
                  <Text
                    size="sm"
                    c={executor.stuck ? colors.failure : colors.textSecondary}
                    fw={executor.stuck ? 600 : 400}
                  >
                    {formatDuration(executor.durationMs)}
                  </Text>
                )}
                {executor.stuck && (
                  <Badge
                    size="xs"
                    color="red"
                    variant="filled"
                    style={{
                      animation: "pulsci-pulse 2s ease-in-out infinite",
                    }}
                  >
                    STUCK
                  </Badge>
                )}
              </Group>
            </Group>
          ))}
        </Stack>
      )}
    </Card>
  );
}

function formatWaitTime(ms: number): string {
  if (ms <= 0) return "< 1m";
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes === 0) return "< 1m";
  return `${minutes}m`;
}

function QueueDetail({ instanceId }: { instanceId: string }) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["health-queue", instanceId],
    queryFn: () => tigHealth.queue(instanceId),
    enabled: !!instanceId,
    refetchInterval: 15_000,
  });

  return (
    <Card radius="md" style={cardStyle} p="md">
      <Text size="sm" fw={600} c={colors.text} mb="sm">
        Build Queue
      </Text>

      {isLoading && (
        <Stack align="center" py="sm">
          <Loader color="orange" size="xs" />
        </Stack>
      )}

      {isError && <QueryError message={error?.message} onRetry={refetch} />}

      {data && data.length === 0 && (
        <Text size="xs" c={colors.textTertiary}>
          Queue is empty
        </Text>
      )}

      {data && data.length > 0 && (
        <Stack gap={0}>
          {data.map((item, i) => (
            <Group
              key={item.id}
              justify="space-between"
              align="center"
              py="xs"
              style={
                i < data.length - 1
                  ? { borderBottom: `1px solid ${colors.border}` }
                  : undefined
              }
            >
              {/* Job name */}
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" c={colors.text} truncate>
                  {item.jobName}
                </Text>
              </Box>

              {/* Reason */}
              <Box style={{ flex: 2, minWidth: 0 }}>
                <Text size="xs" c={colors.textSecondary} truncate>
                  {item.reason}
                </Text>
              </Box>

              {/* Wait time + badges */}
              <Group gap="xs" justify="flex-end" style={{ flexShrink: 0 }}>
                <Text size="sm" c={colors.textSecondary}>
                  {formatWaitTime(item.waitingMs)}
                </Text>
                {item.stuck && (
                  <Badge
                    size="xs"
                    color="red"
                    variant="filled"
                    style={{
                      animation: "pulsci-pulse 2s ease-in-out infinite",
                    }}
                  >
                    STUCK
                  </Badge>
                )}
                {item.blocked && (
                  <Badge size="xs" color="red" variant="light">
                    BLOCKED
                  </Badge>
                )}
              </Group>
            </Group>
          ))}
        </Stack>
      )}
    </Card>
  );
}

export function HealthPage() {
  const instanceId = useAuthStore((s) => s.instanceId);

  const current = useQuery({
    queryKey: ["health-current", instanceId],
    queryFn: () => (instanceId ? tigHealth.current(instanceId) : null),
    enabled: !!instanceId,
    refetchInterval: 30_000,
  });

  const history = useQuery({
    queryKey: ["health-history", instanceId],
    queryFn: () => (instanceId ? tigHealth.history(instanceId, "1h") : null),
    enabled: !!instanceId,
    refetchInterval: 60_000,
  });

  if (!instanceId) {
    return (
      <Stack gap="md">
        <Title order={3} c={colors.text}>
          Health
        </Title>
        <Card radius="md" style={cardStyle} p="xl">
          <Text size="sm" c={colors.textTertiary}>
            No Jenkins instance configured.
          </Text>
        </Card>
      </Stack>
    );
  }

  if (current.isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader color="orange" size="sm" />
      </Stack>
    );
  }

  if (current.isError) {
    return (
      <QueryError message={current.error?.message} onRetry={current.refetch} />
    );
  }

  const h = current.data;

  if (!h) {
    return (
      <Stack gap="md">
        <Title order={3} c={colors.text}>
          Health
        </Title>
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
      <Title order={3} c={colors.text}>
        Jenkins Health
      </Title>

      <Card radius="md" style={cardStyle} p="md">
        <Group justify="space-between" align="center">
          <Group gap="sm">
            <Box
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
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

      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <Card radius="md" style={cardStyle} p="sm">
          <Text size="xs" c={colors.textTertiary}>
            Agents
          </Text>
          <Group gap={4} align="baseline">
            <Text size="lg" fw={700} c={colors.text}>
              {h.agentsOnline}
            </Text>
            <Text size="xs" c={colors.textMuted}>
              / {h.agentsTotal}
            </Text>
          </Group>
        </Card>
        <Card radius="md" style={cardStyle} p="sm">
          <Text size="xs" c={colors.textTertiary}>
            Executors
          </Text>
          <Group gap={4} align="baseline">
            <Text size="lg" fw={700} c={colors.text}>
              {h.executorsBusy}
            </Text>
            <Text size="xs" c={colors.textMuted}>
              / {h.executorsTotal}
            </Text>
          </Group>
        </Card>
        <Card radius="md" style={cardStyle} p="sm">
          <Text size="xs" c={colors.textTertiary}>
            Queue
          </Text>
          <Text
            size="lg"
            fw={700}
            c={h.queueDepth > 10 ? colors.failure : colors.text}
          >
            {h.queueDepth}
          </Text>
        </Card>
        <Card radius="md" style={cardStyle} p="sm">
          <Text size="xs" c={colors.textTertiary}>
            Stuck
          </Text>
          <Text
            size="lg"
            fw={700}
            c={h.stuckBuilds > 0 ? colors.failure : colors.success}
          >
            {h.stuckBuilds}
          </Text>
        </Card>
      </SimpleGrid>

      <ExecutorTable instanceId={instanceId} />
      <QueueDetail instanceId={instanceId} />
    </Stack>
  );
}
