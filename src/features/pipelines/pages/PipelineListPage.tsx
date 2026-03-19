import { useMemo, useState } from 'react';
import {
  Stack,
  Title,
  Text,
  Loader,
  Alert,
  SimpleGrid,
  Card,
  Group,
  Badge,
  Breadcrumbs,
  Anchor,
} from '@mantine/core';
import { useAllJobs } from '../../../shared/hooks/use-fetch-folders';
import { groupJobs } from '../../../shared/utils/job-grouper';
import { PipelineTable } from '../components/PipelineTable';
import type { JobGroup, JobSubGroup } from '../../../shared/utils/job-grouper';

function countFailing(jobs: readonly { color: string }[]): number {
  return jobs.filter((j) => j.color.startsWith('red')).length;
}

function countBuilding(jobs: readonly { color: string }[]): number {
  return jobs.filter((j) => j.color.endsWith('_anime')).length;
}

function FolderCards({
  groups,
  onSelect,
}: {
  readonly groups: readonly JobGroup[];
  readonly onSelect: (group: JobGroup) => void;
}) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
      {groups.map((group) => {
        const failing = countFailing(group.jobs);
        const building = countBuilding(group.jobs);
        return (
          <Card
            key={group.label}
            withBorder
            style={{ cursor: 'pointer' }}
            onClick={() => onSelect(group)}
          >
            <Stack gap="xs">
              <Title order={4}>{group.label}</Title>
              <Group gap="xs">
                <Badge size="sm" variant="light">
                  {group.jobs.length} jobs
                </Badge>
                {failing > 0 && (
                  <Badge size="sm" color="red" variant="filled">
                    {failing} failing
                  </Badge>
                )}
                {building > 0 && (
                  <Badge size="sm" color="blue" variant="filled">
                    {building} building
                  </Badge>
                )}
              </Group>
            </Stack>
          </Card>
        );
      })}
    </SimpleGrid>
  );
}

function SubGroupCards({
  subGroups,
  onSelect,
}: {
  readonly subGroups: readonly JobSubGroup[];
  readonly onSelect: (sub: JobSubGroup) => void;
}) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
      {subGroups.map((sub) => {
        const failing = countFailing(sub.jobs);
        return (
          <Card
            key={sub.label}
            withBorder
            style={{ cursor: 'pointer' }}
            onClick={() => onSelect(sub)}
          >
            <Stack gap="xs">
              <Text fw={500}>{sub.label}</Text>
              <Group gap="xs">
                <Badge size="sm" variant="light">
                  {sub.jobs.length} jobs
                </Badge>
                {failing > 0 && (
                  <Badge size="sm" color="red" variant="filled">
                    {failing} failing
                  </Badge>
                )}
              </Group>
            </Stack>
          </Card>
        );
      })}
    </SimpleGrid>
  );
}

export function PipelineListPage() {
  const { data: jobs, isLoading, error } = useAllJobs();
  const [selectedGroup, setSelectedGroup] = useState<JobGroup | null>(null);
  const [selectedSub, setSelectedSub] = useState<JobSubGroup | null>(null);

  const groups = useMemo(() => groupJobs(jobs ?? []), [jobs]);

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader />
        <Text size="sm" c="dimmed">Scanning Jenkins...</Text>
      </Stack>
    );
  }

  if (error) {
    return (
      <Alert color="red" title="Failed to load pipelines">
        <Text size="sm">
          {error instanceof Error ? error.message : 'Unknown error'}
        </Text>
      </Alert>
    );
  }

  if (selectedSub) {
    return (
      <Stack gap="md" p="md">
        <Breadcrumbs>
          <Anchor
            size="sm"
            onClick={() => {
              setSelectedGroup(null);
              setSelectedSub(null);
            }}
          >
            Pipelines
          </Anchor>
          <Anchor
            size="sm"
            onClick={() => setSelectedSub(null)}
          >
            {selectedGroup?.label}
          </Anchor>
          <Text size="sm">{selectedSub.label}</Text>
        </Breadcrumbs>
        <Title order={3}>{selectedSub.label}</Title>
        <PipelineTable jobs={selectedSub.jobs} />
      </Stack>
    );
  }

  if (selectedGroup) {
    return (
      <Stack gap="md" p="md">
        <Breadcrumbs>
          <Anchor
            size="sm"
            onClick={() => setSelectedGroup(null)}
          >
            Pipelines
          </Anchor>
          <Text size="sm">{selectedGroup.label}</Text>
        </Breadcrumbs>
        <Title order={3}>{selectedGroup.label}</Title>
        {selectedGroup.subGroups && selectedGroup.subGroups.length > 0 ? (
          <SubGroupCards
            subGroups={selectedGroup.subGroups}
            onSelect={setSelectedSub}
          />
        ) : (
          <PipelineTable jobs={selectedGroup.jobs} />
        )}
      </Stack>
    );
  }

  return (
    <Stack gap="md" p="md">
      <Title order={2}>Pipelines</Title>
      <FolderCards groups={groups} onSelect={setSelectedGroup} />
    </Stack>
  );
}
