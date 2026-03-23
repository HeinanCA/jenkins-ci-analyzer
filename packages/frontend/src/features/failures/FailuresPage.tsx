import { useState } from "react";
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
} from "@mantine/core";
import { tigDashboard, tigTeams } from "../../api/tig-client";
import { useAuthStore } from "../../store/auth-store";

const CARD = { backgroundColor: "#1e2030", border: "none" };

type Filter = "all" | "code" | "infrastructure";

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

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader color="blue" size="sm" />
      </Stack>
    );
  }

  const allFailures = data ?? [];
  const failures =
    filter === "all"
      ? allFailures
      : allFailures.filter((f) => f.classification === filter);

  const codeCount = allFailures.filter(
    (f) => f.classification === "code",
  ).length;
  const infraCount = allFailures.filter(
    (f) => f.classification === "infrastructure",
  ).length;

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group gap="sm">
          <Title order={3} c="#e2e8f0">
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
                  backgroundColor: "#1e2030",
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
            { label: `All (${allFailures.length})`, value: "all" },
            { label: `Code (${codeCount})`, value: "code" },
            { label: `Infra (${infraCount})`, value: "infrastructure" },
          ]}
          styles={{
            root: { backgroundColor: "#1e2030" },
          }}
        />
      </Group>

      {failures.length === 0 && (
        <Card radius="md" style={CARD} p="xl">
          <Text size="sm" c="#34d399" ta="center">
            {filter === "all" ? "No recent failures" : `No ${filter} failures`}
          </Text>
        </Card>
      )}

      {failures.length > 0 && (
        <Accordion
          variant="separated"
          radius="md"
          styles={{
            item: { backgroundColor: "#1e2030", border: "none" },
            control: { padding: "10px 14px" },
            panel: { padding: "0 14px 14px" },
          }}
        >
          {failures.map((f) => {
            const matches = Array.isArray(f.matches)
              ? (f.matches as Record<string, unknown>[])
              : [];
            const primary = matches[0];
            const aiSummary = (f as Record<string, unknown>).aiSummary as
              | string
              | undefined;
            const aiRootCause = (f as Record<string, unknown>).aiRootCause as
              | string
              | undefined;
            const aiFixes = (f as Record<string, unknown>).aiSuggestedFixes as
              | Record<string, unknown>
              | undefined;
            const jobUrl = (f as Record<string, unknown>).jobUrl as
              | string
              | undefined;
            const hasAi = !!aiSummary;
            const fixes = Array.isArray(aiFixes?.fixes)
              ? (aiFixes.fixes as string[])
              : [];
            const firstFix = fixes[0];

            return (
              <Accordion.Item key={f.buildId} value={f.buildId}>
                <Accordion.Control>
                  <Group
                    justify="space-between"
                    wrap="nowrap"
                    style={{ width: "100%", paddingRight: 8 }}
                  >
                    <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                      <Group gap="xs">
                        <Text size="sm" fw={500} c="#e2e8f0" truncate>
                          {f.jobName}
                        </Text>
                        <Text size="xs" c="#475569">
                          #{f.buildNumber}
                        </Text>
                      </Group>
                      {hasAi && (
                        <Text size="xs" c="#94a3b8" lineClamp={1}>
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
                      {hasAi && (
                        <Badge size="xs" variant="light" color="violet">
                          AI
                        </Badge>
                      )}
                    </Group>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="sm">
                    {aiRootCause && (
                      <Code
                        block
                        style={{
                          backgroundColor: "#161822",
                          border: "none",
                          fontSize: 12,
                        }}
                      >
                        {aiRootCause}
                      </Code>
                    )}

                    {aiFixes?.failingTest && (
                      <Text size="xs" c="#64748b">
                        Test:{" "}
                        <Text span c="#94a3b8" fw={500}>
                          {String(aiFixes.failingTest)}
                        </Text>
                      </Text>
                    )}
                    {aiFixes?.filePath && (
                      <Text size="xs" c="#64748b">
                        File:{" "}
                        <Text span c="#94a3b8">
                          {String(aiFixes.filePath)}
                          {aiFixes.lineNumber ? `:${aiFixes.lineNumber}` : ""}
                        </Text>
                      </Text>
                    )}
                    {aiFixes?.assertion && (
                      <Text size="xs" c="#64748b">
                        Assertion:{" "}
                        <Text span c="#94a3b8">
                          {String(aiFixes.assertion)}
                        </Text>
                      </Text>
                    )}

                    {fixes.length > 0 && (
                      <Stack gap="xs">
                        <Text size="xs" fw={600} c="#94a3b8">
                          Fix:
                        </Text>
                        {firstFix && (
                          <Group gap="xs">
                            <Code
                              style={{
                                backgroundColor: "#161822",
                                border: "none",
                                fontSize: 11,
                                flex: 1,
                              }}
                            >
                              {firstFix}
                            </Code>
                            <CopyButton value={firstFix}>
                              {({ copied, copy }) => (
                                <Tooltip
                                  label={copied ? "Copied" : "Copy command"}
                                >
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
                            styles={{ item: { color: "#64748b" } }}
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
                        <Text size="xs" c="#94a3b8">
                          {String(primary.description ?? "")}
                        </Text>
                        {primary.matchedLine && (
                          <Code
                            block
                            style={{
                              backgroundColor: "#161822",
                              border: "none",
                              fontSize: 11,
                            }}
                          >
                            {String(primary.matchedLine)}
                          </Code>
                        )}
                      </Stack>
                    )}

                    {/* Log insight */}
                    {(() => {
                      const noisePercent = (f as Record<string, unknown>)
                        .logNoisePercent as number | undefined;
                      const topNoise = (f as Record<string, unknown>)
                        .logTopNoise as string | undefined;
                      if (!noisePercent || noisePercent < 30) return null;
                      const sizeKb = Math.round((f.durationMs ?? 0) / 1000); // placeholder — using log size from build
                      return (
                        <Text
                          size="xs"
                          c="#475569"
                          style={{ fontStyle: "italic" }}
                        >
                          💡 {noisePercent}% of this log is noise
                          {topNoise ? ` (mostly ${topNoise})` : ""}. Consider
                          reducing verbosity in your Jenkinsfile.
                        </Text>
                      );
                    })()}

                    {jobUrl && (
                      <Anchor
                        href={`${jobUrl}${f.buildNumber}/console`}
                        target="_blank"
                        size="xs"
                        c="#475569"
                      >
                        Open in Jenkins ↗
                      </Anchor>
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
