import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Stack,
  Title,
  Text,
  Accordion,
  Select,
  Card,
  Group,
  SegmentedControl,
} from "@mantine/core";
import { tigDashboard, tigTeams } from "../../api/tig-client";
import { useAuthStore } from "../../store/auth-store";
import { colors, cardStyle } from "../../theme/mantine-theme";
import { QueryError } from "../../shared/components/QueryError";
import { LoadingState } from "../../shared/components/LoadingState";
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
  control: { padding: "14px 16px" },
  panel: { padding: "0 14px 14px" },
};

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

  const summary = summaryQuery.data;

  return (
    <Stack gap={24}>
      {/* Row 1: Title + failure count */}
      <Stack gap={8}>
        <Group gap="sm" align="baseline">
          <Title order={2} c={colors.text}>
            Failures
          </Title>
          {summary && (
            <Group gap={4}>
              <Text size="sm" c={colors.failure} fw={600}>
                {summary.failing} failing
              </Text>
              <Text size="sm" c={colors.textTertiary}>
                / {summary.total} total
              </Text>
            </Group>
          )}
        </Group>

        {/* Row 2: Filters */}
        <Group
          gap="sm"
          pb={12}
          style={{ borderBottom: `1px solid ${colors.border}` }}
        >
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
        </Group>
      </Stack>

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
