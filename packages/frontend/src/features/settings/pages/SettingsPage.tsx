import { Stack, Title, Text } from '@mantine/core';
import { ConnectionForm } from '../components/ConnectionForm';

export function SettingsPage() {
  return (
    <Stack gap="lg" p="md">
      <div>
        <Title order={2}>Settings</Title>
        <Text size="sm" c="dimmed" mt="xs">
          Connect to your Jenkins instance to start analyzing builds.
        </Text>
      </div>
      <ConnectionForm />
    </Stack>
  );
}
