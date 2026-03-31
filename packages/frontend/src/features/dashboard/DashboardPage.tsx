import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Stack,
  Title,
  Text,
  SimpleGrid,
  Card,
  Group,
  Badge,
  Loader,
  Box,
  Tooltip,
  Progress,
} from "@mantine/core";
import { tigDashboard, tigHealth } from "../../api/tig-client";
import { useAuthStore } from "../../store/auth-store";
import {
  colors,
  cardStyle,
  cardHoverStyle,
  metricStyle,
  HEALTH_COLORS,
  statusGradient,
} from "../../theme/mantine-theme";
import { QueryError } from "../../shared/components/QueryError";
import { groupByJob } from "../failures/utils/group-by-job";
import type { FailureEntry } from "../failures/types";

function StatCard({
  label,
  value,
  color,
  onClick,
}: {
  label: string;
  value: number;
  color?: string;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <Card
      radius="md"
      style={{
        ...(hovered ? cardHoverStyle : cardStyle),
        ...(onClick ? { cursor: "pointer" } : {}),
      }}
      p="md"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Text size="xs" c={colors.textTertiary} fw={500}>
        {label}
      </Text>
      <Text
        c={color ?? colors.text}
        mt={4}
        style={{ ...metricStyle, fontSize: 28 }}
      >
        {value}
      </Text>
    </Card>
  );
}

const RESULT_COLORS: Record<string, string> = {
  SUCCESS: "green",
  FAILURE: "red",
  UNSTABLE: "yellow",
  ABORTED: "gray",
};

function formatDuration(ms: number | null): string {
  if (ms === null || ms <= 0) return "--";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function shortenJobName(name: string): string {
  if (name.length <= 40) return name;
  const parts = name.split("/");
  if (parts.length <= 1) return `${name.slice(0, 37)}...`;
  return `.../${parts.slice(-2).join("/")}`;
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

function RunningBuildsCard({
  builds,
  isLoading,
}: {
  readonly builds: readonly RunningBuildEntry[];
  readonly isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card radius="md" style={cardStyle} p="md">
        <Group gap="xs">
          <Loader color="orange" size="xs" />
          <Text size="sm" c={colors.textSecondary}>
            Loading running builds...
          </Text>
        </Group>
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
          {builds.map((b) => (
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

function RecentBuildsCard({
  builds,
  isLoading,
  onNavigate,
}: {
  readonly builds: readonly RecentBuildEntry[];
  readonly isLoading: boolean;
  readonly onNavigate: (path: string) => void;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Card radius="md" style={cardStyle} p="md">
        <Group gap="xs">
          <Loader color="orange" size="xs" />
          <Text size="sm" c={colors.textSecondary}>
            Loading recent builds...
          </Text>
        </Group>
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
        {builds.map((b) => {
          const isFailed = b.result === "FAILURE" || b.result === "UNSTABLE";
          const isHovered = hoveredId === b.id;
          return (
            <Box
              key={b.id}
              p="xs"
              style={{
                borderRadius: 6,
                backgroundColor: isHovered
                  ? colors.surfaceHover
                  : "transparent",
                cursor: isFailed ? "pointer" : "default",
                transition: "background-color 0.15s ease",
              }}
              onClick={isFailed ? () => onNavigate("/failures") : undefined}
              onMouseEnter={() => setHoveredId(b.id)}
              onMouseLeave={() => setHoveredId(null)}
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

export function DashboardPage() {
  const instanceId = useAuthStore((s) => s.instanceId);
  const navigate = useNavigate();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const summary = useQuery({
    queryKey: ["dashboard-summary", instanceId],
    queryFn: () => tigDashboard.summary(instanceId ?? undefined),
    refetchInterval: 30_000,
  });

  const failures = useQuery({
    queryKey: ["dashboard-failures", instanceId],
    queryFn: () => tigDashboard.failures(instanceId ?? undefined, 20),
    refetchInterval: 30_000,
  });

  const health = useQuery({
    queryKey: ["health-current", instanceId],
    queryFn: () => (instanceId ? tigHealth.current(instanceId) : null),
    enabled: !!instanceId,
    refetchInterval: 30_000,
  });

  const runningBuilds = useQuery({
    queryKey: ["running-builds", instanceId],
    queryFn: () =>
      instanceId ? tigDashboard.runningBuilds(instanceId) : Promise.resolve([]),
    enabled: !!instanceId,
    refetchInterval: 10_000,
  });

  const recentBuilds = useQuery({
    queryKey: ["recent-builds"],
    queryFn: () => tigDashboard.recentBuilds(),
    refetchInterval: 30_000,
  });

  const grouped = useMemo(
    () => groupByJob((failures.data ?? []) as FailureEntry[]).slice(0, 8),
    [failures.data],
  );

  if (summary.isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader color="orange" size="sm" />
      </Stack>
    );
  }

  if (summary.isError) {
    return (
      <QueryError message={summary.error?.message} onRetry={summary.refetch} />
    );
  }

  const stats = summary.data;
  const h = health.data;
  const healthColor = h
    ? (HEALTH_COLORS[h.level] ?? colors.textMuted)
    : colors.textMuted;

  return (
    <Stack gap="lg">
      <Title order={3} c={colors.text}>
        Dashboard
      </Title>

      {h && (
        <Tooltip
          label={`Score ${h.score}/100 · ${h.agentsOnline}/${h.agentsTotal} agents · ${h.queueDepth} queued`}
          position="bottom-start"
          withArrow
        >
          <Badge
            size="lg"
            variant="filled"
            radius="xl"
            styles={{
              root: {
                backgroundColor: healthColor,
                cursor: "default",
                textTransform: "capitalize",
              },
            }}
          >
            {h.level}
          </Badge>
        </Tooltip>
      )}

      {stats && (
        <SimpleGrid cols={{ base: 2, md: 4 }}>
          <StatCard label="Pipelines" value={stats.total} />
          <StatCard
            label="Passing"
            value={stats.passing}
            color={colors.success}
          />
          <StatCard
            label="Failing"
            value={stats.failing}
            color={colors.failure}
            onClick={() => navigate("/failures")}
          />
          <StatCard
            label="Building"
            value={stats.building}
            color={colors.info}
          />
        </SimpleGrid>
      )}

      <RunningBuildsCard
        builds={runningBuilds.data ?? []}
        isLoading={runningBuilds.isLoading}
      />

      <RecentBuildsCard
        builds={recentBuilds.data ?? []}
        isLoading={recentBuilds.isLoading}
        onNavigate={navigate}
      />

      {grouped.length > 0 && (
        <Stack gap="sm">
          <Text size="sm" fw={600} c={colors.textSecondary}>
            Failing jobs
          </Text>
          {grouped.map((g) => {
            const aiSummary = g.latest.aiSummary as string | undefined;
            const isInfra = g.latest.classification === "infrastructure";
            const barColor = isInfra ? colors.failure : colors.warning;

            const isHovered = hoveredId === g.jobFullPath;
            return (
              <Card
                key={g.jobFullPath}
                radius="md"
                style={{
                  ...(isHovered ? cardHoverStyle : cardStyle),
                  overflow: "hidden",
                  position: "relative",
                  cursor: "pointer",
                }}
                p={0}
                onClick={() => navigate("/failures")}
                onMouseEnter={() => setHoveredId(g.jobFullPath)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* Gradient status bar */}
                <Box
                  style={{
                    height: 3,
                    background: statusGradient(barColor),
                  }}
                />
                <Box p="sm">
                  <Group justify="space-between" wrap="nowrap">
                    <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                      <Group gap="xs">
                        <Text size="sm" fw={500} c={colors.text} truncate>
                          {g.jobName}
                        </Text>
                        {g.streak > 1 && (
                          <Badge size="xs" variant="filled" color="red">
                            {g.streak}×
                          </Badge>
                        )}
                      </Group>
                      {aiSummary && (
                        <Text size="xs" c={colors.textSecondary} lineClamp={1}>
                          {aiSummary}
                        </Text>
                      )}
                    </Stack>
                    {g.latest.classification && (
                      <Badge
                        size="xs"
                        variant="light"
                        color={isInfra ? "red" : "orange"}
                      >
                        {isInfra ? "Infra" : "Code"}
                      </Badge>
                    )}
                  </Group>
                </Box>
              </Card>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
