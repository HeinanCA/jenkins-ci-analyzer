import { SimpleGrid, Card, Badge, Text, Group, Stack } from "@mantine/core";
import type { JenkinsAgent } from "../../../api/types/jenkins-api";
import { STUCK_AGENT_THRESHOLD_MS } from "../../../config/constants";
import { formatDuration } from "../../../shared/utils/format-duration";

interface Props {
  readonly agents: readonly JenkinsAgent[];
}

function getAgentStatus(agent: JenkinsAgent): {
  color: string;
  label: string;
  detail?: string;
} {
  if (agent.offline) {
    return {
      color: "gray",
      label: "Offline",
      detail: agent.offlineCauseReason ?? undefined,
    };
  }

  if (agent.idle) {
    return { color: "blue", label: "Idle" };
  }

  const stuckExecutor = agent.executors.find((e) => {
    if (!e.currentExecutable?.timestamp) return false;
    const elapsed = Date.now() - e.currentExecutable.timestamp;
    return elapsed > STUCK_AGENT_THRESHOLD_MS;
  });

  if (stuckExecutor?.currentExecutable?.timestamp) {
    const elapsed = Date.now() - stuckExecutor.currentExecutable.timestamp;
    return {
      color: "red",
      label: "STUCK",
      detail: `Running for ${formatDuration(elapsed)}`,
    };
  }

  return { color: "green", label: "Busy" };
}

export function AgentStatusGrid({ agents }: Props) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }}>
      {agents.map((agent) => {
        const status = getAgentStatus(agent);
        const busyExecutors = agent.executors.filter(
          (e) => e.currentExecutable !== null,
        ).length;

        return (
          <Card key={agent.displayName} withBorder>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="sm" fw={500} lineClamp={1}>
                  {agent.displayName}
                </Text>
                <Badge color={status.color} size="sm">
                  {status.label}
                </Badge>
              </Group>
              <Text size="xs" c="dimmed">
                Executors: {busyExecutors}/{agent.numExecutors}
              </Text>
              {status.detail && (
                <Text size="xs" c={status.color === "red" ? "red" : "dimmed"}>
                  {status.detail}
                </Text>
              )}
            </Stack>
          </Card>
        );
      })}
    </SimpleGrid>
  );
}
