import { Card, List, Text, Title } from '@mantine/core';
import type { MatchResult } from '../engine/types';

interface Props {
  readonly primaryMatch: MatchResult;
}

export function RemediationPanel({ primaryMatch }: Props) {
  const steps = primaryMatch.pattern.remediationSteps;

  if (steps.length === 0) {
    return null;
  }

  return (
    <Card withBorder>
      <Title order={4} mb="sm">
        What to do
      </Title>
      <Text size="sm" c="dimmed" mb="md">
        Follow these steps to resolve the issue:
      </Text>
      <List type="ordered" spacing="xs">
        {steps.map((step, idx) => (
          <List.Item key={idx}>
            <Text size="sm">{step}</Text>
          </List.Item>
        ))}
      </List>
    </Card>
  );
}
