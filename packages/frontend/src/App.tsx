import { MantineProvider } from '@mantine/core';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { theme } from './theme/mantine-theme';
import { useAuthStore } from './store/auth-store';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { FailuresPage } from './features/failures/FailuresPage';
import { HealthPage } from './features/health/HealthPage';
import { TeamsPage } from './features/teams/TeamsPage';
import { AppShellLayout } from './shared/components/AppShell';
import '@mantine/core/styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 15_000,
      refetchOnWindowFocus: true,
    },
  },
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <AuthGuard>
                  <AppShellLayout />
                </AuthGuard>
              }
            >
              <Route path="/" element={<DashboardPage />} />
              <Route path="/failures" element={<FailuresPage />} />
              <Route path="/health" element={<HealthPage />} />
              <Route path="/teams" element={<TeamsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </MantineProvider>
  );
}
