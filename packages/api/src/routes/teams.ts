import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { db } from "../db/connection";
import { teams, jobs } from "../db/schema";
import { requireAuth } from "../middleware/auth";

const MAX_TEAM_NAME_LENGTH = 200;
const MAX_PATTERN_LENGTH = 500;
const MAX_PATTERNS_COUNT = 50;

function escapeRegex(str: string): string {
  return str.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}

function matchesPattern(fullPath: string, pattern: string): boolean {
  // Convert glob pattern to regex: ** = any depth, * = single segment
  // Escape regex metacharacters first (except * which we handle), then convert globs
  const parts = pattern.split(/(\*\*|\*)/);
  const regexStr = parts
    .map((part) => {
      if (part === "**") return ".*";
      if (part === "*") return "[^/]*";
      return escapeRegex(part);
    })
    .join("");
  const regex = new RegExp(`^${regexStr}$`);
  return regex.test(fullPath);
}

function jobMatchesTeam(fullPath: string, folderPatterns: string[]): boolean {
  return folderPatterns.some((pattern) => matchesPattern(fullPath, pattern));
}

export async function teamRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // List teams
  app.get("/api/v1/teams", async () => {
    const allTeams = await db
      .select({
        id: teams.id,
        name: teams.name,
        ciInstanceId: teams.ciInstanceId,
        folderPatterns: teams.folderPatterns,
        createdAt: teams.createdAt,
      })
      .from(teams);

    return { data: allTeams, error: null };
  });

  // Create team
  app.post<{
    Body: {
      name: string;
      ciInstanceId: string;
      organizationId: string;
      folderPatterns: string[];
    };
  }>("/api/v1/teams", async (request, reply) => {
    const { name, ciInstanceId, organizationId, folderPatterns } = request.body;

    if (!name || !ciInstanceId || !organizationId || !folderPatterns?.length) {
      return reply.status(400).send({
        data: null,
        error:
          "Missing required fields: name, ciInstanceId, organizationId, folderPatterns",
      });
    }

    // Input length validation
    if (name.length > MAX_TEAM_NAME_LENGTH) {
      return reply.status(400).send({
        data: null,
        error: "Team name exceeds maximum length",
      });
    }
    if (folderPatterns.length > MAX_PATTERNS_COUNT) {
      return reply.status(400).send({
        data: null,
        error: "Too many folder patterns",
      });
    }
    if (
      folderPatterns.some(
        (p) => typeof p !== "string" || p.length > MAX_PATTERN_LENGTH,
      )
    ) {
      return reply.status(400).send({
        data: null,
        error: "One or more folder patterns are invalid or too long",
      });
    }

    const [created] = await db
      .insert(teams)
      .values({ name, ciInstanceId, organizationId, folderPatterns })
      .returning({
        id: teams.id,
        name: teams.name,
        folderPatterns: teams.folderPatterns,
        createdAt: teams.createdAt,
      });

    return reply.status(201).send({ data: created, error: null });
  });

  // Update team
  app.patch<{
    Params: { id: string };
    Body: { name?: string; folderPatterns?: string[] };
  }>("/api/v1/teams/:id", async (request, reply) => {
    // Input length validation
    if (request.body.name && request.body.name.length > MAX_TEAM_NAME_LENGTH) {
      return reply.status(400).send({
        data: null,
        error: "Team name exceeds maximum length",
      });
    }
    if (
      request.body.folderPatterns &&
      (request.body.folderPatterns.length > MAX_PATTERNS_COUNT ||
        request.body.folderPatterns.some(
          (p) => typeof p !== "string" || p.length > MAX_PATTERN_LENGTH,
        ))
    ) {
      return reply.status(400).send({
        data: null,
        error: "Folder patterns are invalid or too long",
      });
    }

    const updates: Record<string, unknown> = {};
    if (request.body.name) updates["name"] = request.body.name;
    if (request.body.folderPatterns)
      updates["folderPatterns"] = request.body.folderPatterns;

    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({ data: null, error: "Nothing to update" });
    }

    const [updated] = await db
      .update(teams)
      .set(updates)
      .where(eq(teams.id, request.params.id))
      .returning({
        id: teams.id,
        name: teams.name,
        folderPatterns: teams.folderPatterns,
      });

    if (!updated) {
      return reply.status(404).send({ data: null, error: "Team not found" });
    }

    return { data: updated, error: null };
  });

  // Delete team
  app.delete<{ Params: { id: string } }>(
    "/api/v1/teams/:id",
    async (request, reply) => {
      const [deleted] = await db
        .delete(teams)
        .where(eq(teams.id, request.params.id))
        .returning({ id: teams.id });

      if (!deleted) {
        return reply.status(404).send({ data: null, error: "Team not found" });
      }

      return { data: { id: deleted.id }, error: null };
    },
  );

  // Get jobs matching a team's folder patterns
  app.get<{ Params: { id: string } }>(
    "/api/v1/teams/:id/jobs",
    async (request, reply) => {
      const [team] = await db
        .select({
          ciInstanceId: teams.ciInstanceId,
          folderPatterns: teams.folderPatterns,
        })
        .from(teams)
        .where(eq(teams.id, request.params.id))
        .limit(1);

      if (!team) {
        return reply.status(404).send({ data: null, error: "Team not found" });
      }

      const allJobs = await db
        .select({
          id: jobs.id,
          fullPath: jobs.fullPath,
          name: jobs.name,
          color: jobs.color,
          healthScore: jobs.healthScore,
        })
        .from(jobs)
        .where(
          and(
            eq(jobs.ciInstanceId, team.ciInstanceId),
            eq(jobs.isActive, true),
          ),
        );

      const matched = allJobs.filter((j) =>
        jobMatchesTeam(j.fullPath, team.folderPatterns),
      );

      return { data: matched, error: null };
    },
  );
}

export { jobMatchesTeam };
