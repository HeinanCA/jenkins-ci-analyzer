import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Stack,
  Title,
  Text,
  SimpleGrid,
  Card,
  Group,
  Loader,
} from '@mantine/core';
import { useAllJobs } from '../../../shared/hooks/use-fetch-folders';
import { useAgentsStatus } from '../../health/hooks/use-agents-status';
import { useQueueStatus } from '../../health/hooks/use-queue-status';
import { calculateHealth } from '../../health/utils/health-calculator';
import { OverallHealthBanner } from '../../health/components/OverallHealthBanner';
import { BuildStatusBadge } from '../../pipelines/components/BuildStatusBadge';
import { ErrorBoundary } from '../../../shared/components/ErrorBoundary';
import { groupJobs } from '../../../shared/utils/job-grouper';
import { timeAgo } from '../../../shared/utils/format-duration';
import { STUCK_AGENT_THRESHOLD_MS } from '../../../config/constants';
import type { FlatJob } from '../../../shared/hooks/use-fetch-folders';

export function DashboardPage() {
  const navigate = useNavigate();
  const { data: jobs, isLoading } = useAllJobs();
  const agents = useAgentsStatus();
  const queue = useQueueStatus();

  const jobList: readonly FlatJob[] = jobs ?? [];

  const groups = useMemo(() => groupJobs(jobList), [jobList]);

  const stats = useMemo(() => {
    const total = jobList.length;
    const passing = jobList.filter(
      (j) => j.color.startsWith('blue') || j.color.startsWith('green'),
    ).length;
    const failing = jobList.filter((j) => j.color.startsWith('red')).length;
    const building = jobList.filter((j) => j.color.endsWith('_anime')).length;
    return { total, passing, failing, building };
  }, [jobList]);

  const healthReport = useMemo(() => {
    const agentData = agents.data?.computer ?? [];
    const queueData = queue.data?.items ?? [];
    const agentsOnline = agentData.filter((a) => !a.offline).length;
    const executorsTotal = agentData.reduce((s, a) => s + a.numExecutors, 0);
    const executorsBusy = agentData.reduce(
      (s, a) =>
        s + a.executors.filter((e) => e.currentExecutable !== null).length,
      0,
    );
    const stuckBuilds = agentData.reduce(
      (s, a) =>
        s +
        a.executors.filter(
          (e) =>
            e.currentExecutable?.timestamp &&
            Date.now() - e.currentExecutable.timestamp > STUCK_AGENT_THRESHOLD_MS,
        ).length,
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

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader />
        <Text size="sm" c="dimmed">Loading dashboard...</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg" p="md">
      <Title order={2}>Dashboard</Title>

      <ErrorBoundary fallbackMessage="Failed to render health status">
        <OverallHealthBanner report={healthReport} />
      </ErrorBoundary>

      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <Card withBorder>
          <Text size="xs" c="dimmed">Total Pipelines</Text>
          <Text size="xl" fw={700}>{stats.total}</Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed">Passing</Text>
          <Text size="xl" fw={700} c="green">{stats.passing}</Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed">Failing</Text>
          <Text size="xl" fw={700} c="red">{stats.failing}</Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed">Building</Text>
          <Text size="xl" fw={700} c="blue">{stats.building}</Text>
        </Card>
      </SimpleGrid>

      {groups.map((group) => {
        const failedInGroup = group.jobs.filter((j) => j.color.startsWith('red'));
        if (failedInGroup.length === 0) return null;
        return (
          <ErrorBoundary key={group.label} fallbackMessage="Failed to render failures">
            <div>
              <Title order={4} mb="sm">{group.label} — Failures</Title>
              <Stack gap="xs">
                {failedInGroup.slice(0, 5).map((job) => (
                  <Card
                    key={job.fullPath}
                    withBorder
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      if (job.lastBuild) {
                        navigate(
                          `/build/${encodeURIComponent(job.fullPath)}/${job.lastBuild.number}`,
                        );
                      }
                    }}
                  >
                    <Group justify="space-between">
                      <div>
                        <Text size="sm" fw={500}>{job.name}</Text>
                        <Text size="xs" c="dimmed">
                          {job.lastBuild
                            ? `#${job.lastBuild.number} · ${timeAgo(job.lastBuild.timestamp)}`
                            : 'Unknown'}
                        </Text>
                      </div>
                      <BuildStatusBadge color={job.color} />
                    </Group>
                  </Card>
                ))}
              </Stack>
            </div>
          </ErrorBoundary>
        );
      })}
    </Stack>
  );
}
