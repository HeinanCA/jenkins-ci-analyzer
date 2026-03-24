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
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth-store';
import { tigAiCost, tigDashboard } from '../../api/tig-client';
import { colors } from '../../theme/mantine-theme';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/' },
  { label: 'Failures', path: '/failures' },
  { label: 'Health', path: '/health' },
  { label: 'Teams', path: '/teams' },
] as const;

function FailureCount() {
  const instanceId = useAuthStore((s) => s.instanceId);
  const { data } = useQuery({
    queryKey: ['all-failures', instanceId],
    queryFn: () => tigDashboard.failures(instanceId ?? undefined, 50),
    refetchInterval: 30_000,
  });
  const jobPaths = new Set((data ?? []).map((f: Record<string, unknown>) => f.jobFullPath));
  if (jobPaths.size === 0) return null;
  return (
    <Badge size="xs" color="red" variant="filled">
      {jobPaths.size}
    </Badge>
  );
}

function AiCostBadge() {
  const { data } = useQuery({
    queryKey: ['ai-cost'],
    queryFn: () => tigAiCost.get(),
    refetchInterval: 60_000,
  });
  if (!data) return null;

  const aiDown = (data as Record<string, unknown>).aiStatus === 'degraded';

  if (aiDown) {
    return (
      <Tooltip label="AI analysis is not running. Check AWS credentials." w={280} multiline>
        <Text size="xs" c={colors.failure} fw={600} style={{ cursor: 'default' }}>
          ⚠ AI offline
        </Text>
      </Tooltip>
    );
  }

  if (data.totalCostUsd === 0) return null;
  return (
    <Tooltip
      label={`${data.aiAnalyzedCount} builds analyzed · ~$${data.avgCostPerAnalysis.toFixed(4)}/build`}
      w={260}
    >
      <Text size="xs" c={colors.textTertiary} style={{ fontFamily: 'monospace', cursor: 'default' }}>
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
      navbar={{ width: 220, breakpoint: 'sm' }}
      header={{ height: 56 }}
      padding="md"
      styles={{
        main: {
          background: colors.bgGradient,
          minHeight: '100vh',
        },
        header: {
          backgroundColor: 'rgba(12, 14, 22, 0.9)',
          borderBottom: `1px solid ${colors.border}`,
          backdropFilter: 'blur(12px)',
        },
        navbar: {
          backgroundColor: 'rgba(12, 14, 22, 0.95)',
          borderRight: `1px solid ${colors.border}`,
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
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              PulsCI
            </Title>
            <Text size="xs" c={colors.textMuted}>
              by That Infrastructure Guy
            </Text>
          </Group>
          <Group gap="sm">
            <AiCostBadge />
            {user && (
              <Text size="xs" c={colors.textTertiary}>
                {user.name}
              </Text>
            )}
            <Button
              size="xs"
              variant="subtle"
              color="gray"
              onClick={() => { logout(); navigate('/login'); }}
            >
              Sign Out
            </Button>
          </Group>
        </Group>
      </MantineAppShell.Header>

      <MantineAppShell.Navbar p="xs" pt="md">
        <Stack gap={4}>
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Box
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  cursor: 'pointer',
                  padding: '10px 14px',
                  borderRadius: 8,
                  backgroundColor: isActive ? colors.surface : 'transparent',
                  borderLeft: isActive
                    ? `3px solid ${colors.accent}`
                    : '3px solid transparent',
                  boxShadow: isActive ? `0 2px 8px rgba(0, 0, 0, 0.2)` : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <Group justify="space-between">
                  <Text
                    size="sm"
                    fw={isActive ? 600 : 400}
                    c={isActive ? colors.text : colors.textTertiary}
                  >
                    {item.label}
                  </Text>
                  {item.path === '/failures' && <FailureCount />}
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
