import { useMemo } from "react";
import { Stack, Title, Text, Loader, Alert, Group, Badge } from "@mantine/core";
import { useAgentsStatus } from "../hooks/use-agents-status";
import { useQueueStatus } from "../hooks/use-queue-status";
import { calculateHealth } from "../utils/health-calculator";
import { OverallHealthBanner } from "../components/OverallHealthBanner";
import { AgentStatusGrid } from "../components/AgentStatusGrid";
import { ErrorBoundary } from "../../../shared/components/ErrorBoundary";
import { STUCK_AGENT_THRESHOLD_MS } from "../../../config/constants";

export function HealthStatusPage() {
  const agents = useAgentsStatus();
  const queue = useQueueStatus();

  const healthReport = useMemo(() => {
    const agentData = agents.data?.computer ?? [];
    const queueData = queue.data?.items ?? [];

    const agentsOnline = agentData.filter((a) => !a.offline).length;
    const executorsTotal = agentData.reduce(
      (sum, a) => sum + a.numExecutors,
      0,
    );
    const executorsBusy = agentData.reduce(
      (sum, a) =>
        sum + a.executors.filter((e) => e.currentExecutable !== null).length,
      0,
    );
    const stuckBuilds = agentData.reduce(
      (sum, a) =>
        sum +
        a.executors.filter((e) => {
          if (!e.currentExecutable?.timestamp) return false;
          return (
            Date.now() - e.currentExecutable.timestamp >
            STUCK_AGENT_THRESHOLD_MS
          );
        }).length,
      0,
    );

    return calculateHealth({
      controllerReachable: !agents.isError,
      agentsOnline,
      agentsTotal: agentData.length,
      executorsBusy,
      executorsTotal,
      queueDepth: queueData.length,
      stuckBuilds,
    });
  }, [agents.data, agents.isError, queue.data]);

  const isLoading = agents.isLoading || queue.isLoading;

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader />
        <Text size="sm" c="dimmed">
          Checking Jenkins health...
        </Text>
      </Stack>
    );
  }

  if (agents.isError) {
    return (
      <Alert color="red" title="Cannot reach Jenkins">
        <Text size="sm">
          {agents.error instanceof Error
            ? agents.error.message
            : "Failed to connect to Jenkins."}
        </Text>
      </Alert>
    );
  }

  const agentData = agents.data?.computer ?? [];
  const queueItems = queue.data?.items ?? [];

  return (
    <Stack gap="lg" p="md">
      <Title order={2}>Jenkins Health</Title>

      <ErrorBoundary fallbackMessage="Failed to render health status">
        <OverallHealthBanner report={healthReport} />
      </ErrorBoundary>

      <ErrorBoundary fallbackMessage="Failed to render agent status">
        <div>
          <Group mb="sm">
            <Title order={4}>Agents</Title>
            <Badge size="sm" variant="light">
              {agentData.filter((a) => !a.offline).length}/{agentData.length}{" "}
              online
            </Badge>
          </Group>
          <AgentStatusGrid agents={agentData} />
        </div>
      </ErrorBoundary>

      <ErrorBoundary fallbackMessage="Failed to render queue status">
        <div>
          <Group mb="sm">
            <Title order={4}>Build Queue</Title>
            <Badge
              size="sm"
              variant="light"
              color={queueItems.length > 10 ? "red" : "blue"}
            >
              {queueItems.length} items
            </Badge>
          </Group>
          {queueItems.length === 0 ? (
            <Text size="sm" c="dimmed">
              Queue is empty.
            </Text>
          ) : (
            <Stack gap="xs">
              {queueItems.slice(0, 20).map((item) => (
                <Alert
                  key={item.id}
                  color={item.stuck ? "red" : "blue"}
                  variant="light"
                >
                  <Group justify="space-between">
                    <Text size="sm">{item.task.name}</Text>
                    {item.stuck && (
                      <Badge color="red" size="xs">
                        Stuck
                      </Badge>
                    )}
                  </Group>
                  {item.why && (
                    <Text size="xs" c="dimmed" mt="xs">
                      {item.why}
                    </Text>
                  )}
                </Alert>
              ))}
            </Stack>
          )}
        </div>
      </ErrorBoundary>
    </Stack>
  );
}
