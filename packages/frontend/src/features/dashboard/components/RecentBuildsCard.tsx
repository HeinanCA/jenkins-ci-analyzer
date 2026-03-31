import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Stack, Card, Text, Group, Badge, Box } from "@mantine/core";
import { tigDashboard } from "../../../api/tig-client";
import { colors, cardStyle } from "../../../theme/mantine-theme";
import { LoadingState } from "../../../shared/components/LoadingState";
import { useHover } from "../../../shared/hooks/use-hover";
import { formatTimeAgo, shortenJobName } from "../../../shared/utils/formatting";
import { REFETCH, RESULT_COLORS } from "../../../shared/constants";

interface RecentBuildEntry {
  readonly id: string;
  readonly jobName: string;
  readonly jobFullPath: string;
  readonly buildNumber: number;
  readonly result: string;
  readonly startedAt: string;
  readonly durationMs: number;
  readonly triggeredBy: string | null;
}

export function RecentBuildsCard() {
  const navigate = useNavigate();
  const { hovered, bind } = useHover<string>();

  const { data: builds = [], isLoading } = useQuery({
    queryKey: ["recent-builds"],
    queryFn: () => tigDashboard.recentBuilds(),
    refetchInterval: REFETCH.normal,
  });

  if (isLoading) {
    return (
      <Card radius="md" style={cardStyle} p="md">
        <LoadingState />
      </Card>
    );
  }

  if (builds.length === 0) {
    return null;
  }

  return (
    <Card radius="md" style={cardStyle} p="md">
      <Text size="sm" fw={600} c={colors.textSecondary} mb="sm">
        Recent Builds
      </Text>
      <Stack gap={4}>
        {(builds as readonly RecentBuildEntry[]).map((b) => {
          const isFailed = b.result === "FAILURE" || b.result === "UNSTABLE";
          const isHovered = hovered === b.id;
          return (
            <Box
              key={b.id}
              p="xs"
              style={{
                borderRadius: 6,
                backgroundColor: isHovered ? colors.surfaceHover : "transparent",
                cursor: isFailed ? "pointer" : "default",
                transition: "background-color 0.15s ease",
              }}
              onClick={isFailed ? () => navigate("/failures") : undefined}
              {...bind(b.id)}
            >
              <Group justify="space-between" wrap="nowrap">
                <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                  <Badge
                    size="xs"
                    variant="filled"
                    color={RESULT_COLORS[b.result] ?? "gray"}
                  >
                    {b.result}
                  </Badge>
                  <Text size="sm" c={colors.text} truncate>
                    {shortenJobName(b.jobName)} #{b.buildNumber}
                  </Text>
                </Group>
                <Group gap="xs" wrap="nowrap">
                  {b.triggeredBy && (
                    <Text size="xs" c={colors.textTertiary} truncate>
                      {b.triggeredBy}
                    </Text>
                  )}
                  <Text size="xs" c={colors.textMuted}>
                    {formatTimeAgo(b.startedAt)}
                  </Text>
                </Group>
              </Group>
            </Box>
          );
        })}
      </Stack>
    </Card>
  );
}
