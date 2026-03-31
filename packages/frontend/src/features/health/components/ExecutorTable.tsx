import { useQuery } from "@tanstack/react-query";
import { Stack, Card, Text, Group, Box, Badge } from "@mantine/core";
import { tigHealth } from "../../../api/tig-client";
import { colors, cardStyle } from "../../../theme/mantine-theme";
import { QueryError } from "../../../shared/components/QueryError";
import { LoadingState } from "../../../shared/components/LoadingState";
import { StatusDot } from "../../../shared/components/StatusDot";
import { formatDuration } from "../../../shared/utils/formatting";
import { REFETCH } from "../../../shared/constants";

interface ExecutorTableProps {
  readonly instanceId: string;
}

/**
 * Live executor list showing agent status, running job, and duration.
 */
export function ExecutorTable({ instanceId }: ExecutorTableProps) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["health-executors", instanceId],
    queryFn: () => tigHealth.executors(instanceId),
    enabled: !!instanceId,
    refetchInterval: REFETCH.fast,
  });

  return (
    <Card radius="md" style={cardStyle} p="md">
      <Text size="sm" fw={600} c={colors.text} mb="sm">
        Executors
      </Text>

      {isLoading && <LoadingState />}
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
                <StatusDot status={executor.offline ? "offline" : "online"} />
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
                    {executor.buildNumber != null && ` #${executor.buildNumber}`}
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
                    style={{ animation: "pulsci-pulse 2s ease-in-out infinite" }}
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
