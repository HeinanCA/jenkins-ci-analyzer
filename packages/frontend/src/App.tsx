import { MantineProvider } from "@mantine/core";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { theme } from "./theme/mantine-theme";
import { useAuthStore } from "./store/auth-store";
import { LoginPage } from "./features/auth/LoginPage";
import { InvitePage } from "./features/auth/InvitePage";
import { FailuresPage } from "./features/failures/FailuresPage";
import { HealthPage } from "./features/health/HealthPage";
import { TeamsPage } from "./features/teams/TeamsPage";
import { TrendsPage } from "./features/trends/TrendsPage";
import { UsersPage } from "./features/admin/UsersPage";
import { AppShellLayout } from "./shared/components/AppShell";
import "@mantine/core/styles.css";
import "./shared/styles/overrides.css";

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
            <Route path="/invite" element={<InvitePage />} />
            <Route
              element={
                <AuthGuard>
                  <AppShellLayout />
                </AuthGuard>
              }
            >
              <Route path="/" element={<FailuresPage />} />
              <Route path="/failures" element={<FailuresPage />} />
              <Route path="/health" element={<HealthPage />} />
              <Route path="/trends" element={<TrendsPage />} />
              <Route path="/teams" element={<TeamsPage />} />
              <Route path="/admin/users" element={<UsersPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </MantineProvider>
  );
}
