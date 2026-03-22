import type { FastifyInstance } from "fastify";
import { eq, and, desc, sql, sum, count } from "drizzle-orm";
import { db } from "../db/connection";
import { jobs, builds, buildAnalyses, healthSnapshots } from "../db/schema";
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
    Querystring: { instance_id?: string; limit?: string };
  }>("/api/v1/dashboard/failures", async (request) => {
    const instanceId = request.query.instance_id;
    const limit = Math.min(Number(request.query.limit ?? 20), 50);

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
        ),
      )
      .orderBy(desc(builds.startedAt))
      .limit(limit);

    return { data: failures, error: null };
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

  // AI cost tracking
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
      },
      error: null,
    };
  });
}
