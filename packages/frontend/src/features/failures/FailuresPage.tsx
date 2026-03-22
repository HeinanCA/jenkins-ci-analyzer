import { useQuery } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Text,
  Badge,
  Loader,
  Code,
  Accordion,
  List,
  Card,
  Group,
} from '@mantine/core';
import { tigDashboard } from '../../api/tig-client';
import { useAuthStore } from '../../store/auth-store';

const CARD_STYLE = {
  backgroundColor: 'rgba(255, 255, 255, 0.03)',
  borderColor: 'rgba(255, 255, 255, 0.08)',
};

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
        <Loader color="blue" />
        <Text size="sm" c="dimmed">Loading failures...</Text>
      </Stack>
    );
  }

  const failures = data ?? [];

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2} c="gray.1">Failures</Title>
        <Badge size="lg" variant="light" color={failures.length > 0 ? 'red' : 'green'}>
          {failures.length} failed
        </Badge>
      </Group>

      {failures.length === 0 && (
        <Card withBorder radius="md" style={CARD_STYLE} p="xl">
          <Stack align="center" gap="xs">
            <Text size="lg" c="#34d399">All clear</Text>
            <Text size="xs" c="dimmed">No recent failures.</Text>
          </Stack>
        </Card>
      )}

      {failures.length > 0 && (
        <Accordion
          variant="separated"
          radius="md"
          styles={{
            item: { backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' },
            control: { padding: '12px 16px' },
            panel: { padding: '0 16px 16px' },
          }}
        >
          {failures.map((f) => {
            const matches = Array.isArray(f.matches) ? f.matches as Record<string, unknown>[] : [];
            const primary = matches[0];
            const aiSummary = (f as Record<string, unknown>).aiSummary as string | undefined;
            const aiRootCause = (f as Record<string, unknown>).aiRootCause as string | undefined;
            const aiFixes = (f as Record<string, unknown>).aiSuggestedFixes as Record<string, unknown> | undefined;
            const hasAi = !!aiSummary;

            return (
              <Accordion.Item key={f.buildId} value={f.buildId}>
                <Accordion.Control>
                  <Group justify="space-between" wrap="nowrap" style={{ width: '100%', paddingRight: 8 }}>
                    <div>
                      <Text size="sm" fw={500} c="gray.2">{f.jobName}</Text>
                      <Text size="xs" c="dimmed">
                        #{f.buildNumber} — {new Date(f.startedAt).toLocaleString()}
                      </Text>
                    </div>
                    <Group gap={6}>
                      {f.classification && (
                        <Badge size="xs" variant="light" color={f.classification === 'infrastructure' ? 'red' : 'orange'}>
                          {f.classification === 'infrastructure' ? 'Infra' : 'Code'}
                        </Badge>
                      )}
                      {hasAi && (
                        <Badge size="xs" variant="light" color="violet">AI</Badge>
                      )}
                    </Group>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  {hasAi ? (
                    <Stack gap="sm">
                      <Text size="sm" c="gray.2" fw={500}>{aiSummary}</Text>
                      {aiRootCause && (
                        <Code block style={{ backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 12 }}>
                          {aiRootCause}
                        </Code>
                      )}
                      {aiFixes?.failingTest && (
                        <Text size="xs" c="dimmed">
                          Test: <Text span c="gray.3" fw={500}>{String(aiFixes.failingTest)}</Text>
                        </Text>
                      )}
                      {aiFixes?.assertion && (
                        <Text size="xs" c="dimmed">
                          Assertion: <Text span c="gray.3">{String(aiFixes.assertion)}</Text>
                        </Text>
                      )}
                      {aiFixes?.filePath && (
                        <Text size="xs" c="dimmed">
                          File: <Text span c="gray.3">{String(aiFixes.filePath)}{aiFixes.lineNumber ? `:${aiFixes.lineNumber}` : ''}</Text>
                        </Text>
                      )}
                      {Array.isArray(aiFixes?.fixes) && (aiFixes.fixes as string[]).length > 0 && (
                        <>
                          <Text size="sm" fw={600} c="gray.2">What to do:</Text>
                          <List size="sm" type="ordered" styles={{ item: { color: '#94a3b8' } }}>
                            {(aiFixes.fixes as string[]).map((step, i) => (
                              <List.Item key={i}>{step}</List.Item>
                            ))}
                          </List>
                        </>
                      )}
                    </Stack>
                  ) : primary ? (
                    <Stack gap="sm">
                      <Text size="sm" c="gray.3">{String(primary.description ?? 'Pattern matched')}</Text>
                      {primary.matchedLine && (
                        <Code block style={{ backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 12 }}>
                          {String(primary.matchedLine)}
                        </Code>
                      )}
                      {Array.isArray(primary.remediationSteps) && (
                        <List size="sm" type="ordered" styles={{ item: { color: '#94a3b8' } }}>
                          {(primary.remediationSteps as string[]).map((step, i) => (
                            <List.Item key={i}>{step}</List.Item>
                          ))}
                        </List>
                      )}
                    </Stack>
                  ) : (
                    <Text size="sm" c="dimmed">No analysis available yet.</Text>
                  )}
                </Accordion.Panel>
              </Accordion.Item>
            );
          })}
        </Accordion>
      )}
    </Stack>
  );
}
