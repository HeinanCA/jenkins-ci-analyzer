import type { FastifyInstance } from "fastify";
import { sql, eq } from "drizzle-orm";
import { db } from "../db/connection";
import { requireAuth } from "../middleware/auth";
import { teams, jobs } from "../db/schema";
import { jobMatchesTeam } from "./teams";

type TrendsQuery = {
  Querystring: { instance_id?: string; days?: string; team_id?: string };
};

// Resolve team glob patterns to a set of job IDs
async function resolveTeamJobIds(teamId: string): Promise<string[]> {
  const [team] = await db
    .select({ folderPatterns: teams.folderPatterns })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);

  if (!team) return [];

  const allJobs = await db
    .select({ id: jobs.id, fullPath: jobs.fullPath })
    .from(jobs);

  return allJobs
    .filter((j) => jobMatchesTeam(j.fullPath, team.folderPatterns))
    .map((j) => j.id);
}

function buildFilters(
  instanceId: string | undefined,
  teamJobIds: string[] | null,
) {
  const instanceFilter = instanceId
    ? sql`AND j.ci_instance_id = ${instanceId}`
    : sql``;

  const teamFilter =
    teamJobIds !== null
      ? teamJobIds.length > 0
        ? sql`AND j.id = ANY(${teamJobIds})`
        : sql`AND FALSE`
      : sql``;

  return { instanceFilter, teamFilter };
}

export async function trendsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // Failure rate over time — daily buckets
  app.get<TrendsQuery>("/api/v1/trends/failure-rate", async (request) => {
    const days = Number(request.query.days ?? 7);
    const since = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000,
    ).toISOString();
    const teamJobIds = request.query.team_id
      ? await resolveTeamJobIds(request.query.team_id)
      : null;
    const { instanceFilter, teamFilter } = buildFilters(
      request.query.instance_id,
      teamJobIds,
    );

    const result = await db.execute(sql`
      SELECT
        DATE(b.started_at) as date,
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE b.result IN ('FAILURE', 'UNSTABLE'))::int as failed,
        ROUND(
          COUNT(*) FILTER (WHERE b.result IN ('FAILURE', 'UNSTABLE'))::numeric
          / NULLIF(COUNT(*), 0) * 100, 1
        )::float as rate
      FROM builds b
      JOIN jobs j ON j.id = b.job_id
      WHERE b.started_at >= ${since}
        ${instanceFilter}
        ${teamFilter}
      GROUP BY DATE(b.started_at)
      ORDER BY date
    `);

    return { data: result, error: null };
  });

  // MTTR — mean time to recovery
  app.get<TrendsQuery>("/api/v1/trends/mttr", async (request) => {
    const days = Number(request.query.days ?? 30);
    const since = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000,
    ).toISOString();
    const teamJobIds = request.query.team_id
      ? await resolveTeamJobIds(request.query.team_id)
      : null;
    const { instanceFilter, teamFilter } = buildFilters(
      request.query.instance_id,
      teamJobIds,
    );

    const result = await db.execute(sql`
      WITH failure_recovery AS (
        SELECT
          b.job_id,
          b.started_at as failed_at,
          (
            SELECT MIN(b2.started_at)
            FROM builds b2
            WHERE b2.job_id = b.job_id
              AND b2.build_number > b.build_number
              AND b2.result = 'SUCCESS'
          ) as recovered_at
        FROM builds b
        JOIN jobs j ON j.id = b.job_id
        WHERE b.result IN ('FAILURE', 'UNSTABLE')
          AND b.started_at >= ${since}
          ${instanceFilter}
          ${teamFilter}
      )
      SELECT
        DATE(failed_at) as date,
        ROUND(AVG(EXTRACT(EPOCH FROM (recovered_at - failed_at)) / 3600)::numeric, 1)::float as avg_recovery_hours
      FROM failure_recovery
      WHERE recovered_at IS NOT NULL
      GROUP BY DATE(failed_at)
      ORDER BY date
    `);

    return { data: result, error: null };
  });

  // Build frequency — daily
  app.get<TrendsQuery>("/api/v1/trends/build-frequency", async (request) => {
    const days = Number(request.query.days ?? 7);
    const since = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000,
    ).toISOString();
    const teamJobIds = request.query.team_id
      ? await resolveTeamJobIds(request.query.team_id)
      : null;
    const { instanceFilter, teamFilter } = buildFilters(
      request.query.instance_id,
      teamJobIds,
    );

    const result = await db.execute(sql`
      SELECT
        DATE(b.started_at) as date,
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE b.result = 'SUCCESS')::int as success,
        COUNT(*) FILTER (WHERE b.result IN ('FAILURE', 'UNSTABLE'))::int as failure
      FROM builds b
      JOIN jobs j ON j.id = b.job_id
      WHERE b.started_at >= ${since}
        ${instanceFilter}
        ${teamFilter}
      GROUP BY DATE(b.started_at)
      ORDER BY date
    `);

    return { data: result, error: null };
  });

  // Classification breakdown — infra vs code
  app.get<TrendsQuery>("/api/v1/trends/classification", async (request) => {
    const days = Number(request.query.days ?? 7);
    const since = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000,
    ).toISOString();
    const teamJobIds = request.query.team_id
      ? await resolveTeamJobIds(request.query.team_id)
      : null;
    const { instanceFilter, teamFilter } = buildFilters(
      request.query.instance_id,
      teamJobIds,
    );

    const result = await db.execute(sql`
      SELECT
        DATE(b.started_at) as date,
        COUNT(*) FILTER (WHERE ba.classification = 'code')::int as code,
        COUNT(*) FILTER (WHERE ba.classification = 'infrastructure')::int as infra,
        COUNT(*) FILTER (WHERE ba.classification = 'unknown' OR ba.classification IS NULL)::int as unknown
      FROM builds b
      JOIN jobs j ON j.id = b.job_id
      LEFT JOIN build_analyses ba ON ba.build_id = b.id
      WHERE b.result IN ('FAILURE', 'UNSTABLE')
        AND b.started_at >= ${since}
        ${instanceFilter}
        ${teamFilter}
      GROUP BY DATE(b.started_at)
      ORDER BY date
    `);

    return { data: result, error: null };
  });
}
