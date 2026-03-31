import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Stack, SimpleGrid, Badge, Tooltip } from "@mantine/core";
import { tigDashboard, tigHealth } from "../../api/tig-client";
import { useAuthStore } from "../../store/auth-store";
import { colors, HEALTH_COLORS } from "../../theme/mantine-theme";
import { QueryError } from "../../shared/components/QueryError";
import { PageHeader } from "../../shared/components/PageHeader";
import { LoadingState } from "../../shared/components/LoadingState";
import { MetricCard } from "../../shared/components/MetricCard";
import { REFETCH } from "../../shared/constants";
import { groupByJob } from "../failures/utils/group-by-job";
import type { FailureEntry } from "../failures/types";
import { RunningBuildsCard } from "./components/RunningBuildsCard";
import { RecentBuildsCard } from "./components/RecentBuildsCard";
import { FailingJobsCard } from "./components/FailingJobsCard";

export function DashboardPage() {
  const instanceId = useAuthStore((s) => s.instanceId);
  const navigate = useNavigate();

  const summary = useQuery({
    queryKey: ["dashboard-summary", instanceId],
    queryFn: () => tigDashboard.summary(instanceId ?? undefined),
    refetchInterval: REFETCH.normal,
  });

  const failures = useQuery({
    queryKey: ["dashboard-failures", instanceId],
    queryFn: () => tigDashboard.failures(instanceId ?? undefined, 20),
    refetchInterval: REFETCH.normal,
  });

  const health = useQuery({
    queryKey: ["health-current", instanceId],
    queryFn: () => (instanceId ? tigHealth.current(instanceId) : null),
    enabled: !!instanceId,
    refetchInterval: REFETCH.normal,
  });

  const grouped = useMemo(
    () => groupByJob((failures.data ?? []) as FailureEntry[]).slice(0, 8),
    [failures.data],
  );

  if (summary.isLoading) {
    return <LoadingState />;
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
      <PageHeader title="Dashboard">
        {h && (
          <Tooltip
            label={`Score ${h.score}/100 \u00B7 ${h.agentsOnline}/${h.agentsTotal} agents \u00B7 ${h.queueDepth} queued`}
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
      </PageHeader>

      {stats && (
        <SimpleGrid cols={{ base: 2, md: 4 }}>
          <MetricCard label="Pipelines" value={stats.total} />
          <MetricCard
            label="Passing"
            value={stats.passing}
            color={colors.success}
          />
          <MetricCard
            label="Failing"
            value={stats.failing}
            color={colors.failure}
            onClick={() => navigate("/failures")}
          />
          <MetricCard
            label="Building"
            value={stats.building}
            color={colors.info}
          />
        </SimpleGrid>
      )}

      {instanceId && <RunningBuildsCard instanceId={instanceId} />}

      <RecentBuildsCard />

      <FailingJobsCard data={grouped} />
    </Stack>
  );
}
