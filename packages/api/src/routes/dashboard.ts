import type { FastifyInstance } from "fastify";
import { eq, and, desc, sql, sum, count, gte } from "drizzle-orm";
import { db } from "../db/connection";
import {
  jobs,
  builds,
  buildAnalyses,
  healthSnapshots,
  ciInstances,
  teams,
} from "../db/schema";
import { jobMatchesTeam } from "./teams";
import { requireAuth } from "../middleware/auth";
import { jenkinsGet } from "../services/jenkins-client";
import {
  decryptCredentials,
  type EncryptedCredentials,
} from "../services/credential-vault";

interface JenkinsJobsWithBuildsResponse {
  readonly jobs: readonly {
    readonly name: string;
    readonly url: string;
    readonly builds: readonly {
      readonly number: number;
      readonly result: string | null;
      readonly timestamp: number;
      readonly building: boolean;
      readonly duration: number;
      readonly estimatedDuration: number;
    }[];
  }[];
}

interface RunningBuild {
  readonly jobName: string;
  readonly jobUrl: string;
  readonly buildNumber: number;
  readonly startedAt: string;
  readonly durationMs: number;
  readonly estimatedMs: number;
  readonly progress: number;
}

interface JenkinsQueueDetailResponse {
  readonly items: readonly {
    readonly id: number;
    readonly task: { readonly name: string; readonly url: string };
    readonly why: string | null;
    readonly inQueueSince: number;
    readonly stuck: boolean;
    readonly blocked: boolean;
    readonly buildable: boolean;
  }[];
}

interface QueueItem {
  readonly id: number;
  readonly jobName: string;
  readonly jobUrl: string;
  readonly reason: string;
  readonly waitingMs: number;
  readonly stuck: boolean;
  readonly blocked: boolean;
}

interface JenkinsComputerResponse {
  readonly computer: readonly {
    readonly displayName: string;
    readonly idle: boolean;
    readonly offline: boolean;
    readonly numExecutors: number;
    readonly executors: readonly {
      readonly idle: boolean;
      readonly currentExecutable: {
        readonly url: string;
        readonly fullDisplayName: string;
        readonly timestamp: number;
        readonly number: number;
      } | null;
    }[];
  }[];
}

interface ExecutorInfo {
  readonly agent: string;
  readonly idle: boolean;
  readonly offline: boolean;
  readonly jobName: string | null;
  readonly jobUrl: string | null;
  readonly buildNumber: number | null;
  readonly startedAt: string | null;
  readonly durationMs: number | null;
  readonly stuck: boolean;
}

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // Summary stats for an instance
  app.get<{
    Querystring: { instance_id?: string };
  }>("/api/v1/dashboard/summary", async (request) => {
    const orgId = request.tigSession!.org.id;
    const instanceId = request.query.instance_id;

    const allJobs = await db
      .select({ color: jobs.color })
      .from(jobs)
      .where(
        and(
          eq(jobs.organizationId, orgId),
          eq(jobs.isActive, true),
          instanceId ? eq(jobs.ciInstanceId, instanceId) : undefined,
        ),
      );

    const total = allJobs.length;
    const passing = allJobs.filter(
      (j) => j.color?.startsWith("blue") || j.color?.startsWith("green"),
    ).length;
    const failing = allJobs.filter((j) => j.color?.startsWith("red")).length;
    const building = allJobs.filter((j) => j.color?.endsWith("_anime")).length;

    return {
      data: { total, passing, failing, building },
      error: null,
    };
  });

  // Recent failures with analysis
  app.get<{
    Querystring: {
      instance_id?: string;
      team_id?: string;
      author?: string;
      limit?: string;
      days?: string;
    };
  }>("/api/v1/dashboard/failures", async (request) => {
    const orgId = request.tigSession!.org.id;
    const instanceId = request.query.instance_id;
    const teamId = request.query.team_id;
    const author = request.query.author;
    const rawLimit = Number(request.query.limit ?? 50);
    const limit = Number.isFinite(rawLimit)
      ? Math.max(1, Math.min(rawLimit, 100))
      : 50;
    const rawDays = Number(request.query.days ?? 3);
    const days = Number.isFinite(rawDays)
      ? Math.max(1, Math.min(rawDays, 90))
      : 3;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Load team patterns if filtering by team (verify team belongs to org)
    let teamPatterns: string[] | null = null;
    if (teamId) {
      const [team] = await db
        .select({ folderPatterns: teams.folderPatterns })
        .from(teams)
        .where(and(eq(teams.id, teamId), eq(teams.organizationId, orgId)))
        .limit(1);
      if (team) {
        teamPatterns = team.folderPatterns;
      }
    }

    const failures = await db
      .select({
        buildId: builds.id,
        buildNumber: builds.buildNumber,
        result: builds.result,
        startedAt: builds.startedAt,
        durationMs: builds.durationMs,
        jobName: jobs.name,
        jobFullPath: jobs.fullPath,
        jobUrl: jobs.url,
        gitSha: builds.gitSha,
        gitRemoteUrl: builds.gitRemoteUrl,
        classification: buildAnalyses.classification,
        confidence: buildAnalyses.confidence,
        matches: buildAnalyses.matches,
        aiSummary: buildAnalyses.aiSummary,
        aiRootCause: buildAnalyses.aiRootCause,
        aiSuggestedFixes: buildAnalyses.aiSuggestedFixes,
        logNoisePercent: buildAnalyses.logNoisePercent,
        logTopNoise: buildAnalyses.logTopNoise,
        triggeredBy: builds.triggeredBy,
      })
      .from(builds)
      .innerJoin(jobs, eq(jobs.id, builds.jobId))
      .leftJoin(buildAnalyses, eq(buildAnalyses.buildId, builds.id))
      .where(
        and(
          eq(jobs.organizationId, orgId),
          instanceId ? eq(jobs.ciInstanceId, instanceId) : undefined,
          author ? eq(builds.triggeredBy, author) : undefined,
          sql`${builds.result} IN ('FAILURE', 'UNSTABLE')`,
          gte(builds.startedAt, since),
        ),
      )
      .orderBy(desc(builds.startedAt))
      .limit(limit);

    // Filter by team patterns if specified
    const filtered = teamPatterns
      ? failures.filter((f) => jobMatchesTeam(f.jobFullPath, teamPatterns))
      : failures;

    return { data: filtered, error: null };
  });

  // Distinct authors (triggered_by) for the org
  app.get<{
    Querystring: { instance_id?: string };
  }>("/api/v1/dashboard/authors", async (request) => {
    const orgId = request.tigSession!.org.id;
    const instanceId = request.query.instance_id;

    const rows = await db
      .selectDistinct({ triggeredBy: builds.triggeredBy })
      .from(builds)
      .innerJoin(jobs, eq(jobs.id, builds.jobId))
      .where(
        and(
          eq(builds.organizationId, orgId),
          sql`${builds.triggeredBy} IS NOT NULL`,
          instanceId ? eq(jobs.ciInstanceId, instanceId) : undefined,
        ),
      )
      .orderBy(builds.triggeredBy);

    const authors = rows.map((r) => r.triggeredBy!);
    return { data: authors, error: null };
  });

  // Health — current snapshot for an instance
  app.get<{
    Params: { instanceId: string };
  }>("/api/v1/instances/:instanceId/health", async (request, reply) => {
    const orgId = request.tigSession!.org.id;
    const { instanceId } = request.params;

    // Verify instance belongs to org
    const [instance] = await db
      .select({ id: ciInstances.id })
      .from(ciInstances)
      .where(
        and(
          eq(ciInstances.id, instanceId),
          eq(ciInstances.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!instance) {
      return reply.status(404).send({
        data: null,
        error: "Instance not found",
      });
    }

    const [snapshot] = await db
      .select()
      .from(healthSnapshots)
      .where(
        and(
          eq(healthSnapshots.ciInstanceId, instanceId),
          eq(healthSnapshots.organizationId, orgId),
        ),
      )
      .orderBy(desc(healthSnapshots.recordedAt))
      .limit(1);

    if (!snapshot) {
      return reply.status(404).send({
        data: null,
        error: "No health data available yet",
      });
    }

    return { data: snapshot, error: null };
  });

  // Health history
  app.get<{
    Params: { instanceId: string };
    Querystring: { period?: string };
  }>("/api/v1/instances/:instanceId/health/history", async (request, reply) => {
    const orgId = request.tigSession!.org.id;
    const { instanceId } = request.params;
    const period = request.query.period ?? "24h";

    // Verify instance belongs to org
    const [instance] = await db
      .select({ id: ciInstances.id })
      .from(ciInstances)
      .where(
        and(
          eq(ciInstances.id, instanceId),
          eq(ciInstances.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!instance) {
      return reply.status(404).send({
        data: null,
        error: "Instance not found",
      });
    }

    const hours = period === "7d" ? 168 : period === "1h" ? 1 : 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const snapshots = await db
      .select({
        level: healthSnapshots.level,
        score: healthSnapshots.score,
        agentsOnline: healthSnapshots.agentsOnline,
        agentsTotal: healthSnapshots.agentsTotal,
        queueDepth: healthSnapshots.queueDepth,
        stuckBuilds: healthSnapshots.stuckBuilds,
        recordedAt: healthSnapshots.recordedAt,
      })
      .from(healthSnapshots)
      .where(
        and(
          eq(healthSnapshots.ciInstanceId, instanceId),
          eq(healthSnapshots.organizationId, orgId),
          sql`${healthSnapshots.recordedAt} >= ${since}`,
        ),
      )
      .orderBy(healthSnapshots.recordedAt);

    return { data: snapshots, error: null };
  });

  // Live executor data from Jenkins
  app.get<{
    Params: { instanceId: string };
  }>("/api/v1/instances/:instanceId/executors", async (request, reply) => {
    const orgId = request.tigSession!.org.id;
    const { instanceId } = request.params;

    const [instance] = await db
      .select({
        id: ciInstances.id,
        baseUrl: ciInstances.baseUrl,
        credentials: ciInstances.credentials,
      })
      .from(ciInstances)
      .where(
        and(
          eq(ciInstances.id, instanceId),
          eq(ciInstances.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!instance) {
      return reply.status(404).send({
        data: null,
        error: "Instance not found",
      });
    }

    const credentials = decryptCredentials(
      instance.credentials as EncryptedCredentials,
    );

    const tree =
      "computer[displayName,idle,offline,numExecutors,executors[idle,currentExecutable[url,fullDisplayName,timestamp,number]]]";
    const url = `${instance.baseUrl.replace(/\/$/, "")}/computer/api/json?tree=${tree}`;

    let jenkinsData: JenkinsComputerResponse;
    try {
      jenkinsData = await jenkinsGet<JenkinsComputerResponse>(url, credentials);
    } catch {
      return reply.status(502).send({
        data: null,
        error: "Failed to fetch executor data",
      });
    }

    const now = Date.now();
    const STUCK_THRESHOLD_MS = 4 * 60 * 60 * 1000;

    const executors: ExecutorInfo[] = jenkinsData.computer.flatMap((computer) =>
      computer.executors.map((executor): ExecutorInfo => {
        const exec = executor.currentExecutable;
        const timestamp = exec?.timestamp ?? null;
        const durationMs = timestamp !== null ? now - timestamp : null;

        return {
          agent: computer.displayName,
          idle: executor.idle,
          offline: computer.offline,
          jobName: exec?.fullDisplayName ?? null,
          jobUrl: exec?.url ?? null,
          buildNumber: exec?.number ?? null,
          startedAt:
            timestamp !== null ? new Date(timestamp).toISOString() : null,
          durationMs,
          stuck: durationMs !== null && durationMs > STUCK_THRESHOLD_MS,
        };
      }),
    );

    return { data: executors, error: null };
  });

  // Live queue detail from Jenkins
  app.get<{
    Params: { instanceId: string };
  }>("/api/v1/instances/:instanceId/queue", async (request, reply) => {
    const orgId = request.tigSession!.org.id;
    const { instanceId } = request.params;

    const [instance] = await db
      .select({
        id: ciInstances.id,
        baseUrl: ciInstances.baseUrl,
        credentials: ciInstances.credentials,
      })
      .from(ciInstances)
      .where(
        and(
          eq(ciInstances.id, instanceId),
          eq(ciInstances.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!instance) {
      return reply.status(404).send({
        data: null,
        error: "Instance not found",
      });
    }

    const credentials = decryptCredentials(
      instance.credentials as EncryptedCredentials,
    );

    const tree =
      "items[id,task[name,url],why,inQueueSince,stuck,blocked,buildable]";
    const url = `${instance.baseUrl.replace(/\/$/, "")}/queue/api/json?tree=${tree}`;

    let jenkinsData: JenkinsQueueDetailResponse;
    try {
      jenkinsData = await jenkinsGet<JenkinsQueueDetailResponse>(
        url,
        credentials,
      );
    } catch {
      return reply.status(502).send({
        data: null,
        error: "Failed to fetch queue data from Jenkins",
      });
    }

    const now = Date.now();
    const queueItems: QueueItem[] = jenkinsData.items.map((item) => ({
      id: item.id,
      jobName: item.task.name,
      jobUrl: item.task.url,
      reason: item.why ?? "Unknown",
      waitingMs: now - item.inQueueSince,
      stuck: item.stuck,
      blocked: item.blocked,
    }));

    return { data: queueItems, error: null };
  });

  // Running builds — live from Jenkins
  app.get<{
    Params: { instanceId: string };
  }>("/api/v1/instances/:instanceId/running-builds", async (request, reply) => {
    const orgId = request.tigSession!.org.id;
    const { instanceId } = request.params;

    const [instance] = await db
      .select({
        id: ciInstances.id,
        baseUrl: ciInstances.baseUrl,
        credentials: ciInstances.credentials,
      })
      .from(ciInstances)
      .where(
        and(
          eq(ciInstances.id, instanceId),
          eq(ciInstances.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!instance) {
      return reply.status(404).send({
        data: null,
        error: "Instance not found",
      });
    }

    const credentials = decryptCredentials(
      instance.credentials as EncryptedCredentials,
    );

    const tree =
      "jobs[name,url,builds[number,result,timestamp,building,duration,estimatedDuration]{0,5}]";
    const url = `${instance.baseUrl.replace(/\/$/, "")}/api/json?tree=${tree}`;

    let jenkinsData: JenkinsJobsWithBuildsResponse;
    try {
      jenkinsData = await jenkinsGet<JenkinsJobsWithBuildsResponse>(
        url,
        credentials,
      );
    } catch {
      return reply.status(502).send({
        data: null,
        error: "Failed to fetch build data from Jenkins",
      });
    }

    const now = Date.now();
    const runningBuilds: RunningBuild[] = (jenkinsData.jobs ?? []).flatMap(
      (job) =>
        (job.builds ?? [])
          .filter((b) => b.building === true)
          .map((b): RunningBuild => {
            const durationMs = now - b.timestamp;
            const estimatedMs =
              b.estimatedDuration > 0 ? b.estimatedDuration : 1;
            const progress = Math.min(
              100,
              Math.round((durationMs / estimatedMs) * 100),
            );
            return {
              jobName: job.name,
              jobUrl: job.url,
              buildNumber: b.number,
              startedAt: new Date(b.timestamp).toISOString(),
              durationMs,
              estimatedMs,
              progress,
            };
          }),
    );

    return { data: runningBuilds, error: null };
  });

  // Recent completed builds from DB
  app.get("/api/v1/dashboard/recent-builds", async (request) => {
    const orgId = request.tigSession!.org.id;

    const recentBuilds = await db
      .select({
        id: builds.id,
        jobName: jobs.name,
        jobFullPath: jobs.fullPath,
        buildNumber: builds.buildNumber,
        result: builds.result,
        startedAt: builds.startedAt,
        durationMs: builds.durationMs,
        triggeredBy: builds.triggeredBy,
      })
      .from(builds)
      .innerJoin(jobs, eq(jobs.id, builds.jobId))
      .where(
        and(
          eq(builds.organizationId, orgId),
          sql`${builds.result} IS NOT NULL`,
        ),
      )
      .orderBy(desc(builds.startedAt))
      .limit(20);

    return { data: recentBuilds, error: null };
  });

  // AI cost tracking + status
  app.get("/api/v1/dashboard/ai-cost", async (request) => {
    const orgId = request.tigSession!.org.id;

    const [result] = await db
      .select({
        totalCost: sum(buildAnalyses.aiCostUsd),
        totalInputTokens: sum(buildAnalyses.aiInputTokens),
        totalOutputTokens: sum(buildAnalyses.aiOutputTokens),
        analyzedCount: count(buildAnalyses.id),
        aiCount: count(buildAnalyses.aiSummary),
      })
      .from(buildAnalyses)
      .where(eq(buildAnalyses.organizationId, orgId));

    // Check if AI is working: is the MOST RECENT analysis missing AI?
    const [latestAnalysis] = await db
      .select({
        aiSummary: buildAnalyses.aiSummary,
        analyzedAt: buildAnalyses.analyzedAt,
      })
      .from(buildAnalyses)
      .where(eq(buildAnalyses.organizationId, orgId))
      .orderBy(desc(buildAnalyses.analyzedAt))
      .limit(1);

    const aiDown = latestAnalysis ? latestAnalysis.aiSummary === null : false;

    return {
      data: {
        totalCostUsd: Number(result.totalCost ?? 0),
        totalInputTokens: Number(result.totalInputTokens ?? 0),
        totalOutputTokens: Number(result.totalOutputTokens ?? 0),
        analyzedCount: Number(result.analyzedCount ?? 0),
        aiAnalyzedCount: Number(result.aiCount ?? 0),
        avgCostPerAnalysis: result.aiCount
          ? Number(result.totalCost ?? 0) / Number(result.aiCount)
          : 0,
        aiStatus: aiDown ? "degraded" : "healthy",
      },
      error: null,
    };
  });
}
