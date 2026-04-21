import { useQuery } from "@tanstack/react-query";
import { Stack, Card, Text, Group, Box, Badge, Alert } from "@mantine/core";
import { tigHealth } from "../../../api/tig-client";
import { colors, cardStyle } from "../../../theme/mantine-theme";
import { QueryError } from "../../../shared/components/QueryError";
import { LoadingState } from "../../../shared/components/LoadingState";
import { formatDuration } from "../../../shared/utils/formatting";
import { REFETCH } from "../../../shared/constants";

interface QueueDetailProps {
  readonly instanceId: string;
}

function diagnoseStuck(reason: string): string {
  const r = reason.toLowerCase();
  if (r.includes("offline"))
    return "Agent is offline — no executor available for this build.";
  if (r.includes("no nodes with the label") || r.includes("there are no nodes"))
    return "No agent has the required label. Check your node configuration.";
  if (r.includes("all nodes") && r.includes("offline"))
    return "All agents with the required label are offline.";
  if (r.includes("waiting for next available executor"))
    return "All executors are busy. Build is waiting for a free slot.";
  if (
    r.includes("already in progress") ||
    r.includes("waiting for it to finish")
  )
    return "Blocked by a concurrency limit — another build must finish first.";
  if (r.includes("upstream") || r.includes("downstream"))
    return "Blocked by an upstream/downstream build dependency.";
  if (r.includes("throttl"))
    return "Throttled — too many concurrent builds of this job.";
  return "Jenkins marked this build as stuck. Check agent availability.";
}

/**
 * Live build queue showing waiting jobs, reasons, and stuck/blocked badges.
 * Scan-triggered items are suppressed but counted in a spike banner.
 */
export function QueueDetail({ instanceId }: QueueDetailProps) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["health-queue", instanceId],
    queryFn: () => tigHealth.queue(instanceId),
    enabled: !!instanceId,
    refetchInterval: REFETCH.fast,
  });

  const items = data?.items ?? [];
  const scanCount = data?.scanCount ?? 0;
  const scanReasons = data?.scanReasons ?? [];

  return (
    <Card radius="md" style={cardStyle} p="md">
      <Text size="sm" fw={600} c={colors.text} mb="sm">
        Build Queue
      </Text>

      {isLoading && <LoadingState />}
      {isError && <QueryError message={error?.message} onRetry={refetch} />}

      {/* Scan spike banner */}
      {scanCount > 0 && (
        <Alert
          mb="sm"
          radius="md"
          styles={{
            root: {
              backgroundColor: "rgba(255, 176, 0, 0.08)",
              border: `1px solid rgba(255, 176, 0, 0.3)`,
            },
            title: { color: colors.warning, fontWeight: 600 },
            message: { color: colors.textSecondary },
          }}
          title={`⚠ Branch scan spike — ${scanCount} scan ${scanCount === 1 ? "job" : "jobs"} queued`}
        >
          <Stack gap={2}>
            <Text size="xs" c={colors.textSecondary}>
              Jenkins triggered a wave of multibranch pipeline scans. This can
              be caused by a webhook storm, a scheduled scan firing across all
              pipelines simultaneously, or a Jenkins restart.
            </Text>
            {scanReasons.length > 0 && (
              <Stack gap={2} mt={4}>
                {scanReasons.map((r, i) => (
                  <Text
                    key={i}
                    size="xs"
                    c={colors.textTertiary}
                    style={{ fontFamily: "monospace" }}
                  >
                    · {r}
                  </Text>
                ))}
              </Stack>
            )}
          </Stack>
        </Alert>
      )}

      {data && items.length === 0 && scanCount === 0 && (
        <Text size="xs" c={colors.textTertiary}>
          Queue is empty
        </Text>
      )}

      {data && items.length === 0 && scanCount > 0 && (
        <Text size="xs" c={colors.textTertiary}>
          No real builds waiting — only scan jobs.
        </Text>
      )}

      {items.length > 0 && (
        <Stack gap={0}>
          {items.map((item, i) => (
            <Box
              key={item.id}
              py="sm"
              style={
                i < items.length - 1
                  ? { borderBottom: `1px solid ${colors.border}` }
                  : undefined
              }
            >
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                {/* Job name */}
                <Text
                  size="sm"
                  c={colors.text}
                  style={{ flex: "0 0 auto", maxWidth: "35%" }}
                  truncate
                >
                  {item.jobName}
                </Text>

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

              {/* Reason — highlighted red + diagnosis for stuck items */}
              <Text
                size="xs"
                c={item.stuck ? colors.failure : colors.textSecondary}
                mt={2}
                style={{ fontStyle: "italic" }}
              >
                {item.reason}
              </Text>
              {item.stuck && (
                <Text size="xs" c={colors.warning} mt={2} fw={500}>
                  {diagnoseStuck(item.reason)}
                </Text>
              )}
            </Box>
          ))}
        </Stack>
      )}
    </Card>
  );
}
