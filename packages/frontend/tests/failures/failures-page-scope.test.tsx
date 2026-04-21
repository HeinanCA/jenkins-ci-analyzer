// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MantineProvider } from "@mantine/core";
import type { ReactNode } from "react";
import { FailuresPage } from "../../src/features/failures/FailuresPage";
import type { FailuresResponse } from "../../src/features/failures/types";

// ─── Mock dependencies ────────────────────────────────────────
vi.mock("../../src/api/tig-client", () => ({
  tigDashboard: {
    summary: vi
      .fn()
      .mockResolvedValue({ total: 5, passing: 4, failing: 1, building: 0 }),
    failures: vi.fn(),
    authors: vi.fn().mockResolvedValue([]),
    dismissFailures: vi.fn().mockResolvedValue({ dismissed: 0 }),
  },
  tigTeams: {
    list: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../src/store/auth-store", () => ({
  useAuthStore: vi.fn((selector: (s: { instanceId: string }) => unknown) =>
    selector({ instanceId: "inst-1" }),
  ),
}));

// ─── Wrapper ──────────────────────────────────────────────────
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MantineProvider>{children}</MantineProvider>
      </QueryClientProvider>
    );
  };
}

// ─── localStorage mock ────────────────────────────────────────
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = v;
  },
  removeItem: (k: string) => {
    delete store[k];
  },
  clear: () => {
    for (const k in store) delete store[k];
  },
};

// ─── Default response ─────────────────────────────────────────
const DEFAULT_FAILURES_RESPONSE: FailuresResponse = {
  data: [],
  scope: "mine",
  mineUnavailable: false,
  error: null,
};

beforeEach(async () => {
  localStorageMock.clear();
  vi.stubGlobal("localStorage", localStorageMock);

  // Re-apply default mock implementations after each clear
  const { tigDashboard } = await import("../../src/api/tig-client");
  vi.mocked(tigDashboard.failures).mockResolvedValue(DEFAULT_FAILURES_RESPONSE);
  vi.mocked(tigDashboard.summary).mockResolvedValue({
    total: 5,
    passing: 4,
    failing: 1,
    building: 0,
  });
  vi.mocked(tigDashboard.authors).mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("FailuresPage — mineUnavailable", () => {
  it("hides the scope toggle when mineUnavailable=true", async () => {
    const { tigDashboard } = await import("../../src/api/tig-client");
    vi.mocked(tigDashboard.failures).mockResolvedValue({
      data: [],
      scope: "mine",
      mineUnavailable: true,
      error: null,
    });

    render(<FailuresPage />, { wrapper: createWrapper() });

    await screen.findByText(/Connect your Jenkins account/i);

    // Mine/Everyone radios must NOT be present
    expect(screen.queryByRole("radio", { name: "Mine" })).toBeNull();
    expect(screen.queryByRole("radio", { name: "Everyone" })).toBeNull();
  });

  it("shows the admin notice when mineUnavailable=true", async () => {
    const { tigDashboard } = await import("../../src/api/tig-client");
    vi.mocked(tigDashboard.failures).mockResolvedValue({
      data: [],
      scope: "mine",
      mineUnavailable: true,
      error: null,
    });

    render(<FailuresPage />, { wrapper: createWrapper() });

    await screen.findByText(/Connect your Jenkins account/i);
  });

  it("shows the scope toggle when mineUnavailable=false", async () => {
    render(<FailuresPage />, { wrapper: createWrapper() });

    // Wait for data to load — the positive empty state appears when scope=mine and no failures
    await screen.findByText(/No failures in the last 3 days — nice work/i);

    // Mine and Everyone radio inputs must be present
    expect(screen.getByRole("radio", { name: "Mine" })).toBeDefined();
    expect(screen.getByRole("radio", { name: "Everyone" })).toBeDefined();
  });
});

describe("FailuresPage — section rendering", () => {
  it("renders the fixed section when fixed items are present", async () => {
    const { tigDashboard } = await import("../../src/api/tig-client");
    vi.mocked(tigDashboard.failures).mockResolvedValue({
      data: [
        {
          status: "fixed",
          jobName: "my-fixed-job",
          jobFullPath: "org/team/my-fixed-job",
          jobUrl: "https://jenkins.example.com/job/my-fixed-job/",
          streak: 3,
          latestBuild: {
            buildId: "b-1",
            buildNumber: 10,
            result: "SUCCESS",
            startedAt: new Date().toISOString(),
            durationMs: 60000,
            jobName: "my-fixed-job",
            jobFullPath: "org/team/my-fixed-job",
            jobUrl: "https://jenkins.example.com/job/my-fixed-job/",
            gitSha: null,
            gitRemoteUrl: null,
            analysisId: null,
            classification: null,
            confidence: null,
            matches: [],
            aiSummary: null,
            aiRootCause: null,
            aiSuggestedFixes: null,
            logNoisePercent: null,
            logTopNoise: null,
            triggeredBy: null,
          },
          failureBuilds: [],
          recoveryBuildId: "b-1",
        },
      ],
      scope: "mine",
      mineUnavailable: false,
      error: null,
    } satisfies FailuresResponse);

    render(<FailuresPage />, { wrapper: createWrapper() });

    await screen.findByText(/Recently fixed/i);
    expect(screen.getByText(/my-fixed-job/i)).toBeDefined();
  });

  it("renders the building section when in_progress items are present", async () => {
    const { tigDashboard } = await import("../../src/api/tig-client");
    vi.mocked(tigDashboard.failures).mockResolvedValue({
      data: [
        {
          status: "in_progress",
          jobName: "my-building-job",
          jobFullPath: "org/team/my-building-job",
          jobUrl: "https://jenkins.example.com/job/my-building-job/",
          streak: 1,
          latestBuild: {
            buildId: "b-2",
            buildNumber: 42,
            result: "BUILDING",
            startedAt: new Date().toISOString(),
            durationMs: 0,
            jobName: "my-building-job",
            jobFullPath: "org/team/my-building-job",
            jobUrl: "https://jenkins.example.com/job/my-building-job/",
            gitSha: null,
            gitRemoteUrl: null,
            analysisId: null,
            classification: null,
            confidence: null,
            matches: [],
            aiSummary: null,
            aiRootCause: null,
            aiSuggestedFixes: null,
            logNoisePercent: null,
            logTopNoise: null,
            triggeredBy: null,
          },
          failureBuilds: [],
        },
      ],
      scope: "mine",
      mineUnavailable: false,
      error: null,
    } satisfies FailuresResponse);

    render(<FailuresPage />, { wrapper: createWrapper() });

    await screen.findByText(/Build #42 running/i);
  });

  it("shows the positive empty state for mine scope with no failures", async () => {
    render(<FailuresPage />, { wrapper: createWrapper() });

    await screen.findByText(/No failures in the last 3 days — nice work/i);
  });
});
