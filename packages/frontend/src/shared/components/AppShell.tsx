import {
  AppShell as MantineAppShell,
  Group,
  Text,
  Button,
  Box,
  Stack,
  Tooltip,
  Badge,
  Divider,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconActivity,
  IconChartBar,
  IconUsers,
  IconLogout,
  IconWaveSine,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import type { ComponentType } from "react";
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
import "../styles/animations.css";

// ─── Nav config ─────────────────────────────────────────────
interface NavItem {
  readonly label: string;
  readonly path: string;
  readonly icon: ComponentType<{ size?: number; stroke?: number; color?: string }>;
}

const BASE_NAV_ITEMS: readonly NavItem[] = [
  { label: "Failures", path: "/", icon: IconAlertTriangle },
  { label: "Health", path: "/health", icon: IconActivity },
  { label: "Trends", path: "/trends", icon: IconChartBar },
];

const ADMIN_NAV_ITEM: NavItem = {
  label: "Users",
  path: "/admin/users",
  icon: IconUsers,
};

// ─── Brand mark ─────────────────────────────────────────────
function BrandMark() {
  return (
    <Group gap={10} pl={4}>
      <Box
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          background: colors.accentGradient,
          boxShadow: `0 0 14px ${colors.accentGlow}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <IconWaveSine size={16} stroke={2.5} color="#FFFFFF" />
      </Box>
      <Stack gap={0}>
        <Text fw={800} size="md" c={colors.text} style={{ letterSpacing: "-0.02em", lineHeight: 1.1 }}>
          PulsCI
        </Text>
        <Text size="xs" c={colors.textMuted} style={{ lineHeight: 1.1 }}>
          by That Infrastructure Guy
        </Text>
      </Stack>
    </Group>
  );
}

// ─── Failure count badge for sidebar ───────────────────────
function FailureCount() {
  const instanceId = useAuthStore((s) => s.instanceId);
  const { data } = useQuery({
    queryKey: ["sidebar-failure-count", instanceId],
    queryFn: () => tigDashboard.failures(instanceId ?? undefined, 50),
    refetchInterval: 30_000,
  });
  const groups = data?.data ?? [];
  const broken = groups.filter((g) => g.status === "broken");
  if (broken.length === 0) return null;
  return (
    <Badge
      size="sm"
      variant="filled"
      style={{
        backgroundColor: colors.priorityBlocker,
        color: colors.priorityBlockerFg,
        border: `1px solid ${colors.priorityBlockerBorder}`,
      }}
    >
      {broken.length}
    </Badge>
  );
}

// ─── Health pill (footer) ──────────────────────────────────
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
            animation:
              h.level === "healthy" ? "health-pulse 3s infinite" : undefined,
          }}
        />
        <Text size="xs" fw={600} c={color} tt="capitalize">
          {h.level}
        </Text>
      </Group>
    </Tooltip>
  );
}

// ─── AI cost / status (footer) ─────────────────────────────
function AiStatusLine() {
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
      <Tooltip label={health.message ?? "AI service is not reachable."} w={280} multiline>
        <Text size="xs" c={colors.failure} fw={600} style={{ cursor: "default" }}>
          AI offline
        </Text>
      </Tooltip>
    );
  }
  if (health.status === "unknown") {
    return (
      <Tooltip label={health.message ?? "AI health check not running."} w={280} multiline>
        <Text size="xs" c={colors.warning} fw={600} style={{ cursor: "default" }}>
          AI unknown
        </Text>
      </Tooltip>
    );
  }
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

// ─── Layout ────────────────────────────────────────────────
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
      navbar={{ width: 240, breakpoint: "sm" }}
      padding="xl"
      styles={{
        main: {
          background: colors.bgGradient,
          minHeight: "100vh",
        },
        navbar: {
          backgroundColor: colors.surfaceLight,
          borderRight: `1px solid ${colors.border}`,
        },
      }}
    >
      <MantineAppShell.Navbar p={0}>
        <Stack gap={0} h="100%" style={{ paddingTop: 20, paddingBottom: 16 }}>
          {/* Brand */}
          <Box pl={16} pb={20}>
            <BrandMark />
          </Box>
          <Divider color={colors.border} mx={12} mb={12} />

          {/* Nav */}
          <Stack gap={2} px={10} style={{ flex: 1 }}>
            {navItems.map((item) => {
              const isActive =
                item.path === "/"
                  ? location.pathname === "/" ||
                    location.pathname === "/failures"
                  : location.pathname === item.path;
              const isHovered = hoveredPath === item.path && !isActive;
              const Icon = item.icon;
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
                    borderLeft: isActive
                      ? `2px solid ${colors.accent}`
                      : "2px solid transparent",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap={10} wrap="nowrap">
                      <Icon
                        size={16}
                        stroke={2}
                        color={isActive ? colors.accent : colors.textTertiary}
                      />
                      <Text
                        size="sm"
                        fw={isActive ? 600 : 500}
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

          {/* Footer */}
          <Stack gap={8} px={16}>
            <Divider color={colors.border} />
            <Group gap="xs" justify="space-between">
              <HealthIndicator />
              <AiStatusLine />
            </Group>
            <Group gap="xs" justify="space-between" wrap="nowrap">
              {user && (
                <Text size="xs" c={colors.textSecondary} truncate>
                  {user.name}
                </Text>
              )}
              <Tooltip label="Sign out">
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="gray"
                  onClick={() => {
                    logout();
                    navigate("/login");
                  }}
                  px={6}
                >
                  <IconLogout size={14} stroke={2} />
                </Button>
              </Tooltip>
            </Group>
          </Stack>
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
