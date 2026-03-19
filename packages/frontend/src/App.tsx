import { MantineProvider } from "@mantine/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { theme } from "./theme/mantine-theme";
import { queryClient } from "./config/query-client";
import { AppShellLayout } from "./shared/components/AppShell";
import { ConnectionGuard } from "./shared/components/ConnectionGuard";
import { DashboardPage } from "./features/dashboard/pages/DashboardPage";
import { PipelineListPage } from "./features/pipelines/pages/PipelineListPage";
import { BuildAnalysisPage } from "./features/build-analysis/pages/BuildAnalysisPage";
import { HealthStatusPage } from "./features/health/pages/HealthStatusPage";
import { SettingsPage } from "./features/settings/pages/SettingsPage";
import "@mantine/core/styles.css";

export default function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShellLayout />}>
              <Route path="/settings" element={<SettingsPage />} />
              <Route
                path="/"
                element={
                  <ConnectionGuard>
                    <DashboardPage />
                  </ConnectionGuard>
                }
              />
              <Route
                path="/pipelines"
                element={
                  <ConnectionGuard>
                    <PipelineListPage />
                  </ConnectionGuard>
                }
              />
              <Route
                path="/build/:jobPath/:build"
                element={
                  <ConnectionGuard>
                    <BuildAnalysisPage />
                  </ConnectionGuard>
                }
              />
              <Route
                path="/health"
                element={
                  <ConnectionGuard>
                    <HealthStatusPage />
                  </ConnectionGuard>
                }
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </MantineProvider>
  );
}
