import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Stack,
  Title,
  Text,
  Card,
  Group,
  Button,
  TextInput,
  Badge,
  ActionIcon,
  Tooltip,
  Loader,
  Checkbox,
  ScrollArea,
} from "@mantine/core";
import { tigTeams } from "../../api/tig-client";
import { useAuthStore } from "../../store/auth-store";

const CARD = { backgroundColor: "#1e2030", border: "none" };

interface FolderNode {
  name: string;
  path: string;
  children: FolderNode[];
  jobCount: number;
}

function buildFolderTree(jobs: { fullPath: string }[]): FolderNode[] {
  const root: FolderNode[] = [];

  for (const job of jobs) {
    const parts = job.fullPath.split("/");
    // We want folders, not leaf jobs — use all but the last segment
    if (parts.length < 2) continue;
    const folderParts = parts.slice(0, -1);

    let current = root;
    let currentPath = "";
    for (const part of folderParts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let node = current.find((n) => n.name === part);
      if (!node) {
        node = { name: part, path: currentPath, children: [], jobCount: 0 };
        current.push(node);
      }
      node.jobCount++;
      current = node.children;
    }
  }

  return root;
}

function FolderCheckboxes({
  nodes,
  selected,
  onToggle,
  depth,
}: {
  nodes: FolderNode[];
  selected: Set<string>;
  onToggle: (path: string) => void;
  depth: number;
}) {
  return (
    <Stack gap={2} pl={depth * 16}>
      {nodes.map((node) => (
        <div key={node.path}>
          <Checkbox
            size="xs"
            label={
              <Group gap={6}>
                <Text
                  size="xs"
                  c={selected.has(node.path + "/**") ? "#e2e8f0" : "#94a3b8"}
                >
                  {node.name}
                </Text>
                <Text size="xs" c="#475569">
                  {node.jobCount} jobs
                </Text>
              </Group>
            }
            checked={selected.has(node.path + "/**")}
            onChange={() => onToggle(node.path + "/**")}
            styles={{
              input: { backgroundColor: "#161822", borderColor: "#2d3148" },
            }}
          />
          {node.children.length > 0 && (
            <FolderCheckboxes
              nodes={node.children}
              selected={selected}
              onToggle={onToggle}
              depth={depth + 1}
            />
          )}
        </div>
      ))}
    </Stack>
  );
}

export function TeamsPage() {
  const queryClient = useQueryClient();
  const instanceId = useAuthStore((s) => s.instanceId);
  const orgId = useAuthStore((s) => s.organizationId);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedPatterns, setSelectedPatterns] = useState<Set<string>>(
    new Set(),
  );

  const { data: teams, isLoading } = useQuery({
    queryKey: ["teams"],
    queryFn: () => tigTeams.list(),
  });

  // Fetch all jobs to build the folder tree
  const { data: allJobs } = useQuery({
    queryKey: ["all-jobs-for-tree", instanceId],
    queryFn: () => (instanceId ? tigTeams.jobs("__all__").catch(() => []) : []),
    enabled: !!instanceId && creating,
  });

  // Actually, we need all jobs from the instance, not from a team.
  // Let me use the instance jobs endpoint instead
  const { data: instanceJobs } = useQuery({
    queryKey: ["instance-jobs", instanceId],
    queryFn: async () => {
      if (!instanceId) return [];
      const response = await fetch(
        `/api/v1/instances/${instanceId}/jobs?limit=500`,
        {
          credentials: "include",
        },
      );
      if (!response.ok) return [];
      const json = await response.json();
      return json.data ?? [];
    },
    enabled: !!instanceId && creating,
  });

  const folderTree = buildFolderTree(instanceJobs ?? []);

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
        name: newName,
        ciInstanceId: instanceId!,
        organizationId: orgId!,
        folderPatterns: Array.from(selectedPatterns),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      setCreating(false);
      setNewName("");
      setSelectedPatterns(new Set());
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tigTeams.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
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
        <Title order={3} c="#e2e8f0">
          Teams
        </Title>
        {!creating && (
          <Button size="xs" onClick={() => setCreating(true)}>
            New Team
          </Button>
        )}
      </Group>

      {creating && (
        <Card radius="md" style={CARD} p="md">
          <Stack gap="sm">
            <Text size="sm" fw={600} c="#e2e8f0">
              Create Team
            </Text>
            <TextInput
              placeholder="Team name (e.g., Backend, Frontend, Automation)"
              value={newName}
              onChange={(e) => setNewName(e.currentTarget.value)}
              styles={{ input: { backgroundColor: "#161822", border: "none" } }}
            />
            <Text size="xs" c="#94a3b8" fw={500}>
              Select folders this team owns:
            </Text>
            <ScrollArea h={300} type="auto">
              <Card radius="md" p="sm" style={{ backgroundColor: "#161822" }}>
                {folderTree.length > 0 ? (
                  <FolderCheckboxes
                    nodes={folderTree}
                    selected={selectedPatterns}
                    onToggle={togglePattern}
                    depth={0}
                  />
                ) : (
                  <Text size="xs" c="#475569">
                    Loading folder structure...
                  </Text>
                )}
              </Card>
            </ScrollArea>
            {selectedPatterns.size > 0 && (
              <Group gap={4}>
                {Array.from(selectedPatterns).map((p) => (
                  <Badge key={p} size="xs" variant="light" color="blue">
                    {p}
                  </Badge>
                ))}
              </Group>
            )}
            <Group>
              <Button
                size="xs"
                onClick={() => createMutation.mutate()}
                loading={createMutation.isPending}
                disabled={!newName || selectedPatterns.size === 0}
              >
                Create
              </Button>
              <Button
                size="xs"
                variant="subtle"
                color="gray"
                onClick={() => {
                  setCreating(false);
                  setSelectedPatterns(new Set());
                }}
              >
                Cancel
              </Button>
            </Group>
          </Stack>
        </Card>
      )}

      {(!teams || teams.length === 0) && !creating && (
        <Card radius="md" style={CARD} p="xl">
          <Stack align="center" gap="xs">
            <Text size="sm" c="#64748b">
              No teams yet
            </Text>
            <Text size="xs" c="#475569">
              Create teams to scope failures by project. Developers see only
              what's theirs.
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
                  <Text size="sm" fw={500} c="#e2e8f0">
                    {team.name}
                  </Text>
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
