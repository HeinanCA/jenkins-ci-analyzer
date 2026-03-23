import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Stack,
  Title,
  Text,
  Badge,
  Loader,
  Code,
  Accordion,
  Select,
  List,
  Card,
  Group,
  SegmentedControl,
  Anchor,
  ActionIcon,
  Tooltip,
  CopyButton,
  Divider,
} from "@mantine/core";
import { tigDashboard, tigTeams } from "../../api/tig-client";
import { useAuthStore } from "../../store/auth-store";
import { colors, cardStyle, codeStyle } from "../../theme/mantine-theme";

type Filter = "all" | "code" | "infrastructure";

interface FailureEntry {
  buildId: string;
  buildNumber: number;
  result: string;
  startedAt: string;
  durationMs: number;
  jobName: string;
  jobFullPath: string;
  classification: string | null;
  confidence: number | null;
  matches: unknown;
  [key: string]: unknown;
}

interface GroupedFailure {
  jobFullPath: string;
  jobName: string;
  latest: FailureEntry;
  streak: number;
  builds: FailureEntry[];
}

function groupByJob(failures: FailureEntry[]): GroupedFailure[] {
  const map = new Map<string, FailureEntry[]>();
  for (const f of failures) {
    const existing = map.get(f.jobFullPath) ?? [];
    map.set(f.jobFullPath, [...existing, f]);
  }

  return [...map.entries()]
    .map(([path, builds]) => {
      const sorted = builds.toSorted(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      );
      return {
        jobFullPath: path,
        jobName: sorted[0].jobName,
        latest: sorted[0],
        streak: sorted.length,
        builds: sorted,
      };
    })
    .toSorted((a, b) => {
      if (b.streak !== a.streak) return b.streak - a.streak;
      return (
        new Date(b.latest.startedAt).getTime() -
        new Date(a.latest.startedAt).getTime()
      );
    });
}

function getRepoName(jobFullPath: string): string | null {
  // github/Service/Neteera-Backend/PR-2068 → Neteera-Backend
  const parts = jobFullPath.split("/");
  if (parts[0] === "github" && parts.length >= 3) return parts[2];
  return null;
}

function getBranchName(jobFullPath: string): string | null {
  const parts = jobFullPath.split("/");
  if (parts[0] === "github" && parts.length >= 4) {
    return decodeURIComponent(parts.slice(3).join("/"));
  }
  return null;
}

function FailureDetail({ f }: { f: FailureEntry }) {
  const aiSummary = f.aiSummary as string | undefined;
  const aiRootCause = f.aiRootCause as string | undefined;
  const aiFixes = f.aiSuggestedFixes as Record<string, unknown> | undefined;
  const jobUrl = f.jobUrl as string | undefined;
  const hasAi = !!aiSummary;
  const fixes = Array.isArray(aiFixes?.fixes)
    ? (aiFixes.fixes as string[])
    : [];
  const firstFix = fixes[0];
  const matches = Array.isArray(f.matches)
    ? (f.matches as Record<string, unknown>[])
    : [];
  const primary = matches[0];
  const noisePercent = f.logNoisePercent as number | undefined;
  const topNoise = f.logTopNoise as string | undefined;
  const filePath = aiFixes?.filePath as string | undefined;
  const lineNumber = aiFixes?.lineNumber as number | undefined;
  const repoName = getRepoName(f.jobFullPath);
  const branch = getBranchName(f.jobFullPath);

  return (
    <Stack gap="sm">
      {aiRootCause && (
        <Code block style={codeStyle}>
          {aiRootCause}
        </Code>
      )}

      {aiFixes?.failingTest && (
        <Text size="xs" c={colors.textTertiary}>
          Test:{" "}
          <Text span c={colors.textSecondary} fw={500}>
            {String(aiFixes.failingTest)}
          </Text>
        </Text>
      )}

      {filePath &&
        (() => {
          const gitRemoteUrl = f.gitRemoteUrl as string | undefined;
          const gitSha = f.gitSha as string | undefined;
          // https://github.com/neteera/Neteera-Backend.git → https://github.com/neteera/Neteera-Backend
          const repoUrl = gitRemoteUrl?.replace(/\.git$/, "");
          const sourceUrl =
            repoUrl && gitSha
              ? `${repoUrl}/blob/${gitSha}/${filePath}${lineNumber ? `#L${lineNumber}` : ""}`
              : null;

          return (
            <Group gap="xs">
              <Text size="xs" c={colors.textTertiary}>
                File:{" "}
                <Text span c={colors.textSecondary}>
                  {filePath}
                  {lineNumber ? `:${lineNumber}` : ""}
                </Text>
              </Text>
              {sourceUrl && (
                <Anchor
                  href={sourceUrl}
                  target="_blank"
                  size="xs"
                  c={colors.accent}
                >
                  View source ↗
                </Anchor>
              )}
            </Group>
          );
        })()}

      {aiFixes?.assertion && (
        <Text size="xs" c={colors.textTertiary}>
          Assertion:{" "}
          <Text span c={colors.textSecondary}>
            {String(aiFixes.assertion)}
          </Text>
        </Text>
      )}

      {fixes.length > 0 && (
        <Stack gap="xs">
          <Text size="xs" fw={600} c={colors.textSecondary}>
            Fix:
          </Text>
          {firstFix && (
            <Group gap="xs">
              <Code style={{ ...codeStyle, fontSize: 11, flex: 1 }}>
                {firstFix}
              </Code>
              <CopyButton value={firstFix}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? "Copied" : "Copy command"}>
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color={copied ? "green" : "gray"}
                      onClick={copy}
                    >
                      <Text size="xs">{copied ? "✓" : "⎘"}</Text>
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            </Group>
          )}
          {fixes.length > 1 && (
            <List
              size="xs"
              type="ordered"
              styles={{ item: { color: colors.textTertiary } }}
            >
              {fixes.slice(1).map((step, i) => (
                <List.Item key={i}>{step}</List.Item>
              ))}
            </List>
          )}
        </Stack>
      )}

      {!hasAi && primary && (
        <Stack gap="xs">
          <Text size="xs" c={colors.textSecondary}>
            {String(primary.description ?? "")}
          </Text>
          {primary.matchedLine && (
            <Code block style={{ ...codeStyle, fontSize: 11 }}>
              {String(primary.matchedLine)}
            </Code>
          )}
        </Stack>
      )}

      <Group gap="md">
        {noisePercent && noisePercent >= 30 && (
          <Text size="xs" c={colors.textMuted} style={{ fontStyle: "italic" }}>
            💡 {noisePercent}% noise{topNoise ? ` (${topNoise})` : ""}
          </Text>
        )}
        {jobUrl && (
          <Anchor
            href={`${jobUrl}${f.buildNumber}/console`}
            target="_blank"
            size="xs"
            c={colors.textMuted}
          >
            Jenkins ↗
          </Anchor>
        )}
      </Group>
    </Stack>
  );
}

export function FailuresPage() {
  const instanceId = useAuthStore((s) => s.instanceId);
  const [filter, setFilter] = useState<Filter>("all");
  const [teamId, setTeamId] = useState<string | null>(null);

  const { data: teamsData } = useQuery({
    queryKey: ["teams"],
    queryFn: () => tigTeams.list(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["all-failures", instanceId, teamId],
    queryFn: () =>
      tigDashboard.failures(instanceId ?? undefined, 50, teamId ?? undefined),
    refetchInterval: 30_000,
  });

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
        <Loader color="violet" size="sm" />
      </Stack>
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
            item: { backgroundColor: colors.surface, border: "none" },
            control: { padding: "10px 14px" },
            panel: { padding: "0 14px 14px" },
          }}
        >
          {grouped.map((g) => {
            const f = g.latest;
            const aiSummary = f.aiSummary as string | undefined;
            const hasAi = !!aiSummary;

            return (
              <Accordion.Item key={g.jobFullPath} value={g.jobFullPath}>
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
                        <Badge size="xs" variant="light" color="violet">
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
