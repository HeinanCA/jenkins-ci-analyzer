import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Stack,
  Card,
  Group,
  Text,
  Badge,
  Select,
  ActionIcon,
  Modal,
  Button,
  TextInput,
  CopyButton,
  Tooltip,
  Divider,
} from "@mantine/core";
import { tigAdmin, tigInvitations } from "../../api/tig-client";
import { colors, cardStyle } from "../../theme/mantine-theme";
import { PageHeader } from "../../shared/components/PageHeader";
import { LoadingState } from "../../shared/components/LoadingState";
import { QueryError } from "../../shared/components/QueryError";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
  { value: "viewer", label: "Viewer" },
];

const ROLE_COLORS: Record<string, string> = {
  admin: colors.success,
  member: colors.accent,
  viewer: colors.textTertiary,
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface ConfirmRemoveState {
  readonly userId: string;
  readonly email: string;
}

export function UsersPage() {
  const queryClient = useQueryClient();
  const [confirmRemove, setConfirmRemove] = useState<ConfirmRemoveState | null>(
    null,
  );
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => tigAdmin.listUsers(),
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      tigAdmin.updateRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => tigAdmin.removeUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setConfirmRemove(null);
    },
  });

  const inviteMutation = useMutation({
    mutationFn: (email: string) => tigInvitations.create(email),
    onSuccess: (data) => {
      setInviteEmail("");
      setInviteLink(data.inviteUrl ?? data.token ?? null);
      queryClient.invalidateQueries({ queryKey: ["admin-invitations"] });
    },
  });

  const pendingInvites = useQuery({
    queryKey: ["admin-invitations"],
    queryFn: () => tigInvitations.list(),
  });

  if (usersQuery.isLoading) return <LoadingState />;

  if (usersQuery.isError) {
    return (
      <QueryError
        message={usersQuery.error?.message}
        onRetry={usersQuery.refetch}
      />
    );
  }

  const userList = usersQuery.data ?? [];

  return (
    <Stack gap="md">
      <PageHeader title="Users" />

      {/* Invite section */}
      <Card radius="md" style={cardStyle} p="md">
        <Text size="sm" fw={600} c={colors.text} mb="sm">
          Invite a user
        </Text>
        <Group gap="xs">
          <TextInput
            placeholder="email@company.com"
            size="xs"
            value={inviteEmail}
            onChange={(e) => {
              setInviteEmail(e.currentTarget.value);
              setInviteLink(null);
            }}
            style={{ flex: 1 }}
            styles={{
              input: {
                backgroundColor: colors.surfaceSolid,
                borderColor: colors.border,
                color: colors.text,
              },
            }}
          />
          <Button
            size="xs"
            color="orange"
            loading={inviteMutation.isPending}
            disabled={!inviteEmail.includes("@")}
            onClick={() => inviteMutation.mutate(inviteEmail)}
          >
            Send Invite
          </Button>
        </Group>
        {inviteLink && (
          <Group gap="xs" mt="sm">
            <TextInput
              size="xs"
              value={inviteLink}
              readOnly
              style={{ flex: 1 }}
              styles={{
                input: {
                  backgroundColor: colors.surfaceLight,
                  borderColor: colors.border,
                  color: colors.textSecondary,
                  fontFamily: "monospace",
                  fontSize: 11,
                },
              }}
            />
            <CopyButton value={inviteLink}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? "Copied!" : "Copy link"}>
                  <Button
                    size="xs"
                    variant="light"
                    color={copied ? "green" : "orange"}
                    onClick={copy}
                  >
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </Tooltip>
              )}
            </CopyButton>
          </Group>
        )}
        {inviteMutation.isError && (
          <Text size="xs" c={colors.failure} mt="xs">
            {inviteMutation.error?.message ?? "Failed to create invitation"}
          </Text>
        )}
      </Card>

      {/* Pending invitations */}
      {(pendingInvites.data ?? []).length > 0 && (
        <Card radius="md" style={cardStyle} p="md">
          <Text size="xs" fw={600} c={colors.textTertiary} mb="xs">
            Pending invitations
          </Text>
          {(pendingInvites.data ?? []).map((inv) => (
            <Group key={inv.id} justify="space-between" py={4}>
              <Text size="xs" c={colors.textSecondary}>
                {inv.email}
              </Text>
              <Group gap="xs">
                <Text size="xs" c={colors.textMuted}>
                  Expires {formatDate(inv.expiresAt)}
                </Text>
                <Badge size="xs" variant="light" color="orange">
                  {inv.role}
                </Badge>
              </Group>
            </Group>
          ))}
        </Card>
      )}

      <Divider color={colors.border} />

      {userList.length === 0 && (
        <Card radius="md" style={cardStyle} p="xl">
          <Text size="sm" c={colors.textTertiary} ta="center">
            No users found
          </Text>
        </Card>
      )}

      {userList.map((u) => (
        <Card key={u.id} radius="md" style={cardStyle} p="sm">
          <Group justify="space-between" wrap="nowrap">
            <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
              <Group gap="xs">
                <Text size="sm" fw={600} c={colors.text} truncate>
                  {u.displayName}
                </Text>
                <Badge
                  size="xs"
                  variant="light"
                  styles={{
                    root: { color: ROLE_COLORS[u.role] ?? colors.textTertiary },
                  }}
                >
                  {u.role}
                </Badge>
              </Group>
              <Group gap="xs">
                <Text size="xs" c={colors.textTertiary} truncate>
                  {u.email}
                </Text>
                <Text size="xs" c={colors.textMuted}>
                  Joined {formatDate(u.createdAt)}
                </Text>
              </Group>
            </Stack>

            <Group gap="xs" wrap="nowrap">
              <Select
                size="xs"
                data={ROLE_OPTIONS}
                value={u.role}
                onChange={(value) => {
                  if (value && value !== u.role) {
                    roleMutation.mutate({ userId: u.id, role: value });
                  }
                }}
                styles={{
                  input: {
                    backgroundColor: colors.surfaceSolid,
                    borderColor: colors.border,
                    color: colors.text,
                    width: 110,
                  },
                }}
              />
              <ActionIcon
                size="sm"
                variant="subtle"
                color="red"
                onClick={() =>
                  setConfirmRemove({ userId: u.id, email: u.email })
                }
                title="Remove user"
              >
                x
              </ActionIcon>
            </Group>
          </Group>
        </Card>
      ))}

      <Modal
        opened={confirmRemove !== null}
        onClose={() => setConfirmRemove(null)}
        title="Remove user"
        size="sm"
        styles={{
          header: { backgroundColor: colors.surfaceSolid },
          body: { backgroundColor: colors.surfaceSolid },
        }}
      >
        <Stack gap="md">
          <Text size="sm" c={colors.text}>
            Remove <strong>{confirmRemove?.email}</strong> from the
            organization? They will lose access to all data.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button
              size="xs"
              variant="subtle"
              color="gray"
              onClick={() => setConfirmRemove(null)}
            >
              Cancel
            </Button>
            <Button
              size="xs"
              color="red"
              loading={removeMutation.isPending}
              onClick={() => {
                if (confirmRemove) {
                  removeMutation.mutate(confirmRemove.userId);
                }
              }}
            >
              Remove
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
