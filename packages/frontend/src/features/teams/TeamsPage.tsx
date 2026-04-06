import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Stack, Card, Text, Button } from "@mantine/core";
import { tigTeams } from "../../api/tig-client";
import { useAuthStore } from "../../store/auth-store";
import { colors, cardStyle } from "../../theme/mantine-theme";
import { PageHeader } from "../../shared/components/PageHeader";
import { LoadingState } from "../../shared/components/LoadingState";
import { QueryError } from "../../shared/components/QueryError";
import { TeamCreateForm } from "./components/TeamCreateForm";
import { TeamCard } from "./components/TeamCard";

export function TeamsPage() {
  const queryClient = useQueryClient();
  const instanceId = useAuthStore((s) => s.instanceId);
  const [creating, setCreating] = useState(false);

  const teamsQuery = useQuery({
    queryKey: ["teams"],
    queryFn: () => tigTeams.list(),
  });

  const { data: teams, isLoading } = teamsQuery;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tigTeams.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });

  if (isLoading) {
    return <LoadingState />;
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
      <PageHeader title="Teams">
        {!creating && (
          <Button size="xs" color="orange" onClick={() => setCreating(true)}>
            New Team
          </Button>
        )}
      </PageHeader>

      {creating && instanceId && (
        <TeamCreateForm
          instanceId={instanceId}
          onCreated={() => setCreating(false)}
          onCancel={() => setCreating(false)}
        />
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
            <TeamCard
              key={team.id}
              team={team}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
