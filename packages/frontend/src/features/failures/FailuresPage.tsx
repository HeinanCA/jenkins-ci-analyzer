import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Stack,
  Text,
  Accordion,
  Select,
  Card,
  Group,
  SegmentedControl,
} from "@mantine/core";
import { tigDashboard, tigHealth, tigTeams } from "../../api/tig-client";
import { useAuthStore } from "../../store/auth-store";
import { colors, cardStyle, HEALTH_COLORS } from "../../theme/mantine-theme";
import { QueryError } from "../../shared/components/QueryError";
import { PageHeader } from "../../shared/components/PageHeader";
import { LoadingState } from "../../shared/components/LoadingState";
import { StatusDot } from "../../shared/components/StatusDot";
import { useHover } from "../../shared/hooks/use-hover";
import { REFETCH } from "../../shared/constants";
import { groupByJob } from "./utils/group-by-job";
import { FailureAccordionItem } from "./components/FailureAccordionItem";
import type { FailureEntry } from "./types";

type Filter = "all" | "code" | "infrastructure";

const FILTER_INPUT_STYLES = {
  input: { backgroundColor: colors.surface, border: "none", minWidth: 130 },
};

const ACCORDION_STYLES = {
  item: {
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
    overflow: "hidden" as const,
  },
  control: { padding: "10px 14px" },
  panel: { padding: "0 14px 14px" },
};

function healthToStatus(level: string): "healthy" | "degraded" | "unhealthy" {
  if (level === "healthy") return "healthy";
  if (level === "degraded") return "degraded";
  return "unhealthy";
}

function countByClassification(
  failures: readonly FailureEntry[],
  classification?: string,
) {
  const subset = classification
    ? failures.filter((f) => f.classification === classification)
    : failures;
  return groupByJob(subset).length;
}

export function FailuresPage() {
  const instanceId = useAuthStore((s) => s.instanceId);
  const [filter, setFilter] = useState<Filter>("all");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [authorFilter, setAuthorFilter] = useState<string | null>(null);
  const { hovered, bind } = useHover<string>();

  const healthQuery = useQuery({
    queryKey: ["health-current", instanceId],
    queryFn: () => (instanceId ? tigHealth.current(instanceId) : null),
    enabled: !!instanceId,
    refetchInterval: REFETCH.normal,
  });

  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary", instanceId],
    queryFn: () => tigDashboard.summary(instanceId ?? undefined),
    refetchInterval: REFETCH.normal,
  });

  const { data: teamsData } = useQuery({
    queryKey: ["teams"],
    queryFn: () => tigTeams.list(),
  });

  const { data: authorsData } = useQuery({
    queryKey: ["authors", instanceId],
    queryFn: () => tigDashboard.authors(instanceId ?? undefined),
  });

  const failuresQuery = useQuery({
    queryKey: ["all-failures", instanceId, teamId, authorFilter],
    queryFn: () =>
      tigDashboard.failures(
        instanceId ?? undefined,
        50,
        teamId ?? undefined,
        authorFilter ?? undefined,
      ),
    refetchInterval: REFETCH.normal,
  });

  const { data, isLoading } = failuresQuery;
  const allFailures = (data ?? []) as FailureEntry[];
  const filtered =
    filter === "all"
      ? allFailures
      : allFailures.filter((f) => f.classification === filter);
  const grouped = useMemo(() => groupByJob(filtered), [filtered]);

  const totalJobs = useMemo(
    () => countByClassification(allFailures),
    [allFailures],
  );
  const codeJobs = useMemo(
    () => countByClassification(allFailures, "code"),
    [allFailures],
  );
  const infraJobs = useMemo(
    () => countByClassification(allFailures, "infrastructure"),
    [allFailures],
  );

  if (isLoading) return <LoadingState />;

  if (failuresQuery.isError) {
    return (
      <QueryError
        message={failuresQuery.error?.message}
        onRetry={failuresQuery.refetch}
      />
    );
  }

  const leftContent = (
    <>
      {teamsData && teamsData.length > 0 && (
        <Select
          size="xs"
          placeholder="All teams"
          clearable
          value={teamId}
          onChange={setTeamId}
          data={teamsData.map((t) => ({ value: t.id, label: t.name }))}
          styles={FILTER_INPUT_STYLES}
        />
      )}
      {authorsData && authorsData.length > 0 && (
        <Select
          size="xs"
          placeholder="All authors"
          clearable
          value={authorFilter}
          onChange={setAuthorFilter}
          data={authorsData.map((a) => ({ value: a, label: a }))}
          styles={FILTER_INPUT_STYLES}
        />
      )}
    </>
  );

  const h = healthQuery.data;
  const healthColor = h
    ? (HEALTH_COLORS[h.level] ?? colors.textMuted)
    : undefined;
  const summary = summaryQuery.data;

  const titleSubtitle = summary
    ? `${summary.failing} failing / ${summary.total} total`
    : undefined;

  return (
    <Stack gap="md">
      {h && (
        <Group
          gap="sm"
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            backgroundColor:
              h.level !== "healthy" ? `${healthColor}11` : "transparent",
          }}
        >
          <StatusDot
            status={healthToStatus(h.level)}
            size={8}
            glow={h.level !== "healthy"}
          />
          <Text
            size="xs"
            fw={600}
            c={h.level === "healthy" ? colors.textTertiary : healthColor}
            tt="capitalize"
          >
            {h.level}
          </Text>
          <Text
            size="xs"
            c={colors.textMuted}
            style={{ fontFamily: "monospace" }}
          >
            {h.score}/100
          </Text>
          <Text size="xs" c={colors.textMuted}>
            {h.agentsOnline}/{h.agentsTotal} agents
          </Text>
          <Text size="xs" c={colors.textMuted}>
            {h.queueDepth} queued
          </Text>
          {h.level !== "healthy" && h.issues.length > 0 && (
            <Text size="xs" c={healthColor} style={{ marginLeft: "auto" }}>
              {h.issues[0]}
            </Text>
          )}
        </Group>
      )}

      <PageHeader
        title="Failures"
        leftContent={
          <Group gap="sm">
            {titleSubtitle && (
              <Text size="sm" c={colors.textTertiary}>
                {titleSubtitle}
              </Text>
            )}
            {leftContent}
          </Group>
        }
      >
        <SegmentedControl
          size="xs"
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
          data={[
            { label: `All (${totalJobs})`, value: "all" },
            { label: `Code (${codeJobs})`, value: "code" },
            { label: `Infra (${infraJobs})`, value: "infrastructure" },
          ]}
          styles={{ root: { backgroundColor: colors.surface } }}
        />
      </PageHeader>

      {grouped.length === 0 && (
        <Card radius="md" style={cardStyle} p="xl">
          <Text size="sm" c={colors.success} ta="center">
            {filter === "all" ? "No recent failures" : `No ${filter} failures`}
          </Text>
        </Card>
      )}

      {grouped.length > 0 && (
        <Accordion variant="separated" radius="md" styles={ACCORDION_STYLES}>
          {grouped.map((g) => (
            <FailureAccordionItem
              key={g.jobFullPath}
              group={g}
              isHovered={hovered === g.jobFullPath}
              onHover={bind(g.jobFullPath)}
            />
          ))}
        </Accordion>
      )}
    </Stack>
  );
}
