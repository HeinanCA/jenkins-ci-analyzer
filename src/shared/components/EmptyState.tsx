import { Stack, Text, Title } from '@mantine/core';

interface Props {
  readonly title: string;
  readonly description: string;
}

export function EmptyState({ title, description }: Props) {
  return (
    <Stack align="center" justify="center" py="xl" gap="sm">
      <Title order={3} c="dimmed">
        {title}
      </Title>
      <Text size="sm" c="dimmed" ta="center" maw={400}>
        {description}
      </Text>
    </Stack>
  );
}
