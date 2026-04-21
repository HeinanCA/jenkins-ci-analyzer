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
  create: (
    orgName: string,
    email: string,
    displayName: string,
    password: string,
  ) =>
    request<{
      organization: { id: string; name: string };
    }>("/v1/setup", {
      method: "POST",
      body: JSON.stringify({ orgName, email, displayName, password }),
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
  create: (
    name: string,
    baseUrl: string,
    username: string,
    token: string,
    organizationId: string,
  ) =>
    request<{ id: string; name: string; baseUrl: string }>("/v1/instances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, baseUrl, username, token, organizationId }),
    }),
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
      helpfulCount: number;
      notHelpfulCount: number;
      helpfulPercent: number;
    }>("/v1/dashboard/ai-cost"),
};

// Feedback
export const tigFeedback = {
  submit: (
    analysisId: string,
    rating: "helpful" | "not_helpful",
    note?: string,
  ) =>
    request<{ id: string; rating: string }>(
      "/v1/analyses/" + analysisId + "/feedback",
      { method: "POST", body: JSON.stringify({ rating, note }) },
    ),
  get: (analysisId: string) =>
    request<{ id: string; rating: string; note: string | null } | null>(
      "/v1/analyses/" + analysisId + "/feedback",
    ),
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
  runningBuilds: (instanceId: string) =>
    request<
      {
        jobName: string;
        jobUrl: string;
        buildNumber: number;
        startedAt: string;
        durationMs: number;
        estimatedMs: number;
        progress: number;
      }[]
    >(`/v1/instances/${instanceId}/running-builds`),
  recentBuilds: () =>
    request<
      {
        id: string;
        jobName: string;
        jobFullPath: string;
        buildNumber: number;
        result: string;
        startedAt: string;
        durationMs: number;
        triggeredBy: string | null;
      }[]
    >("/v1/dashboard/recent-builds"),
  failures: (
    instanceId?: string,
    limit = 50,
    teamId?: string,
    author?: string,
    scope?: "mine" | "all",
  ) => {
    const params = new URLSearchParams();
    if (instanceId) params.set("instance_id", instanceId);
    if (teamId) params.set("team_id", teamId);
    if (author) params.set("author", author);
    if (scope) params.set("scope", scope);
    params.set("limit", String(limit));
    return request<import("../features/failures/types").FailuresResponse>(
      `/v1/dashboard/failures?${params}`,
    );
  },
  dismissFailures: (
    buildIds: readonly string[],
  ): Promise<{ dismissed: number }> =>
    request<{ dismissed: number }>("/v1/failures/views", {
      method: "POST",
      body: JSON.stringify({ buildIds }),
    }),
  authors: (instanceId?: string) => {
    const params = new URLSearchParams();
    if (instanceId) params.set("instance_id", instanceId);
    return request<string[]>(`/v1/dashboard/authors?${params}`);
  },
};

// Trends
export const tigTrends = {
  failureRate: (days = 7, instanceId?: string, teamId?: string) => {
    const params = new URLSearchParams({ days: String(days) });
    if (instanceId) params.set("instance_id", instanceId);
    if (teamId) params.set("team_id", teamId);
    return request<
      { date: string; total: number; failed: number; rate: number }[]
    >(`/v1/trends/failure-rate?${params}`);
  },
  mttr: (days = 30, instanceId?: string, teamId?: string) => {
    const params = new URLSearchParams({ days: String(days) });
    if (instanceId) params.set("instance_id", instanceId);
    if (teamId) params.set("team_id", teamId);
    return request<{ date: string; avgRecoveryHours: number }[]>(
      `/v1/trends/mttr?${params}`,
    );
  },
  buildFrequency: (days = 7, instanceId?: string, teamId?: string) => {
    const params = new URLSearchParams({ days: String(days) });
    if (instanceId) params.set("instance_id", instanceId);
    if (teamId) params.set("team_id", teamId);
    return request<
      { date: string; total: number; success: number; failure: number }[]
    >(`/v1/trends/build-frequency?${params}`);
  },
  classification: (days = 7, instanceId?: string, teamId?: string) => {
    const params = new URLSearchParams({ days: String(days) });
    if (instanceId) params.set("instance_id", instanceId);
    if (teamId) params.set("team_id", teamId);
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
  executors: (instanceId: string) =>
    request<
      {
        agent: string;
        idle: boolean;
        offline: boolean;
        jobName: string | null;
        jobUrl: string | null;
        buildNumber: number | null;
        startedAt: string | null;
        durationMs: number | null;
        stuck: boolean;
        triggeredBy: string | null;
      }[]
    >(`/v1/instances/${instanceId}/executors`),
  queue: (instanceId: string) =>
    request<{
      items: {
        id: number;
        jobName: string;
        jobUrl: string;
        reason: string;
        waitingMs: number;
        stuck: boolean;
        blocked: boolean;
      }[];
      scanCount: number;
      scanReasons: string[];
    }>(`/v1/instances/${instanceId}/queue`),
};

// Current user
export const tigMe = {
  get: () =>
    request<{
      id: string;
      email: string;
      displayName: string;
      role: string;
    }>("/v1/me"),
};

// Admin
export const tigAdmin = {
  listUsers: () =>
    request<
      {
        id: string;
        email: string;
        displayName: string;
        role: string;
        createdAt: string;
      }[]
    >("/v1/admin/users"),
  updateRole: (userId: string, role: string) =>
    request("/v1/admin/users/" + userId, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),
  removeUser: (userId: string) =>
    request("/v1/admin/users/" + userId, { method: "DELETE" }),
};

// Invitations
export const tigInvitations = {
  list: () =>
    request<
      {
        id: string;
        email: string;
        role: string;
        token: string;
        expiresAt: string;
        createdAt: string;
      }[]
    >("/v1/admin/invitations"),
  create: (email: string, role?: string) =>
    request<{
      id: string;
      email: string;
      token: string;
      expiresAt: string;
      inviteUrl: string;
    }>("/v1/admin/invitations", {
      method: "POST",
      body: JSON.stringify({ email, role }),
    }),
  revoke: (id: string) =>
    request("/v1/admin/invitations/" + id, { method: "DELETE" }),
  accept: (token: string, name: string, password: string) =>
    fetch(`${API_BASE.replace("/api", "")}/api/v1/invite/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name, password }),
    }).then((r) => r.json()),
};

export { TigApiError };
