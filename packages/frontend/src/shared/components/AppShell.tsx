import { AppShell as MantineAppShell, NavLink, Group, Title, Text, Button } from '@mantine/core';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth-store';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/' },
  { label: 'Failures', path: '/failures' },
  { label: 'Health', path: '/health' },
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
      navbar={{ width: 220, breakpoint: 'sm' }}
      header={{ height: 56 }}
      padding="md"
    >
      <MantineAppShell.Header>
        <Group h="100%" px="md" justify="space-between">
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
          <Group gap="sm">
            {user && <Text size="xs" c="dimmed">{user.name}</Text>}
            <Button size="xs" variant="subtle" onClick={handleLogout}>
              Sign Out
            </Button>
          </Group>
        </Group>
      </MantineAppShell.Header>

      <MantineAppShell.Navbar p="xs">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            label={item.label}
            active={location.pathname === item.path}
            onClick={() => navigate(item.path)}
          />
        ))}
      </MantineAppShell.Navbar>

      <MantineAppShell.Main>
        <Outlet />
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}
