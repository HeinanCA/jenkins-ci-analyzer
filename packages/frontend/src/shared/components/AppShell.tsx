import {
  AppShell as MantineAppShell,
  NavLink,
  Group,
  Title,
  Text,
  Button,
  Box,
  Stack,
} from '@mantine/core';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth-store';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/', icon: '◉' },
  { label: 'Failures', path: '/failures', icon: '✕' },
  { label: 'Health', path: '/health', icon: '♡' },
] as const;

export function AppShellLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <MantineAppShell
      navbar={{ width: 240, breakpoint: 'sm' }}
      header={{ height: 60 }}
      padding="lg"
      styles={{
        main: {
          background: 'linear-gradient(180deg, #0a0a0f 0%, #111827 100%)',
          minHeight: '100vh',
        },
        header: {
          backgroundColor: 'rgba(10, 10, 15, 0.95)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          backdropFilter: 'blur(12px)',
        },
        navbar: {
          backgroundColor: 'rgba(10, 10, 15, 0.95)',
          borderRight: '1px solid rgba(255, 255, 255, 0.06)',
        },
      }}
    >
      <MantineAppShell.Header>
        <Group h="100%" px="lg" justify="space-between">
          <Group gap="sm">
            <Title
              order={3}
              style={{
                background: 'linear-gradient(135deg, #e2e8f0, #60a5fa, #a78bfa)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              PulsCI
            </Title>
            <Text size="xs" c="dimmed" mt={4}>
              by That Infrastructure Guy
            </Text>
          </Group>
          <Group gap="sm">
            {user && (
              <Text size="xs" c="dimmed">
                {user.name}
              </Text>
            )}
            <Button
              size="xs"
              variant="subtle"
              color="gray"
              onClick={handleLogout}
            >
              Sign Out
            </Button>
          </Group>
        </Group>
      </MantineAppShell.Header>

      <MantineAppShell.Navbar p="sm">
        <Stack gap={4} mt="sm">
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
                  backgroundColor: isActive
                    ? 'rgba(96, 165, 250, 0.1)'
                    : 'transparent',
                  borderLeft: isActive
                    ? '3px solid #60a5fa'
                    : '3px solid transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                <Group gap="sm">
                  <Text
                    size="sm"
                    style={{
                      opacity: isActive ? 1 : 0.5,
                    }}
                  >
                    {item.icon}
                  </Text>
                  <Text
                    size="sm"
                    fw={isActive ? 600 : 400}
                    style={{
                      color: isActive ? '#e2e8f0' : '#94a3b8',
                    }}
                  >
                    {item.label}
                  </Text>
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
