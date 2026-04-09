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
import { useHover } from "../hooks/use-hover";
import { useAuthStore } from "../../store/auth-store";
import {
  tigAiCost,
  tigAiHealth,
  tigDashboard,
  tigHealth,
  tigMe,
} from "../../api/tig-client";
import { colors } from "../../theme/mantine-theme";

const BASE_NAV_ITEMS: readonly NavItem[] = [
  { label: "Failures", path: "/", icon: "⚡" },
  { label: "Trends", path: "/trends", icon: "◆" },
];

const ADMIN_NAV_ITEM: NavItem = {
  label: "Users",
  path: "/admin/users",
  icon: "☺",
};

interface NavItem {
  readonly label: string;
  readonly path: string;
  readonly icon: string;
}

import "../styles/animations.css";

function HealthIndicator() {
  const instanceId = useAuthStore((s) => s.instanceId);
  const { data: h } = useQuery({
    queryKey: ["health-current", instanceId],
    queryFn: () => (instanceId ? tigHealth.current(instanceId) : null),
    enabled: !!instanceId,
    refetchInterval: 30_000,
  });
  if (!h) return null;
  const color =
    h.level === "healthy"
      ? colors.success
      : h.level === "degraded"
        ? colors.warning
        : colors.failure;
  return (
    <Tooltip
      label={`${h.score}/100 · ${h.agentsOnline}/${h.agentsTotal} agents · ${h.queueDepth} queued${h.issues.length > 0 ? ` · ${h.issues[0]}` : ""}`}
      w={300}
      multiline
    >
      <Group gap={6} style={{ cursor: "default" }}>
        <Box
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: color,
            boxShadow: h.level !== "healthy" ? `0 0 6px ${color}80` : undefined,
          }}
        />
        <Text size="xs" fw={600} c={color} tt="capitalize">
          {h.level}
        </Text>
      </Group>
    </Tooltip>
  );
}

function FailureCount() {
  const instanceId = useAuthStore((s) => s.instanceId);
  const { data } = useQuery({
    queryKey: ["all-failures", instanceId],
    queryFn: () => tigDashboard.failures(instanceId ?? undefined, 50),
    refetchInterval: 30_000,
  });
  const jobPaths = new Set(
    (data ?? []).map((f: Record<string, unknown>) => f.jobFullPath),
  );
  if (jobPaths.size === 0) return null;
  return (
    <Badge
      size="xs"
      color="red"
      variant="filled"
      style={{ animation: "pulsci-pulse 2s infinite" }}
    >
      {jobPaths.size}
    </Badge>
  );
}

function AiStatusBadge() {
  const { data: health } = useQuery({
    queryKey: ["ai-health"],
    queryFn: () => tigAiHealth.get(),
    refetchInterval: 30_000,
  });

  const { data: cost } = useQuery({
    queryKey: ["ai-cost"],
    queryFn: () => tigAiCost.get(),
    refetchInterval: 60_000,
  });

  if (!health) return null;

  if (health.status === "unhealthy") {
    return (
      <Tooltip
        label={health.message ?? "AI service is not reachable."}
        w={280}
        multiline
      >
        <Text
          size="xs"
          c={colors.failure}
          fw={600}
          style={{ cursor: "default" }}
        >
          ⚠ AI offline
        </Text>
      </Tooltip>
    );
  }

  if (health.status === "unknown") {
    return (
      <Tooltip
        label={health.message ?? "AI health check not running."}
        w={280}
        multiline
      >
        <Text
          size="xs"
          c={colors.warning}
          fw={600}
          style={{ cursor: "default" }}
        >
          ⚠ AI unknown
        </Text>
      </Tooltip>
    );
  }

  // Healthy — show cost
  if (!cost || cost.totalCostUsd === 0) return null;
  return (
    <Tooltip
      label={`${cost.aiAnalyzedCount} builds analyzed · ~$${cost.avgCostPerAnalysis.toFixed(4)}/build · ${health.responseTimeMs ?? "?"}ms latency`}
      w={300}
      multiline
    >
      <Text
        size="xs"
        c={colors.textTertiary}
        style={{ fontFamily: "monospace", cursor: "default" }}
      >
        AI ${cost.totalCostUsd.toFixed(2)}
      </Text>
    </Tooltip>
  );
}

export function AppShellLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { hovered: hoveredPath, bind: hoverBind } = useHover<string>();

  const { data: meData } = useQuery({
    queryKey: ["me"],
    queryFn: () => tigMe.get(),
    staleTime: 60_000,
  });

  const isAdmin = meData?.role === "admin";
  const navItems = isAdmin
    ? [...BASE_NAV_ITEMS, ADMIN_NAV_ITEM]
    : BASE_NAV_ITEMS;

  return (
    <MantineAppShell
      navbar={{ width: 220, breakpoint: "sm" }}
      header={{ height: 56 }}
      padding="md"
      styles={{
        main: {
          background: colors.bgGradient,
          minHeight: "100vh",
        },
        header: {
          backgroundColor: "rgba(30, 33, 40, 0.88)",
          borderBottom: `1px solid ${colors.border}`,
          backdropFilter: "blur(14px)",
        },
        navbar: {
          backgroundColor: "rgba(28, 31, 38, 0.92)",
          borderRight: `1px solid ${colors.border}`,
          backdropFilter: "blur(14px)",
        },
      }}
    >
      <MantineAppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="xs">
            <Title
              order={4}
              style={{
                background: colors.accentGradient,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              PulsCI
            </Title>
            <Text size="xs" c={colors.textMuted}>
              by That Infrastructure Guy
            </Text>
          </Group>
          <HealthIndicator />
          <Group gap="sm">
            <AiStatusBadge />
            {user && (
              <Text size="xs" c={colors.textTertiary}>
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
        <Stack gap={4}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const isHovered = hoveredPath === item.path && !isActive;
            return (
              <Box
                key={item.path}
                onClick={() => navigate(item.path)}
                {...hoverBind(item.path)}
                style={{
                  cursor: "pointer",
                  padding: "10px 14px",
                  borderRadius: 8,
                  backgroundColor: isActive
                    ? colors.accentMuted
                    : isHovered
                      ? "rgba(245, 103, 64, 0.06)"
                      : "transparent",
                  border: isActive
                    ? `1px solid ${colors.borderHover}`
                    : isHovered
                      ? `1px solid ${colors.border}`
                      : "1px solid transparent",
                  transition: "all 0.15s ease",
                }}
              >
                <Group justify="space-between">
                  <Group gap={8}>
                    <Text
                      size="sm"
                      c={isActive ? colors.accent : colors.textMuted}
                      style={{ width: 16, textAlign: "center" }}
                    >
                      {item.icon}
                    </Text>
                    <Text
                      size="sm"
                      fw={isActive ? 600 : 400}
                      c={isActive ? colors.text : colors.textTertiary}
                    >
                      {item.label}
                    </Text>
                  </Group>
                  {item.path === "/" && <FailureCount />}
                </Group>
              </Box>
            );
          })}
        </Stack>
      </MantineAppShell.Navbar>

      <MantineAppShell.Main>
        <Box style={{ animation: "fadeIn 0.2s ease" }}>
          <Outlet />
        </Box>
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}
