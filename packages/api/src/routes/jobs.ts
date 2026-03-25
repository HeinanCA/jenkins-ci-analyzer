import type { FastifyInstance } from "fastify";
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../db/connection";
import { jobs, builds, buildAnalyses, ciInstances } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import {
  decryptCredentials,
  type EncryptedCredentials,
} from "../services/credential-vault";
import { jenkinsGetText } from "../services/jenkins-client";

export async function jobRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // List jobs for an instance
  app.get<{
    Params: { instanceId: string };
    Querystring: { status?: string; limit?: string; offset?: string };
  }>("/api/v1/instances/:instanceId/jobs", async (request) => {
    const { instanceId } = request.params;
    const rawLimit = Number(request.query.limit ?? 100);
    const limit = Number.isFinite(rawLimit)
      ? Math.max(1, Math.min(rawLimit, 2000))
      : 100;
    const rawOffset = Number(request.query.offset ?? 0);
    const offset = Number.isFinite(rawOffset) ? Math.max(0, rawOffset) : 0;
    const status = request.query.status;

    let query = db
      .select({
        id: jobs.id,
        fullPath: jobs.fullPath,
        name: jobs.name,
        color: jobs.color,
        healthScore: jobs.healthScore,
        isActive: jobs.isActive,
        lastSeenAt: jobs.lastSeenAt,
      })
      .from(jobs)
      .where(
        and(
          eq(jobs.ciInstanceId, instanceId),
          eq(jobs.isActive, true),
          status === "failing" ? sql`${jobs.color} LIKE 'red%'` : undefined,
        ),
      )
      .orderBy(jobs.fullPath)
      .limit(limit)
      .offset(offset);

    const result = await query;

    return {
      data: result,
      error: null,
      meta: { limit, offset, count: result.length },
    };
  });

  // Get build history for a job
  app.get<{
    Params: { jobId: string };
    Querystring: { limit?: string };
  }>("/api/v1/jobs/:jobId/builds", async (request, reply) => {
    const { jobId } = request.params;
    const rawBuildLimit = Number(request.query.limit ?? 25);
    const limit = Number.isFinite(rawBuildLimit)
      ? Math.max(1, Math.min(rawBuildLimit, 100))
      : 25;

    const [job] = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);

    if (!job) {
      return reply.status(404).send({ data: null, error: "Job not found" });
    }

    const result = await db
      .select({
        id: builds.id,
        buildNumber: builds.buildNumber,
        result: builds.result,
        startedAt: builds.startedAt,
        durationMs: builds.durationMs,
      })
      .from(builds)
      .where(eq(builds.jobId, jobId))
      .orderBy(desc(builds.buildNumber))
      .limit(limit);

    return { data: result, error: null };
  });

  // Get single build with analysis
  app.get<{ Params: { buildId: string } }>(
    "/api/v1/builds/:buildId",
    async (request, reply) => {
      const [build] = await db
        .select({
          id: builds.id,
          jobId: builds.jobId,
          buildNumber: builds.buildNumber,
          result: builds.result,
          startedAt: builds.startedAt,
          durationMs: builds.durationMs,
        })
        .from(builds)
        .where(eq(builds.id, request.params.buildId))
        .limit(1);

      if (!build) {
        return reply.status(404).send({ data: null, error: "Build not found" });
      }

      const [analysis] = await db
        .select({
          classification: buildAnalyses.classification,
          confidence: buildAnalyses.confidence,
          matches: buildAnalyses.matches,
          aiSummary: buildAnalyses.aiSummary,
          aiRootCause: buildAnalyses.aiRootCause,
          aiSuggestedFixes: buildAnalyses.aiSuggestedFixes,
          aiSkippedReason: buildAnalyses.aiSkippedReason,
          analyzedAt: buildAnalyses.analyzedAt,
        })
        .from(buildAnalyses)
        .where(eq(buildAnalyses.buildId, build.id))
        .limit(1);

      return {
        data: { ...build, analysis: analysis ?? null },
        error: null,
      };
    },
  );

  // Get build log (proxied through backend)
  app.get<{ Params: { buildId: string } }>(
    "/api/v1/builds/:buildId/log",
    async (request, reply) => {
      const [build] = await db
        .select({
          id: builds.id,
          jobId: builds.jobId,
          buildNumber: builds.buildNumber,
        })
        .from(builds)
        .where(eq(builds.id, request.params.buildId))
        .limit(1);

      if (!build) {
        return reply.status(404).send({ data: null, error: "Build not found" });
      }

      const [job] = await db
        .select({
          fullPath: jobs.fullPath,
          ciInstanceId: jobs.ciInstanceId,
        })
        .from(jobs)
        .where(eq(jobs.id, build.jobId))
        .limit(1);

      if (!job) {
        return reply.status(404).send({ data: null, error: "Job not found" });
      }

      const [instance] = await db
        .select({
          baseUrl: ciInstances.baseUrl,
          credentials: ciInstances.credentials,
        })
        .from(ciInstances)
        .where(eq(ciInstances.id, job.ciInstanceId))
        .limit(1);

      if (!instance) {
        return reply
          .status(404)
          .send({ data: null, error: "Instance not found" });
      }

      const credentials = decryptCredentials(
        instance.credentials as EncryptedCredentials,
      );

      const segments = job.fullPath.split("/");
      const jenkinsPath = segments
        .map((s) => `job/${encodeURIComponent(s)}`)
        .join("/");
      const url = `${instance.baseUrl}/${jenkinsPath}/${build.buildNumber}/consoleText`;

      try {
        const log = await jenkinsGetText(url, credentials);
        return reply.type("text/plain").send(log);
      } catch {
        return reply.status(502).send({
          data: null,
          error: "Failed to fetch build log from Jenkins",
        });
      }
    },
  );
}
