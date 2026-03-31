import { useQuery } from "@tanstack/react-query";
import { Stack, Card, Text, Group, Box, Progress } from "@mantine/core";
import { tigDashboard } from "../../../api/tig-client";
import { colors, cardStyle } from "../../../theme/mantine-theme";
import { LoadingState } from "../../../shared/components/LoadingState";
import { formatDuration } from "../../../shared/utils/formatting";
import { REFETCH } from "../../../shared/constants";

interface RunningBuildsCardProps {
  readonly instanceId: string;
}

interface RunningBuildEntry {
  readonly jobName: string;
  readonly jobUrl: string;
  readonly buildNumber: number;
  readonly startedAt: string;
  readonly durationMs: number;
  readonly estimatedMs: number;
  readonly progress: number;
}

export function RunningBuildsCard({ instanceId }: RunningBuildsCardProps) {
  const { data: builds = [], isLoading } = useQuery({
    queryKey: ["running-builds", instanceId],
    queryFn: () => tigDashboard.runningBuilds(instanceId),
    refetchInterval: REFETCH.fast,
  });

  if (isLoading) {
    return (
      <Card radius="md" style={cardStyle} p="md">
        <LoadingState />
      </Card>
    );
  }

  return (
    <Card radius="md" style={cardStyle} p="md">
      <Text size="sm" fw={600} c={colors.textSecondary} mb="sm">
        Running Builds
      </Text>
      {builds.length === 0 ? (
        <Text size="sm" c={colors.textMuted}>
          No builds running
        </Text>
      ) : (
        <Stack gap="sm">
          {(builds as readonly RunningBuildEntry[]).map((b) => (
            <Box key={`${b.jobName}-${b.buildNumber}`}>
              <Group justify="space-between" mb={4}>
                <Text size="sm" c={colors.text} fw={500} truncate>
                  {b.jobName} #{b.buildNumber}
                </Text>
                <Text size="xs" c={colors.textTertiary}>
                  {formatDuration(b.durationMs)}
                </Text>
              </Group>
              <Progress
                value={b.progress}
                color={colors.accent}
                size="sm"
                radius="xl"
                aria-label={`Build progress: ${b.progress}%`}
              />
            </Box>
          ))}
        </Stack>
      )}
    </Card>
  );
}
