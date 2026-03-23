import type { FastifyInstance } from "fastify";
import { eq, and, desc, sql, sum, count, gte } from "drizzle-orm";
import { db } from "../db/connection";
import {
  jobs,
  builds,
  buildAnalyses,
  healthSnapshots,
  teams,
} from "../db/schema";
import { jobMatchesTeam } from "./teams";
import { requireAuth } from "../middleware/auth";

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // Summary stats for an instance
  app.get<{
    Querystring: { instance_id?: string };
  }>("/api/v1/dashboard/summary", async (request) => {
    const instanceId = request.query.instance_id;

    const jobFilter = instanceId
      ? eq(jobs.ciInstanceId, instanceId)
      : eq(jobs.isActive, true);

    const allJobs = await db
      .select({ color: jobs.color })
      .from(jobs)
      .where(and(jobFilter, eq(jobs.isActive, true)));

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
      limit?: string;
      days?: string;
    };
  }>("/api/v1/dashboard/failures", async (request) => {
    const instanceId = request.query.instance_id;
    const teamId = request.query.team_id;
    const limit = Math.min(Number(request.query.limit ?? 50), 100);
    const days = Number(request.query.days ?? 3);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Load team patterns if filtering by team
    let teamPatterns: string[] | null = null;
    if (teamId) {
      const [team] = await db
        .select({ folderPatterns: teams.folderPatterns })
        .from(teams)
        .where(eq(teams.id, teamId))
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
        classification: buildAnalyses.classification,
        confidence: buildAnalyses.confidence,
        matches: buildAnalyses.matches,
        aiSummary: buildAnalyses.aiSummary,
        aiRootCause: buildAnalyses.aiRootCause,
        aiSuggestedFixes: buildAnalyses.aiSuggestedFixes,
        logNoisePercent: buildAnalyses.logNoisePercent,
        logTopNoise: buildAnalyses.logTopNoise,
      })
      .from(builds)
      .innerJoin(jobs, eq(jobs.id, builds.jobId))
      .leftJoin(buildAnalyses, eq(buildAnalyses.buildId, builds.id))
      .where(
        and(
          instanceId ? eq(jobs.ciInstanceId, instanceId) : undefined,
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

  // Health — current snapshot for an instance
  app.get<{
    Params: { instanceId: string };
  }>("/api/v1/instances/:instanceId/health", async (request, reply) => {
    const { instanceId } = request.params;

    const [snapshot] = await db
      .select()
      .from(healthSnapshots)
      .where(eq(healthSnapshots.ciInstanceId, instanceId))
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
  }>("/api/v1/instances/:instanceId/health/history", async (request) => {
    const { instanceId } = request.params;
    const period = request.query.period ?? "24h";

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
          sql`${healthSnapshots.recordedAt} >= ${since}`,
        ),
      )
      .orderBy(healthSnapshots.recordedAt);

    return { data: snapshots, error: null };
  });

  // AI cost tracking + status
  app.get("/api/v1/dashboard/ai-cost", async () => {
    const [result] = await db
      .select({
        totalCost: sum(buildAnalyses.aiCostUsd),
        totalInputTokens: sum(buildAnalyses.aiInputTokens),
        totalOutputTokens: sum(buildAnalyses.aiOutputTokens),
        analyzedCount: count(buildAnalyses.id),
        aiCount: count(buildAnalyses.aiSummary),
      })
      .from(buildAnalyses);

    // Check if AI is working: is the MOST RECENT analysis missing AI?
    const [latestAnalysis] = await db
      .select({
        aiSummary: buildAnalyses.aiSummary,
        analyzedAt: buildAnalyses.analyzedAt,
      })
      .from(buildAnalyses)
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
