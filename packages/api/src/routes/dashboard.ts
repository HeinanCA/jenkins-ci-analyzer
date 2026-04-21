import type { FastifyInstance } from "fastify";
import { eq, and, desc, sql, sum, count, gte, inArray } from "drizzle-orm";
import { db } from "../db/connection";
import {
  jobs,
  builds,
  buildAnalyses,
  healthSnapshots,
  ciInstances,
  teams,
  analysisFeedback,
  users,
  jenkinsUsers,
  failureViews,
} from "../db/schema";
import { jobMatchesTeam } from "./teams";
import { requireAuth } from "../middleware/auth";
import { jenkinsGet } from "../services/jenkins-client";
import {
  decryptCredentials,
  type EncryptedCredentials,
} from "../services/credential-vault";
import {
  resolveJobStatus,
  type BuildRow,
  type AnalysisRow,
  type JobMeta,
} from "../services/failure-status";

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
    readonly _class?: string;
    readonly task: {
      readonly _class?: string;
      readonly name: string;
      readonly url: string;
    };
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

  // Recent failures with per-job status resolution (broken / in_progress / fixed)
  app.get<{
    Querystring: {
      instance_id?: string;
      team_id?: string;
      author?: string;
      scope?: string;
      limit?: string;
      days?: string;
    };
  }>("/api/v1/dashboard/failures", async (request) => {
    const orgId = request.tigSession!.org.id;
    const userEmail = request.tigSession!.user.email;
    const instanceId = request.query.instance_id;
    const teamId = request.query.team_id;
    const author = request.query.author;
    const rawScope = request.query.scope;
    const scope: "mine" | "all" = rawScope === "all" ? "all" : "mine";
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

    // Resolve Jenkins userIds for current user (used for scope=mine)
    let jenkinsUserIds: string[] = [];
    let mineUnavailable = false;

    if (scope === "mine") {
      const rows = await db
        .select({ jenkinsUserId: jenkinsUsers.jenkinsUserId })
        .from(jenkinsUsers)
        .where(
          and(
            eq(jenkinsUsers.organizationId, orgId),
            sql`lower(${jenkinsUsers.email}) = lower(${userEmail})`,
          ),
        );
      jenkinsUserIds = rows.map((r) => r.jenkinsUserId);
      if (jenkinsUserIds.length === 0) {
        mineUnavailable = true;
      }
    }

    // Resolve the current user's app user id (needed for dismissal lookup)
    const [appUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.organizationId, orgId), eq(users.email, userEmail)))
      .limit(1);

    const appUserId = appUser?.id ?? null;

    // ── Fetch per-job latest N builds using a window function CTE ────────────
    // We collect the qualifying jobs first via a subquery on builds, then
    // pull the 3 most recent builds per job so we can resolve status in TS.
    //
    // The mine filter applies to whether the job had any build involving
    // the user in the time window (consistent with the old behaviour).

    const mineFilter =
      scope === "mine" && jenkinsUserIds.length > 0
        ? sql`(${builds.triggeredBy} = ANY(ARRAY[${sql.join(
            jenkinsUserIds.map((id) => sql`${id}`),
            sql`, `,
          )}]::text[]) OR ${builds.culprits} && ARRAY[${sql.join(
            jenkinsUserIds.map((id) => sql`${id}`),
            sql`, `,
          )}]::text[])`
        : undefined;

    // Step 1: find the distinct job ids that had at least one FAILURE/UNSTABLE
    //         build in the window and pass the scope/author/instance filters.
    const qualifyingJobsQuery = db
      .selectDistinct({ jobId: builds.jobId })
      .from(builds)
      .innerJoin(jobs, eq(jobs.id, builds.jobId))
      .where(
        and(
          eq(jobs.organizationId, orgId),
          instanceId ? eq(jobs.ciInstanceId, instanceId) : undefined,
          author ? eq(builds.triggeredBy, author) : undefined,
          mineFilter,
          sql`${builds.result} IN ('FAILURE', 'UNSTABLE')`,
          gte(builds.startedAt, since),
        ),
      )
      .limit(limit);

    const qualifyingJobs = await qualifyingJobsQuery;
    const qualifyingJobIds = qualifyingJobs.map((r) => r.jobId);

    if (qualifyingJobIds.length === 0) {
      return {
        data: [],
        mineUnavailable,
        scope: mineUnavailable ? "all" : scope,
        error: null,
      };
    }

    // Step 2: for each qualifying job, fetch its latest 3 builds (all results
    //         including NULL/ABORTED/SUCCESS) so we can resolve status.
    //         We use a ROW_NUMBER() CTE to rank builds per job.
    const rankedBuildsRaw = await db.execute(sql`
      WITH ranked AS (
        SELECT
          b.id,
          b.job_id,
          b.organization_id,
          b.build_number,
          b.result,
          b.started_at,
          b.duration_ms,
          b.git_sha,
          b.git_remote_url,
          b.triggered_by,
          b.culprits,
          ROW_NUMBER() OVER (PARTITION BY b.job_id ORDER BY b.started_at DESC) AS rn
        FROM builds b
        WHERE b.job_id = ANY(ARRAY[${sql.join(
          qualifyingJobIds.map((id) => sql`${id}`),
          sql`, `,
        )}]::uuid[])
          AND b.organization_id = ${orgId}
      )
      SELECT * FROM ranked WHERE rn <= 3
      ORDER BY job_id, started_at DESC
    `);

    // Step 3: fetch job metadata for qualifying jobs
    const jobMetaRows = await db
      .select({
        id: jobs.id,
        name: jobs.name,
        fullPath: jobs.fullPath,
        url: jobs.url,
      })
      .from(jobs)
      .where(
        and(inArray(jobs.id, qualifyingJobIds), eq(jobs.organizationId, orgId)),
      );

    // Step 4: fetch analyses for all build ids in the result set
    // Note: drizzle postgres-js adapter returns rows directly (no .rows property)
    const rankedBuilds = rankedBuildsRaw as unknown as Array<{ id: string }>;
    const allBuildIds = rankedBuilds.map((r) => r.id);

    const analysisRows =
      allBuildIds.length > 0
        ? await db
            .select({
              id: buildAnalyses.id,
              buildId: buildAnalyses.buildId,
              classification: buildAnalyses.classification,
              confidence: buildAnalyses.confidence,
              matches: buildAnalyses.matches,
              aiSummary: buildAnalyses.aiSummary,
              aiRootCause: buildAnalyses.aiRootCause,
              aiSuggestedFixes: buildAnalyses.aiSuggestedFixes,
              logNoisePercent: buildAnalyses.logNoisePercent,
              logTopNoise: buildAnalyses.logTopNoise,
            })
            .from(buildAnalyses)
            .where(
              and(
                inArray(buildAnalyses.buildId, allBuildIds),
                eq(buildAnalyses.organizationId, orgId),
              ),
            )
        : [];

    // Step 5: load dismissed build ids for this user
    let dismissedBuildIds: Set<string> = new Set();
    if (appUserId && allBuildIds.length > 0) {
      const viewedRows = await db
        .select({ buildId: failureViews.buildId })
        .from(failureViews)
        .where(
          and(
            eq(failureViews.userId, appUserId),
            eq(failureViews.organizationId, orgId),
            inArray(failureViews.buildId, allBuildIds),
          ),
        );
      dismissedBuildIds = new Set(viewedRows.map((r) => r.buildId));
    }

    // ── Assemble lookup maps ─────────────────────────────────────────────────
    const jobMetaMap = new Map<string, JobMeta>(
      jobMetaRows.map((j) => [
        j.id,
        {
          jobId: j.id,
          jobName: j.name,
          jobFullPath: j.fullPath,
          jobUrl: j.url,
        },
      ]),
    );

    const analysisByBuildId = new Map<string, AnalysisRow>(
      analysisRows.map((a) => [
        a.buildId,
        {
          id: a.id,
          buildId: a.buildId,
          classification: a.classification,
          confidence: a.confidence,
          matches: a.matches,
          aiSummary: a.aiSummary,
          aiRootCause: a.aiRootCause,
          aiSuggestedFixes: a.aiSuggestedFixes,
          logNoisePercent: a.logNoisePercent,
          logTopNoise: a.logTopNoise,
        },
      ]),
    );

    // ── Group ranked builds by job ───────────────────────────────────────────
    const buildsByJobId = new Map<string, BuildRow[]>();
    for (const raw of rankedBuilds as unknown as Array<{
      id: string;
      job_id: string;
      organization_id: string;
      build_number: number;
      result: string | null;
      started_at: Date | string;
      duration_ms: number | null;
      git_sha: string | null;
      git_remote_url: string | null;
      triggered_by: string | null;
      culprits: string[] | null;
    }>) {
      const buildRow: BuildRow = {
        id: raw.id,
        jobId: raw.job_id,
        organizationId: raw.organization_id,
        buildNumber: raw.build_number,
        result: raw.result,
        startedAt:
          raw.started_at instanceof Date
            ? raw.started_at
            : new Date(raw.started_at),
        durationMs: raw.duration_ms,
        gitSha: raw.git_sha,
        gitRemoteUrl: raw.git_remote_url,
        triggeredBy: raw.triggered_by,
        culprits: raw.culprits ?? [],
      };
      const existing = buildsByJobId.get(raw.job_id) ?? [];
      buildsByJobId.set(raw.job_id, [...existing, buildRow]);
    }

    // ── Resolve status per job ───────────────────────────────────────────────
    const resolved = qualifyingJobIds
      .map((jobId) => {
        const meta = jobMetaMap.get(jobId);
        if (!meta) return null;

        // Apply team filter here after we have job metadata
        if (teamPatterns && !jobMatchesTeam(meta.jobFullPath, teamPatterns)) {
          return null;
        }

        const jobBuilds = buildsByJobId.get(jobId) ?? [];
        return resolveJobStatus(
          meta,
          jobBuilds,
          analysisByBuildId,
          dismissedBuildIds,
        );
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    return {
      data: resolved,
      mineUnavailable,
      scope: mineUnavailable ? "all" : scope,
      error: null,
    };
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
      "items[id,_class,task[_class,name,url],why,inQueueSince,stuck,blocked,buildable]";
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

    const SCAN_TASK_CLASSES = new Set([
      "jenkins.branch.MultiBranchProject",
      "org.jenkinsci.plugins.workflow.multibranch.WorkflowMultiBranchProject",
    ]);
    const SCAN_QUEUE_CLASSES = new Set([
      "jenkins.branch.BranchIndexingCause",
      "jenkins.triggers.SCMTriggerCause",
    ]);

    const now = Date.now();
    const queueItems: QueueItem[] = jenkinsData.items
      .filter((item) => {
        // Drop branch-indexing / folder-scan queue entries
        if (item._class && SCAN_QUEUE_CLASSES.has(item._class)) return false;
        if (item.task._class && SCAN_TASK_CLASSES.has(item.task._class))
          return false;
        const why = item.why ?? "";
        if (
          why.startsWith("Branch indexing") ||
          why.startsWith("Branch event") ||
          why.includes("Scan") ||
          why.includes("indexing")
        )
          return false;
        return true;
      })
      .map((item) => ({
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

  // Running builds — from DB (sees nested folders, no live Jenkins call)
  app.get<{
    Params: { instanceId: string };
  }>("/api/v1/instances/:instanceId/running-builds", async (request, reply) => {
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

    // Find all jobs currently building (_anime suffix in color)
    const buildingJobs = await db
      .select({
        id: jobs.id,
        name: jobs.name,
        fullPath: jobs.fullPath,
        url: jobs.url,
      })
      .from(jobs)
      .where(
        and(
          eq(jobs.organizationId, orgId),
          eq(jobs.ciInstanceId, instanceId),
          sql`${jobs.color} LIKE '%_anime'`,
        ),
      );

    if (buildingJobs.length === 0) {
      return { data: [], error: null };
    }

    // For each building job, get the latest build from DB
    const now = Date.now();
    const runningBuilds: RunningBuild[] = [];

    for (const job of buildingJobs) {
      const [latestBuild] = await db
        .select({
          buildNumber: builds.buildNumber,
          startedAt: builds.startedAt,
          estimatedDurationMs: builds.estimatedDurationMs,
        })
        .from(builds)
        .where(eq(builds.jobId, job.id))
        .orderBy(desc(builds.buildNumber))
        .limit(1);

      if (!latestBuild) {
        continue;
      }

      const startedAtMs = latestBuild.startedAt.getTime();
      const durationMs = now - startedAtMs;
      const estimatedMs =
        latestBuild.estimatedDurationMs != null &&
        latestBuild.estimatedDurationMs > 0
          ? latestBuild.estimatedDurationMs
          : 1;
      const progress = Math.min(
        100,
        Math.round((durationMs / estimatedMs) * 100),
      );

      runningBuilds.push({
        jobName: job.fullPath ?? job.name,
        jobUrl: job.url,
        buildNumber: latestBuild.buildNumber,
        startedAt: latestBuild.startedAt.toISOString(),
        durationMs,
        estimatedMs,
        progress,
      });
    }

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

  // Submit feedback on an analysis (upsert)
  app.post<{
    Params: { analysisId: string };
    Body: { rating: "helpful" | "not_helpful"; note?: string };
  }>("/api/v1/analyses/:analysisId/feedback", async (request, reply) => {
    const orgId = request.tigSession!.org.id;
    const email = request.tigSession!.user.email;
    const { analysisId } = request.params;
    const { rating, note } = request.body ?? {};

    if (!rating || !["helpful", "not_helpful"].includes(rating)) {
      return reply.status(400).send({
        data: null,
        error: "rating must be 'helpful' or 'not_helpful'",
      });
    }

    // Verify analysis belongs to user's org
    const [analysis] = await db
      .select({ id: buildAnalyses.id })
      .from(buildAnalyses)
      .where(
        and(
          eq(buildAnalyses.id, analysisId),
          eq(buildAnalyses.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!analysis) {
      return reply.status(404).send({
        data: null,
        error: "Analysis not found",
      });
    }

    // Resolve app user by email + org
    const [appUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.organizationId, orgId), eq(users.email, email)))
      .limit(1);

    if (!appUser) {
      return reply.status(403).send({
        data: null,
        error: "User not found in organization",
      });
    }

    // Upsert feedback (user can change their vote)
    const [result] = await db
      .insert(analysisFeedback)
      .values({
        organizationId: orgId,
        buildAnalysisId: analysisId,
        userId: appUser.id,
        rating,
        note: note ?? null,
      })
      .onConflictDoUpdate({
        target: [analysisFeedback.userId, analysisFeedback.buildAnalysisId],
        set: {
          rating,
          note: note ?? null,
          createdAt: sql`now()`,
        },
      })
      .returning({ id: analysisFeedback.id, rating: analysisFeedback.rating });

    return { data: result, error: null };
  });

  // Get current user's feedback for an analysis
  app.get<{
    Params: { analysisId: string };
  }>("/api/v1/analyses/:analysisId/feedback", async (request) => {
    const orgId = request.tigSession!.org.id;
    const email = request.tigSession!.user.email;
    const { analysisId } = request.params;

    // Resolve app user
    const [appUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.organizationId, orgId), eq(users.email, email)))
      .limit(1);

    if (!appUser) {
      return { data: null, error: null };
    }

    const [feedback] = await db
      .select({
        id: analysisFeedback.id,
        rating: analysisFeedback.rating,
        note: analysisFeedback.note,
      })
      .from(analysisFeedback)
      .where(
        and(
          eq(analysisFeedback.buildAnalysisId, analysisId),
          eq(analysisFeedback.userId, appUser.id),
          eq(analysisFeedback.organizationId, orgId),
        ),
      )
      .limit(1);

    return { data: feedback ?? null, error: null };
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

    // Feedback stats
    const feedbackRows = await db
      .select({
        rating: analysisFeedback.rating,
        total: count(analysisFeedback.id),
      })
      .from(analysisFeedback)
      .where(eq(analysisFeedback.organizationId, orgId))
      .groupBy(analysisFeedback.rating);

    const helpfulCount = Number(
      feedbackRows.find((r) => r.rating === "helpful")?.total ?? 0,
    );
    const notHelpfulCount = Number(
      feedbackRows.find((r) => r.rating === "not_helpful")?.total ?? 0,
    );
    const feedbackTotal = helpfulCount + notHelpfulCount;
    const helpfulPercent =
      feedbackTotal > 0 ? Math.round((helpfulCount / feedbackTotal) * 100) : 0;

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
        helpfulCount,
        notHelpfulCount,
        helpfulPercent,
      },
      error: null,
    };
  });

  // Dismiss "Fixed" cards — mark recovery builds as viewed
  app.post<{
    Body: { buildIds: string[] };
  }>("/api/v1/failures/views", async (request, reply) => {
    const orgId = request.tigSession!.org.id;
    const userEmail = request.tigSession!.user.email;
    const body = request.body ?? {};
    const rawBuildIds: unknown = body.buildIds;

    // Validate: must be a non-empty array of strings, max 50
    if (
      !Array.isArray(rawBuildIds) ||
      rawBuildIds.length === 0 ||
      rawBuildIds.length > 50 ||
      !rawBuildIds.every((id) => typeof id === "string" && id.length > 0)
    ) {
      return reply.status(400).send({
        data: null,
        error: "buildIds must be a non-empty array of up to 50 string IDs",
      });
    }

    const buildIds = rawBuildIds as string[];

    // Resolve app user
    const [appUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.organizationId, orgId), eq(users.email, userEmail)))
      .limit(1);

    if (!appUser) {
      return reply.status(403).send({
        data: null,
        error: "User not found in organization",
      });
    }

    // Security: verify all supplied buildIds actually belong to this org
    // before inserting. This prevents cross-org dismissal.
    const validBuilds = await db
      .select({ id: builds.id })
      .from(builds)
      .where(
        and(eq(builds.organizationId, orgId), inArray(builds.id, buildIds)),
      );

    const validBuildIds = validBuilds.map((b) => b.id);

    if (validBuildIds.length === 0) {
      return { data: { dismissed: 0 }, error: null };
    }

    // Idempotent upsert — ON CONFLICT DO NOTHING
    const values = validBuildIds.map((buildId) => ({
      userId: appUser.id,
      buildId,
      organizationId: orgId,
    }));

    await db.insert(failureViews).values(values).onConflictDoNothing();

    return { data: { dismissed: validBuildIds.length }, error: null };
  });
}
