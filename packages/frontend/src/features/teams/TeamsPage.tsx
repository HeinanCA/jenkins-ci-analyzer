import { useState, useMemo } from "react";
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
import { tigTeams, tigInstances } from "../../api/tig-client";
import { useAuthStore } from "../../store/auth-store";
import { colors, cardStyle } from "../../theme/mantine-theme";
import { QueryError } from "../../shared/components/QueryError";

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

function filterTree(nodes: FolderNode[], search: string): FolderNode[] {
  if (!search) return nodes;
  const lower = search.toLowerCase();
  return nodes
    .map((node) => {
      const childMatches = filterTree(node.children, search);
      const nameMatches = node.name.toLowerCase().includes(lower);
      if (nameMatches || childMatches.length > 0) {
        return { ...node, children: childMatches };
      }
      return null;
    })
    .filter((n): n is FolderNode => n !== null);
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
      {nodes.map((node) => {
        const pattern = node.path + "/**";
        const isChecked = selected.has(pattern);
        const hasChildChecked = node.children.some((c) =>
          selected.has(c.path + "/**"),
        );
        return (
          <div key={node.path}>
            <Checkbox
              size="xs"
              label={
                <Group gap={6}>
                  <Text
                    size="xs"
                    c={isChecked ? colors.text : colors.textSecondary}
                  >
                    {node.name}
                  </Text>
                  <Text size="xs" c={colors.textMuted}>
                    {node.jobCount}
                  </Text>
                </Group>
              }
              checked={isChecked}
              indeterminate={!isChecked && hasChildChecked}
              onChange={() => onToggle(pattern)}
              styles={{
                input: {
                  backgroundColor: colors.surfaceLight,
                  borderColor: colors.border,
                },
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
        );
      })}
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
  const [treeSearch, setTreeSearch] = useState("");

  const teamsQuery = useQuery({
    queryKey: ["teams"],
    queryFn: () => tigTeams.list(),
  });

  const { data: teams, isLoading } = teamsQuery;

  const { data: instanceJobs } = useQuery({
    queryKey: ["instance-jobs", instanceId],
    queryFn: () => (instanceId ? tigInstances.jobs(instanceId) : []),
    enabled: !!instanceId,
    staleTime: 60_000,
  });

  const folderTree = useMemo(
    () => buildFolderTree(instanceJobs ?? []),
    [instanceJobs],
  );
  const filteredTree = useMemo(
    () => filterTree(folderTree, treeSearch),
    [folderTree, treeSearch],
  );

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
      setTreeSearch("");
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
        <Loader color="orange" size="sm" />
      </Stack>
    );
  }

  if (teamsQuery.isError) {
    return (
      <QueryError
        message={teamsQuery.error?.message}
        onRetry={teamsQuery.refetch}
      />
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={3} c={colors.text}>
          Teams
        </Title>
        {!creating && (
          <Button size="xs" color="orange" onClick={() => setCreating(true)}>
            New Team
          </Button>
        )}
      </Group>

      {creating && (
        <Card radius="md" style={cardStyle} p="md">
          <Stack gap="sm">
            <Text size="sm" fw={600} c={colors.text}>
              Create Team
            </Text>
            <TextInput
              placeholder="Team name (e.g., Backend, Frontend, Automation)"
              value={newName}
              onChange={(e) => setNewName(e.currentTarget.value)}
              styles={{
                input: { backgroundColor: colors.surfaceLight, border: "none" },
              }}
            />
            <Text size="xs" c={colors.textSecondary} fw={500}>
              Select folders this team owns:
            </Text>
            <TextInput
              placeholder="Search folders..."
              size="xs"
              value={treeSearch}
              onChange={(e) => setTreeSearch(e.currentTarget.value)}
              styles={{
                input: { backgroundColor: colors.surfaceLight, border: "none" },
              }}
            />
            <ScrollArea h={280} type="auto">
              <Card
                radius="md"
                p="sm"
                style={{ backgroundColor: colors.surfaceLight }}
              >
                {filteredTree.length > 0 ? (
                  <FolderCheckboxes
                    nodes={filteredTree}
                    selected={selectedPatterns}
                    onToggle={togglePattern}
                    depth={0}
                  />
                ) : (
                  <Text size="xs" c={colors.textMuted}>
                    {treeSearch ? "No matching folders" : "Loading..."}
                  </Text>
                )}
              </Card>
            </ScrollArea>
            {selectedPatterns.size > 0 && (
              <Group gap={4}>
                {Array.from(selectedPatterns).map((p) => (
                  <Badge
                    key={p}
                    size="xs"
                    variant="light"
                    color="orange"
                    rightSection={
                      <ActionIcon
                        size={12}
                        variant="transparent"
                        onClick={() => togglePattern(p)}
                      >
                        <Text size="xs" c={colors.textMuted}>
                          ✕
                        </Text>
                      </ActionIcon>
                    }
                  >
                    {p}
                  </Badge>
                ))}
              </Group>
            )}
            <Group>
              <Button
                size="xs"
                color="orange"
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
                  setTreeSearch("");
                }}
              >
                Cancel
              </Button>
            </Group>
          </Stack>
        </Card>
      )}

      {(!teams || teams.length === 0) && !creating && (
        <Card radius="md" style={cardStyle} p="xl">
          <Stack align="center" gap="xs">
            <Text size="sm" c={colors.textTertiary}>
              No teams yet
            </Text>
            <Text size="xs" c={colors.textMuted}>
              Create teams to scope failures by project.
            </Text>
          </Stack>
        </Card>
      )}

      {teams && teams.length > 0 && (
        <Stack gap="xs">
          {teams.map((team) => (
            <Card key={team.id} radius="md" style={cardStyle} p="sm">
              <Group justify="space-between">
                <Stack gap={2}>
                  <Text size="sm" fw={500} c={colors.text}>
                    {team.name}
                  </Text>
                  <Group gap={4}>
                    {team.folderPatterns.map((p, i) => (
                      <Badge key={i} size="xs" variant="light" color="orange">
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
