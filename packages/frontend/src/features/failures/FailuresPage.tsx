import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Stack,
  Title,
  Text,
  Badge,
  Loader,
  Accordion,
  Select,
  Card,
  Group,
  Box,
  SegmentedControl,
  Tooltip,
  Divider,
} from "@mantine/core";
import { tigDashboard, tigTeams } from "../../api/tig-client";
import { useAuthStore } from "../../store/auth-store";
import { colors, cardStyle, statusGradient } from "../../theme/mantine-theme";
import { QueryError } from "../../shared/components/QueryError";
import { groupByJob } from "./utils/group-by-job";
import { FailureDetail } from "./components/FailureDetail";
import type { FailureEntry } from "./types";

type Filter = "all" | "code" | "infrastructure";

export function FailuresPage() {
  const instanceId = useAuthStore((s) => s.instanceId);
  const [filter, setFilter] = useState<Filter>("all");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [authorFilter, setAuthorFilter] = useState<string | null>(null);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const clearHover = useCallback(() => setHoveredItem(null), []);

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
    refetchInterval: 30_000,
  });

  const { data, isLoading } = failuresQuery;

  const allFailures = (data ?? []) as FailureEntry[];
  const filtered =
    filter === "all"
      ? allFailures
      : allFailures.filter((f) => f.classification === filter);
  const grouped = useMemo(() => groupByJob(filtered), [filtered]);

  const totalJobs = useMemo(
    () => groupByJob(allFailures).length,
    [allFailures],
  );
  const codeJobs = useMemo(
    () =>
      groupByJob(allFailures.filter((f) => f.classification === "code")).length,
    [allFailures],
  );
  const infraJobs = useMemo(
    () =>
      groupByJob(
        allFailures.filter((f) => f.classification === "infrastructure"),
      ).length,
    [allFailures],
  );

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader color="orange" size="sm" />
      </Stack>
    );
  }

  if (failuresQuery.isError) {
    return (
      <QueryError
        message={failuresQuery.error?.message}
        onRetry={failuresQuery.refetch}
      />
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group gap="sm">
          <Title order={3} c={colors.text}>
            Failures
          </Title>
          {teamsData && teamsData.length > 0 && (
            <Select
              size="xs"
              placeholder="All teams"
              clearable
              value={teamId}
              onChange={setTeamId}
              data={teamsData.map((t) => ({ value: t.id, label: t.name }))}
              styles={{
                input: {
                  backgroundColor: colors.surface,
                  border: "none",
                  minWidth: 130,
                },
              }}
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
              styles={{
                input: {
                  backgroundColor: colors.surface,
                  border: "none",
                  minWidth: 130,
                },
              }}
            />
          )}
        </Group>
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

      {grouped.length === 0 && (
        <Card radius="md" style={cardStyle} p="xl">
          <Text size="sm" c={colors.success} ta="center">
            {filter === "all" ? "No recent failures" : `No ${filter} failures`}
          </Text>
        </Card>
      )}

      {grouped.length > 0 && (
        <Accordion
          variant="separated"
          radius="md"
          styles={{
            item: {
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
              overflow: "hidden",
            },
            control: { padding: "10px 14px" },
            panel: { padding: "0 14px 14px" },
          }}
        >
          {grouped.map((g) => {
            const f = g.latest;
            const aiSummary = f.aiSummary as string | undefined;
            const hasAi = !!aiSummary;

            return (
              <Accordion.Item
                key={g.jobFullPath}
                value={g.jobFullPath}
                onMouseEnter={() => setHoveredItem(g.jobFullPath)}
                onMouseLeave={clearHover}
                style={{
                  transition: "background-color 0.15s ease",
                  backgroundColor:
                    hoveredItem === g.jobFullPath
                      ? colors.surfaceHover
                      : undefined,
                }}
              >
                <Box
                  style={{
                    height: 3,
                    borderRadius: "3px 3px 0 0",
                    background: statusGradient(
                      f.classification === "infrastructure"
                        ? colors.failure
                        : colors.accent,
                    ),
                  }}
                />
                <Accordion.Control>
                  <Group
                    justify="space-between"
                    wrap="nowrap"
                    style={{ width: "100%", paddingRight: 8 }}
                  >
                    <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                      <Group gap="xs">
                        <Text size="sm" fw={500} c={colors.text} truncate>
                          {g.jobName}
                        </Text>
                        {g.streak > 1 && (
                          <Badge size="xs" variant="filled" color="red">
                            {g.streak}× failed
                          </Badge>
                        )}
                      </Group>
                      {f.triggeredBy && (
                        <Text size="xs" c={colors.textTertiary}>
                          Triggered by {String(f.triggeredBy)}
                        </Text>
                      )}
                      {hasAi && (
                        <Text size="xs" c={colors.textSecondary} lineClamp={1}>
                          {aiSummary}
                        </Text>
                      )}
                    </Stack>
                    <Group gap={4}>
                      {f.classification && (
                        <Badge
                          size="xs"
                          variant="light"
                          color={
                            f.classification === "infrastructure"
                              ? "red"
                              : "orange"
                          }
                        >
                          {f.classification === "infrastructure"
                            ? "Infra"
                            : "Code"}
                        </Badge>
                      )}
                      {hasAi ? (
                        <Badge size="xs" variant="light" color="orange">
                          AI
                        </Badge>
                      ) : (
                        <Tooltip
                          label="AI was offline. Classification may be inaccurate."
                          multiline
                          w={250}
                        >
                          <Badge size="xs" variant="light" color="gray">
                            regex
                          </Badge>
                        </Tooltip>
                      )}
                    </Group>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="md">
                    <FailureDetail f={f} />
                    {g.builds.length > 1 && (
                      <>
                        <Divider color={colors.surfaceLight} />
                        <Stack gap="xs">
                          <Text size="xs" c={colors.textMuted} fw={500}>
                            Also failed: {g.builds.length - 1} earlier build
                            {g.builds.length > 2 ? "s" : ""}
                          </Text>
                          {g.builds.slice(1).map((older) => (
                            <Group key={older.buildId} gap="xs">
                              <Text size="xs" c={colors.textTertiary}>
                                #{older.buildNumber}
                              </Text>
                              <Text size="xs" c={colors.textMuted}>
                                {new Date(older.startedAt).toLocaleString()}
                              </Text>
                              {(older.aiSummary as string | undefined) && (
                                <Text
                                  size="xs"
                                  c={colors.textMuted}
                                  lineClamp={1}
                                  style={{ flex: 1 }}
                                >
                                  {String(older.aiSummary)}
                                </Text>
                              )}
                            </Group>
                          ))}
                        </Stack>
                      </>
                    )}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            );
          })}
        </Accordion>
      )}
    </Stack>
  );
}
