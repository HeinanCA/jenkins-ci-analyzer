import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
} from "@mantine/core";
import { tigDashboard, tigHealth } from "../../api/tig-client";
import { useAuthStore } from "../../store/auth-store";
import {
  colors,
  cardStyle,
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
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <Card radius="md" style={cardStyle} p="md">
      <Text size="xs" c={colors.textTertiary} fw={500}>
        {label}
      </Text>
      <Text size="xl" fw={700} c={color ?? colors.text} mt={4}>
        {value}
      </Text>
    </Card>
  );
}

export function DashboardPage() {
  const instanceId = useAuthStore((s) => s.instanceId);

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
        <Card radius="md" style={cardStyle} p="sm">
          <Group gap="sm">
            <Box
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                backgroundColor: healthColor,
                boxShadow: `0 0 10px ${healthColor}60`,
              }}
            />
            <Text size="sm" c={colors.text} fw={500}>
              Jenkins is {h.level}
            </Text>
            <Text size="sm" c={colors.textTertiary}>
              {h.score}/100 · {h.agentsOnline}/{h.agentsTotal} agents ·{" "}
              {h.queueDepth} queued
            </Text>
          </Group>
        </Card>
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

            return (
              <Card
                key={g.jobFullPath}
                radius="md"
                style={{
                  ...cardStyle,
                  overflow: "hidden",
                  position: "relative",
                }}
                p={0}
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
