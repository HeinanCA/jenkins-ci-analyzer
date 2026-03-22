const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

interface TigResponse<T> {
  readonly data: T;
  readonly error: string | null;
  readonly meta?: { limit: number; offset: number; count: number };
}

class TigApiError extends Error {
  readonly statusCode: number;
  readonly nedry: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "TigApiError";
    this.statusCode = statusCode;
    this.nedry = statusCode === 401;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (response.status === 401) {
    const body = await response.json().catch(() => ({}));
    throw new TigApiError(body.error ?? "Authentication required", 401);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new TigApiError(
      body.error ?? `Request failed: ${response.status}`,
      response.status,
    );
  }

  if (response.headers.get("content-type")?.includes("text/plain")) {
    return response.text() as unknown as T;
  }

  const json = (await response.json()) as TigResponse<T>;
  return json.data;
}

// Auth
export const tigAuth = {
  signUp: (email: string, password: string, name: string) =>
    fetch(`${API_BASE.replace("/api", "")}/api/auth/sign-up/email`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    }).then((r) => r.json()),

  signIn: (email: string, password: string) =>
    fetch(`${API_BASE.replace("/api", "")}/api/auth/sign-in/email`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).then((r) => r.json()),

  getSession: () =>
    fetch(`${API_BASE.replace("/api", "")}/api/auth/get-session`, {
      credentials: "include",
    }).then((r) => (r.ok ? r.json() : null)),
};

// Setup
export const tigSetup = {
  getStatus: () =>
    request<{
      isSetUp: boolean;
      organization: { id: string; name: string } | null;
    }>("/v1/setup/status"),
  create: (
    orgName: string,
    email: string,
    password: string,
    displayName: string,
  ) =>
    request("/v1/setup", {
      method: "POST",
      body: JSON.stringify({ orgName, email, password, displayName }),
    }),
};

// Instances
export const tigInstances = {
  list: () =>
    request<
      {
        id: string;
        name: string;
        baseUrl: string;
        isActive: boolean;
        lastCrawlAt: string | null;
      }[]
    >("/v1/instances"),
  create: (data: {
    name: string;
    baseUrl: string;
    username: string;
    token: string;
    organizationId: string;
  }) =>
    request("/v1/instances", { method: "POST", body: JSON.stringify(data) }),
  test: (id: string) =>
    request<{ success: boolean; message: string }>(`/v1/instances/${id}/test`, {
      method: "POST",
    }),
};

// AI Cost
export const tigAiCost = {
  get: () =>
    request<{
      totalCostUsd: number;
      totalInputTokens: number;
      totalOutputTokens: number;
      analyzedCount: number;
      aiAnalyzedCount: number;
      avgCostPerAnalysis: number;
    }>("/v1/dashboard/ai-cost"),
};

// Dashboard
export const tigDashboard = {
  summary: (instanceId?: string) => {
    const qs = instanceId ? `?instance_id=${instanceId}` : "";
    return request<{
      total: number;
      passing: number;
      failing: number;
      building: number;
    }>(`/v1/dashboard/summary${qs}`);
  },
  failures: (instanceId?: string, limit = 20) => {
    const params = new URLSearchParams();
    if (instanceId) params.set("instance_id", instanceId);
    params.set("limit", String(limit));
    return request<
      {
        buildId: string;
        buildNumber: number;
        result: string;
        startedAt: string;
        durationMs: number;
        jobName: string;
        jobFullPath: string;
        classification: string | null;
        confidence: number | null;
        matches: unknown;
      }[]
    >(`/v1/dashboard/failures?${params}`);
  },
};

// Jobs
export const tigJobs = {
  list: (
    instanceId: string,
    options?: { status?: string; limit?: number; offset?: number },
  ) => {
    const params = new URLSearchParams();
    if (options?.status) params.set("status", options.status);
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.offset) params.set("offset", String(options.offset));
    return request<
      {
        id: string;
        fullPath: string;
        name: string;
        color: string | null;
        healthScore: number | null;
      }[]
    >(`/v1/instances/${instanceId}/jobs?${params}`);
  },
  builds: (jobId: string, limit = 25) =>
    request<
      {
        id: string;
        buildNumber: number;
        result: string | null;
        startedAt: string;
        durationMs: number | null;
      }[]
    >(`/v1/jobs/${jobId}/builds?limit=${limit}`),
};

// Builds
export const tigBuilds = {
  get: (buildId: string) =>
    request<{
      id: string;
      buildNumber: number;
      result: string | null;
      startedAt: string;
      durationMs: number | null;
      analysis: {
        classification: string | null;
        confidence: number | null;
        matches: unknown;
        aiSummary: string | null;
        aiRootCause: string | null;
        aiSuggestedFixes: unknown;
        aiSkippedReason: string | null;
      } | null;
    }>(`/v1/builds/${buildId}`),
  log: (buildId: string) => request<string>(`/v1/builds/${buildId}/log`),
};

// Health
export const tigHealth = {
  current: (instanceId: string) =>
    request<{
      level: string;
      score: number;
      agentsOnline: number;
      agentsTotal: number;
      executorsBusy: number;
      executorsTotal: number;
      queueDepth: number;
      stuckBuilds: number;
      issues: string[];
    }>(`/v1/instances/${instanceId}/health`),
  history: (instanceId: string, period = "24h") =>
    request<
      {
        level: string;
        score: number;
        agentsOnline: number;
        agentsTotal: number;
        queueDepth: number;
        recordedAt: string;
      }[]
    >(`/v1/instances/${instanceId}/health/history?period=${period}`),
};

export { TigApiError };
