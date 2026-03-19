import { Table, Text } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import type { FlatJob } from '../../../shared/hooks/use-fetch-folders';
import { BuildStatusBadge } from './BuildStatusBadge';
import { formatDuration, timeAgo } from '../../../shared/utils/format-duration';

interface Props {
  readonly jobs: readonly FlatJob[];
}

function branchName(fullPath: string): string {
  const parts = fullPath.split('/');
  return decodeURIComponent(parts[parts.length - 1]);
}

export function PipelineTable({ jobs }: Props) {
  const navigate = useNavigate();

  const handleRowClick = (job: FlatJob) => {
    if (!job.lastBuild) return;
    navigate(
      `/build/${encodeURIComponent(job.fullPath)}/${job.lastBuild.number}`,
    );
  };

  return (
    <Table highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Branch</Table.Th>
          <Table.Th>Status</Table.Th>
          <Table.Th>Last Build</Table.Th>
          <Table.Th>Duration</Table.Th>
          <Table.Th>Health</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {jobs.map((job) => (
          <Table.Tr
            key={job.fullPath}
            style={{ cursor: job.lastBuild ? 'pointer' : 'default' }}
            onClick={() => handleRowClick(job)}
          >
            <Table.Td>
              <Text size="sm" fw={500}>
                {branchName(job.fullPath)}
              </Text>
            </Table.Td>
            <Table.Td>
              <BuildStatusBadge color={job.color} />
            </Table.Td>
            <Table.Td>
              <Text size="sm" c="dimmed">
                {job.lastBuild
                  ? `#${job.lastBuild.number} · ${timeAgo(job.lastBuild.timestamp)}`
                  : '-'}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm">
                {job.lastBuild ? formatDuration(job.lastBuild.duration) : '-'}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm">
                {job.healthReport?.[0]?.score != null
                  ? `${job.healthReport[0].score}%`
                  : '-'}
              </Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
