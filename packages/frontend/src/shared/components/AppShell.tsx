import {
  AppShell as MantineAppShell,
  Group,
  Title,
  Text,
  Button,
  Box,
  Stack,
  Tooltip,
  Badge,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../store/auth-store";
import { tigAiCost, tigDashboard } from "../../api/tig-client";

const NAV_ITEMS = [
  { label: "Dashboard", path: "/" },
  { label: "Failures", path: "/failures" },
  { label: "Health", path: "/health" },
] as const;

function FailureCount() {
  const instanceId = useAuthStore((s) => s.instanceId);
  const { data } = useQuery({
    queryKey: ["all-failures", instanceId],
    queryFn: () => tigDashboard.failures(instanceId ?? undefined, 50),
    refetchInterval: 30_000,
  });
  const count = data?.length ?? 0;
  if (count === 0) return null;
  return (
    <Badge size="xs" color="red" variant="filled" circle>
      {count}
    </Badge>
  );
}

function AiCostBadge() {
  const { data } = useQuery({
    queryKey: ["ai-cost"],
    queryFn: () => tigAiCost.get(),
    refetchInterval: 60_000,
  });
  if (!data || data.totalCostUsd === 0) return null;
  return (
    <Tooltip
      label={`${data.aiAnalyzedCount} builds analyzed · ~$${data.avgCostPerAnalysis.toFixed(4)}/build`}
      w={260}
    >
      <Text
        size="xs"
        c="dimmed"
        style={{ fontFamily: "monospace", cursor: "default" }}
      >
        AI ${data.totalCostUsd.toFixed(2)}
      </Text>
    </Tooltip>
  );
}

export function AppShellLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <MantineAppShell
      navbar={{ width: 220, breakpoint: "sm" }}
      header={{ height: 52 }}
      padding="md"
      styles={{
        main: { backgroundColor: "#0f1117", minHeight: "100vh" },
        header: {
          backgroundColor: "#0f1117",
          borderBottom: "1px solid #1e2030",
        },
        navbar: {
          backgroundColor: "#0f1117",
          borderRight: "1px solid #1e2030",
        },
      }}
    >
      <MantineAppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="xs">
            <Title order={4} c="#e2e8f0">
              PulsCI
            </Title>
            <Text size="xs" c="#475569">
              by That Infrastructure Guy
            </Text>
          </Group>
          <Group gap="sm">
            <AiCostBadge />
            {user && (
              <Text size="xs" c="#64748b">
                {user.name}
              </Text>
            )}
            <Button
              size="xs"
              variant="subtle"
              color="gray"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              Sign Out
            </Button>
          </Group>
        </Group>
      </MantineAppShell.Header>

      <MantineAppShell.Navbar p="xs" pt="md">
        <Stack gap={2}>
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Box
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  cursor: "pointer",
                  padding: "8px 12px",
                  borderRadius: 6,
                  backgroundColor: isActive ? "#1e2030" : "transparent",
                  transition: "background-color 0.1s",
                }}
              >
                <Group justify="space-between">
                  <Text
                    size="sm"
                    fw={isActive ? 600 : 400}
                    c={isActive ? "#e2e8f0" : "#64748b"}
                  >
                    {item.label}
                  </Text>
                  {item.path === "/failures" && <FailureCount />}
                </Group>
              </Box>
            );
          })}
        </Stack>
      </MantineAppShell.Navbar>

      <MantineAppShell.Main>
        <Outlet />
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}
