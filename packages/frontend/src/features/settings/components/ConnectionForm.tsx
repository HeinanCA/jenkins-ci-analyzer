import { useState } from 'react';
import {
  Button,
  Group,
  Stack,
  TextInput,
  PasswordInput,
  Alert,
  Text,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { z } from 'zod/v4';
import { useConnectionStore } from '../../../store/connection-store';
import { testConnection } from '../../../api/jenkins-client';

const connectionSchema = z.object({
  baseUrl: z
    .url({ message: 'Must be a valid URL (e.g., https://jenkins.example.com)' })
    .refine((url) => url.startsWith('http'), {
      message: 'URL must start with http:// or https://',
    }),
  username: z.string().min(1, 'Username is required'),
  token: z.string().min(1, 'API token is required'),
});

type ConnectionValues = z.infer<typeof connectionSchema>;

export function ConnectionForm() {
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);

  const setConfig = useConnectionStore((s) => s.setConfig);
  const setConnected = useConnectionStore((s) => s.setConnected);
  const existingConfig = useConnectionStore((s) => s.config);

  const form = useForm<ConnectionValues>({
    mode: 'uncontrolled',
    initialValues: {
      baseUrl: existingConfig?.baseUrl ?? '',
      username: existingConfig?.username ?? '',
      token: existingConfig?.token ?? '',
    },
    validate: (values) => {
      const result = connectionSchema.safeParse(values);
      if (result.success) return {};
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const path = issue.path.join('.');
        if (path) errors[path] = issue.message;
      }
      return errors;
    },
  });

  const handleTestConnection = async () => {
    const validation = form.validate();
    if (validation.hasErrors) return;

    setTesting(true);
    setTestResult(null);

    const values = form.getValues();
    const normalizedUrl = values.baseUrl.replace(/\/$/, '');
    const result = await testConnection({
      baseUrl: normalizedUrl,
      username: values.username,
      token: values.token,
    });
    setTestResult(result);
    setTesting(false);
  };

  const handleSave = () => {
    const validation = form.validate();
    if (validation.hasErrors) return;

    const values = form.getValues();
    const normalizedUrl = values.baseUrl.replace(/\/$/, '');
    setConfig({
      baseUrl: normalizedUrl,
      username: values.username,
      token: values.token,
    });
    setConnected(testResult?.success ?? false);
  };

  return (
    <Stack gap="md" maw={500}>
      <TextInput
        label="Jenkins URL"
        placeholder="https://jenkins.example.com"
        description="The base URL of your Jenkins instance"
        key={form.key('baseUrl')}
        {...form.getInputProps('baseUrl')}
      />
      <TextInput
        label="Username"
        placeholder="your-username"
        key={form.key('username')}
        {...form.getInputProps('username')}
      />
      <PasswordInput
        label="API Token"
        placeholder="Your Jenkins API token"
        description="Generate this in Jenkins > User > Configure > API Token"
        key={form.key('token')}
        {...form.getInputProps('token')}
      />

      {testResult && (
        <Alert color={testResult.success ? 'green' : 'red'}>
          <Text size="sm">{testResult.message}</Text>
        </Alert>
      )}

      <Group>
        <Button
          variant="outline"
          onClick={handleTestConnection}
          loading={testing}
        >
          Test Connection
        </Button>
        <Button onClick={handleSave}>Save</Button>
      </Group>
    </Stack>
  );
}
