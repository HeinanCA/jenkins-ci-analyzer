import { useQuery } from "@tanstack/react-query";
import { Stack, Card, Text, Group, Box, Badge } from "@mantine/core";
import { tigHealth } from "../../../api/tig-client";
import { colors, cardStyle } from "../../../theme/mantine-theme";
import { QueryError } from "../../../shared/components/QueryError";
import { LoadingState } from "../../../shared/components/LoadingState";
import { formatDuration } from "../../../shared/utils/formatting";
import { REFETCH } from "../../../shared/constants";

interface QueueDetailProps {
  readonly instanceId: string;
}

/**
 * Live build queue showing waiting jobs, reasons, and stuck/blocked badges.
 */
export function QueueDetail({ instanceId }: QueueDetailProps) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["health-queue", instanceId],
    queryFn: () => tigHealth.queue(instanceId),
    enabled: !!instanceId,
    refetchInterval: REFETCH.fast,
  });

  return (
    <Card radius="md" style={cardStyle} p="md">
      <Text size="sm" fw={600} c={colors.text} mb="sm">
        Build Queue
      </Text>

      {isLoading && <LoadingState />}
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
                  {formatDuration(item.waitingMs)}
                </Text>
                {item.stuck && (
                  <Badge
                    size="xs"
                    color="red"
                    variant="filled"
                    style={{ animation: "pulsci-pulse 2s ease-in-out infinite" }}
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
