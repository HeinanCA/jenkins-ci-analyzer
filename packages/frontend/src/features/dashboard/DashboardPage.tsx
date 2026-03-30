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
