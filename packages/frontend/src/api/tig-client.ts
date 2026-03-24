const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

interface TigResponse<T> {
  readonly data: T;
  readonly error: string | null;
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
    headers: { "Content-Type": "application/json", ...options?.headers },
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
  jobs: (instanceId: string, limit = 2000) =>
    request<
      {
        id: string;
        fullPath: string;
        name: string;
        color: string | null;
        healthScore: number | null;
      }[]
    >(`/v1/instances/${instanceId}/jobs?limit=${limit}`),
};

// Teams
export const tigTeams = {
  list: () =>
    request<
      {
        id: string;
        name: string;
        ciInstanceId: string;
        folderPatterns: string[];
        createdAt: string;
      }[]
    >("/v1/teams"),
  create: (data: {
    name: string;
    ciInstanceId: string;
    organizationId: string;
    folderPatterns: string[];
  }) => request("/v1/teams", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; folderPatterns?: string[] }) =>
    request(`/v1/teams/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) => request(`/v1/teams/${id}`, { method: "DELETE" }),
  jobs: (id: string) =>
    request<
      { id: string; fullPath: string; name: string; color: string | null }[]
    >(`/v1/teams/${id}/jobs`),
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

// AI Health (live connectivity check)
export const tigAiHealth = {
  get: () =>
    request<{
      status: "healthy" | "unhealthy" | "unknown";
      message: string | null;
      lastCheckedAt: string | null;
      responseTimeMs: number | null;
    }>("/v1/ai/health"),
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
  failures: (instanceId?: string, limit = 50, teamId?: string) => {
    const params = new URLSearchParams();
    if (instanceId) params.set("instance_id", instanceId);
    if (teamId) params.set("team_id", teamId);
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

// Trends
export const tigTrends = {
  failureRate: (days = 7, instanceId?: string) => {
    const params = new URLSearchParams({ days: String(days) });
    if (instanceId) params.set("instance_id", instanceId);
    return request<
      { date: string; total: number; failed: number; rate: number }[]
    >(`/v1/trends/failure-rate?${params}`);
  },
  mttr: (days = 30, instanceId?: string) => {
    const params = new URLSearchParams({ days: String(days) });
    if (instanceId) params.set("instance_id", instanceId);
    return request<{ date: string; avgRecoveryHours: number }[]>(
      `/v1/trends/mttr?${params}`,
    );
  },
  buildFrequency: (days = 7, instanceId?: string) => {
    const params = new URLSearchParams({ days: String(days) });
    if (instanceId) params.set("instance_id", instanceId);
    return request<
      { date: string; total: number; success: number; failure: number }[]
    >(`/v1/trends/build-frequency?${params}`);
  },
  classification: (days = 7, instanceId?: string) => {
    const params = new URLSearchParams({ days: String(days) });
    if (instanceId) params.set("instance_id", instanceId);
    return request<
      { date: string; code: number; infra: number; unknown: number }[]
    >(`/v1/trends/classification?${params}`);
  },
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
