import { Alert, Stack, Text, Code, Badge, Group } from '@mantine/core';
import type { MatchResult } from '../engine/types';

interface Props {
  readonly matches: readonly MatchResult[];
}

export function FailureSummaryCard({ matches }: Props) {
  if (matches.length === 0) {
    return (
      <Alert color="yellow" title="No recognized pattern">
        <Text size="sm">
          Could not identify a known failure pattern. Try "Ask AI" for a deeper
          analysis, or check the raw log below.
        </Text>
      </Alert>
    );
  }

  const primary = matches[0];

  return (
    <Stack gap="md">
      <Alert
        color={primary.pattern.category === 'infra' ? 'red' : 'orange'}
        title={primary.pattern.name}
      >
        <Stack gap="xs">
          <Text size="sm">{primary.pattern.description}</Text>
          <Group gap="xs">
            <Badge
              size="xs"
              color={primary.pattern.category === 'infra' ? 'red' : 'orange'}
            >
              {primary.pattern.severity}
            </Badge>
            <Text size="xs" c="dimmed">
              Line {primary.lineNumber}
            </Text>
          </Group>
          <Code block>{primary.matchedLine}</Code>
        </Stack>
      </Alert>

      {matches.length > 1 && (
        <Stack gap="xs">
          <Text size="sm" fw={500}>
            Additional issues detected:
          </Text>
          {matches.slice(1).map((match, idx) => (
            <Alert
              key={`${match.pattern.id}-${idx}`}
              color="gray"
              variant="light"
              title={match.pattern.name}
            >
              <Text size="xs">{match.pattern.description}</Text>
              <Code block mt="xs">
                {match.matchedLine}
              </Code>
            </Alert>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
