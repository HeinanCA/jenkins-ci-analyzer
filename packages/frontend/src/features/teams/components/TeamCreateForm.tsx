import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, Text, Card, Group, Button, TextInput } from "@mantine/core";
import { tigTeams, tigInstances } from "../../../api/tig-client";
import { useAuthStore } from "../../../store/auth-store";
import { colors, cardStyle } from "../../../theme/mantine-theme";
import { FolderPicker } from "./FolderPicker";

interface TeamCreateFormProps {
  readonly instanceId: string;
  readonly onCreated: () => void;
  readonly onCancel: () => void;
}

export function TeamCreateForm({
  instanceId,
  onCreated,
  onCancel,
}: TeamCreateFormProps) {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organizationId);

  const [name, setName] = useState("");
  const [selectedPatterns, setSelectedPatterns] = useState<Set<string>>(
    new Set(),
  );

  const { data: instanceJobs } = useQuery({
    queryKey: ["instance-jobs", instanceId],
    queryFn: () => tigInstances.jobs(instanceId),
    enabled: !!instanceId,
    staleTime: 60_000,
  });

  const togglePattern = (pattern: string) => {
    setSelectedPatterns((prev) => {
      const next = new Set(prev);
      if (next.has(pattern)) {
        next.delete(pattern);
      } else {
        next.add(pattern);
      }
      return next;
    });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      tigTeams.create({
        name,
        ciInstanceId: instanceId,
        organizationId: orgId!,
        folderPatterns: Array.from(selectedPatterns),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      onCreated();
    },
  });

  return (
    <Card radius="md" style={cardStyle} p="md">
      <Stack gap="sm">
        <Text size="sm" fw={600} c={colors.text}>
          Create Team
        </Text>
        <TextInput
          placeholder="Team name (e.g., Backend, Frontend, Automation)"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          styles={{
            input: { backgroundColor: colors.surfaceLight, border: "none" },
          }}
        />
        <Text size="xs" c={colors.textSecondary} fw={500}>
          Select folders this team owns:
        </Text>
        <FolderPicker
          jobs={instanceJobs ?? []}
          selected={selectedPatterns}
          onToggle={togglePattern}
        />
        <Group>
          <Button
            size="xs"
            color="orange"
            onClick={() => createMutation.mutate()}
            loading={createMutation.isPending}
            disabled={!name || selectedPatterns.size === 0}
          >
            Create
          </Button>
          <Button
            size="xs"
            variant="subtle"
            color="gray"
            onClick={onCancel}
          >
            Cancel
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
