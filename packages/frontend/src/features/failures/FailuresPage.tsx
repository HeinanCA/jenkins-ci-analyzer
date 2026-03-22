import { useQuery } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Text,
  Table,
  Badge,
  Loader,
  Code,
  Alert,
  Accordion,
  List,
} from '@mantine/core';
import { tigDashboard } from '../../api/tig-client';
import { useAuthStore } from '../../store/auth-store';

interface MatchEntry {
  readonly patternName: string;
  readonly category: string;
  readonly severity: string;
  readonly matchedLine: string;
  readonly description: string;
  readonly remediationSteps: readonly string[];
}

export function FailuresPage() {
  const instanceId = useAuthStore((s) => s.instanceId);

  const { data, isLoading } = useQuery({
    queryKey: ['all-failures', instanceId],
    queryFn: () => tigDashboard.failures(instanceId ?? undefined, 50),
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader />
        <Text size="sm" c="dimmed">Loading failures...</Text>
      </Stack>
    );
  }

  const failures = data ?? [];

  if (failures.length === 0) {
    return (
      <Stack gap="md">
        <Title order={2}>Failures</Title>
        <Alert color="green">No recent failures. All builds passing.</Alert>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Title order={2}>Failures</Title>
      <Text size="sm" c="dimmed">{failures.length} failed builds</Text>

      <Accordion>
        {failures.map((f) => {
          const matches = (f.matches ?? []) as MatchEntry[];
          const primary = matches[0];

          return (
            <Accordion.Item key={f.buildId} value={f.buildId}>
              <Accordion.Control>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingRight: 8 }}>
                  <div>
                    <Text size="sm" fw={500}>{f.jobName}</Text>
                    <Text size="xs" c="dimmed">
                      #{f.buildNumber} — {new Date(f.startedAt).toLocaleString()}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {f.classification && (
                      <Badge
                        size="xs"
                        color={f.classification === 'infrastructure' ? 'red' : 'orange'}
                      >
                        {f.classification === 'infrastructure' ? 'Infra Issue' : 'Code Issue'}
                      </Badge>
                    )}
                    {primary && (
                      <Badge size="xs" variant="light">
                        {primary.patternName}
                      </Badge>
                    )}
                  </div>
                </div>
              </Accordion.Control>
              <Accordion.Panel>
                {primary ? (
                  <Stack gap="sm">
                    <Text size="sm">{primary.description}</Text>
                    <Code block>{primary.matchedLine}</Code>
                    <Text size="sm" fw={500}>What to do:</Text>
                    <List size="sm" type="ordered">
                      {primary.remediationSteps.map((step, i) => (
                        <List.Item key={i}>{step}</List.Item>
                      ))}
                    </List>
                  </Stack>
                ) : (
                  <Text size="sm" c="dimmed">
                    No analysis available. Pattern match not yet complete.
                  </Text>
                )}
              </Accordion.Panel>
            </Accordion.Item>
          );
        })}
      </Accordion>
    </Stack>
  );
}
