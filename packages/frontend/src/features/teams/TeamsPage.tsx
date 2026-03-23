import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Text,
  Card,
  Group,
  Button,
  TextInput,
  TagsInput,
  Badge,
  ActionIcon,
  Tooltip,
  Loader,
} from '@mantine/core';
import { tigTeams } from '../../api/tig-client';
import { useAuthStore } from '../../store/auth-store';

const CARD = { backgroundColor: '#1e2030', border: 'none' };

export function TeamsPage() {
  const queryClient = useQueryClient();
  const instanceId = useAuthStore((s) => s.instanceId);
  const orgId = useAuthStore((s) => s.organizationId);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPatterns, setNewPatterns] = useState<string[]>([]);

  const { data: teams, isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: () => tigTeams.list(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      tigTeams.create({
        name: newName,
        ciInstanceId: instanceId!,
        organizationId: orgId!,
        folderPatterns: newPatterns,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setCreating(false);
      setNewName('');
      setNewPatterns([]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tigTeams.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader color="blue" size="sm" />
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={3} c="#e2e8f0">Teams</Title>
        {!creating && (
          <Button size="xs" onClick={() => setCreating(true)}>
            New Team
          </Button>
        )}
      </Group>

      {creating && (
        <Card radius="md" style={CARD} p="md">
          <Stack gap="sm">
            <Text size="sm" fw={600} c="#e2e8f0">Create Team</Text>
            <TextInput
              placeholder="Team name (e.g., Backend, Frontend, Automation)"
              value={newName}
              onChange={(e) => setNewName(e.currentTarget.value)}
              styles={{ input: { backgroundColor: '#161822', border: 'none' } }}
            />
            <TagsInput
              placeholder="Folder patterns (e.g., github/Service/** — press Enter to add)"
              value={newPatterns}
              onChange={setNewPatterns}
              styles={{ input: { backgroundColor: '#161822', border: 'none' } }}
            />
            <Text size="xs" c="#475569">
              Patterns use glob syntax: ** matches any depth, * matches one folder level.
              Examples: github/Service/** matches all backend services, github/web/** matches all frontend repos.
            </Text>
            <Group>
              <Button
                size="xs"
                onClick={() => createMutation.mutate()}
                loading={createMutation.isPending}
                disabled={!newName || newPatterns.length === 0}
              >
                Create
              </Button>
              <Button size="xs" variant="subtle" color="gray" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </Group>
          </Stack>
        </Card>
      )}

      {(!teams || teams.length === 0) && !creating && (
        <Card radius="md" style={CARD} p="xl">
          <Stack align="center" gap="xs">
            <Text size="sm" c="#64748b">No teams yet</Text>
            <Text size="xs" c="#475569">
              Create teams to scope failures by project. Developers see only what's theirs.
            </Text>
          </Stack>
        </Card>
      )}

      {teams && teams.length > 0 && (
        <Stack gap="xs">
          {teams.map((team) => (
            <Card key={team.id} radius="md" style={CARD} p="sm">
              <Group justify="space-between">
                <Stack gap={2}>
                  <Text size="sm" fw={500} c="#e2e8f0">{team.name}</Text>
                  <Group gap={4}>
                    {team.folderPatterns.map((p, i) => (
                      <Badge key={i} size="xs" variant="light" color="blue">
                        {p}
                      </Badge>
                    ))}
                  </Group>
                </Stack>
                <Tooltip label="Delete team">
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="red"
                    onClick={() => deleteMutation.mutate(team.id)}
                  >
                    <Text size="xs">✕</Text>
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
