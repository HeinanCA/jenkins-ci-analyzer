import { AppShell as MantineAppShell, NavLink, Group, Title } from '@mantine/core';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/' },
  { label: 'Pipelines', path: '/pipelines' },
  { label: 'Health', path: '/health' },
  { label: 'Settings', path: '/settings' },
] as const;

export function AppShellLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <MantineAppShell
      navbar={{ width: 220, breakpoint: 'sm' }}
      header={{ height: 56 }}
      padding="md"
    >
      <MantineAppShell.Header>
        <Group h="100%" px="md">
          <Title order={3}>Jenkins Analyzer</Title>
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
