import type { FastifyInstance } from "fastify";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/connection";
import { organizations, users } from "../db/schema";
import { requireAuth } from "../middleware/auth";

const VALID_ROLES = ["admin", "member", "viewer"] as const;
type UserRole = (typeof VALID_ROLES)[number];

export async function organizationRoutes(app: FastifyInstance) {
  // Setup route — disabled for now (invitation-only mode)
  app.post<{
    Body: {
      orgName: string;
      email: string;
      password: string;
      displayName: string;
    };
  }>("/api/v1/setup", async (request, reply) => {
    // Setup is disabled — invitation-only mode
    return reply.status(403).send({
      data: null,
      error: "Setup is disabled. Contact your admin.",
    });

    const { orgName, email, password, displayName } = request.body;

    if (!orgName || !email || !password || !displayName) {
      return reply.status(400).send({
        data: null,
        error: "Missing required fields: orgName, email, password, displayName",
      });
    }

    // Check if any org exists already
    const existingOrgs = await db
      .select({ id: organizations.id })
      .from(organizations)
      .limit(1);

    if (existingOrgs.length > 0) {
      // Org exists — add this user as a member instead of rejecting
      const existingUser = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser.length === 0) {
        await db.insert(users).values({
          organizationId: existingOrgs[0].id,
          email,
          displayName,
          role: "member",
        });
      }

      const [org] = await db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
        })
        .from(organizations)
        .where(eq(organizations.id, existingOrgs[0].id))
        .limit(1);

      return reply.status(200).send({
        data: { organization: org },
        error: null,
      });
    }

    // Create org
    const slug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const [org] = await db
      .insert(organizations)
      .values({ name: orgName, slug })
      .returning({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
      });

    // Create user in our users table as admin
    const [user] = await db
      .insert(users)
      .values({
        organizationId: org.id,
        email,
        displayName,
        role: "admin",
      })
      .returning({ id: users.id, email: users.email, role: users.role });

    return reply.status(201).send({
      data: {
        organization: org,
        user,
        nextStep:
          "Sign up at /api/auth/sign-up/email with the same email, then add a Jenkins instance at POST /api/v1/instances",
      },
      error: null,
    });
  });

  // Check setup status — no auth required, but only expose minimal info
  // Uses SECURITY DEFINER function to bypass RLS (no org context on this endpoint)
  app.get("/api/v1/setup/status", async () => {
    const result = await db.execute(sql`SELECT has_any_org() as has_org`);
    const hasOrg = result[0]?.has_org === true;

    return {
      data: {
        isSetUp: hasOrg,
      },
      error: null,
    };
  });

  // Auth-protected org routes
  app.get(
    "/api/v1/organization",
    { preHandler: requireAuth },
    async (request, reply) => {
      const orgId = request.tigSession!.org.id;

      const [org] = await db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
        })
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1);

      if (!org) {
        return reply
          .status(404)
          .send({ data: null, error: "Organization not found" });
      }

      return { data: org, error: null };
    },
  );

  // Current user info (for frontend role checks)
  app.get("/api/v1/me", { preHandler: requireAuth }, async (request) => {
    const { id: orgId, role } = request.tigSession!.org;
    const email = request.tigSession!.user.email;

    const [me] = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
      })
      .from(users)
      .where(and(eq(users.organizationId, orgId), eq(users.email, email)))
      .limit(1);

    return { data: me ?? { email, role }, error: null };
  });

  // ─── Admin: List org users ─────────────────────────────────────
  app.get(
    "/api/v1/admin/users",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id: orgId, role } = request.tigSession!.org;
      if (role !== "admin") {
        return reply
          .status(403)
          .send({ data: null, error: "Admin access required" });
      }

      const orgUsers = await db
        .select({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
          role: users.role,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.organizationId, orgId));

      return { data: orgUsers, error: null };
    },
  );

  // ─── Admin: Update user role ───────────────────────────────────
  app.patch<{ Params: { userId: string }; Body: { role: string } }>(
    "/api/v1/admin/users/:userId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id: orgId, role } = request.tigSession!.org;
      if (role !== "admin") {
        return reply
          .status(403)
          .send({ data: null, error: "Admin access required" });
      }

      const { userId } = request.params;
      const { role: newRole } = request.body;

      if (!newRole || !VALID_ROLES.includes(newRole as UserRole)) {
        return reply.status(400).send({
          data: null,
          error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`,
        });
      }

      // Verify target user belongs to this org
      const [targetUser] = await db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(and(eq(users.id, userId), eq(users.organizationId, orgId)))
        .limit(1);

      if (!targetUser) {
        return reply
          .status(404)
          .send({ data: null, error: "User not found in your organization" });
      }

      // Prevent demoting the last admin
      if (targetUser.role === "admin" && newRole !== "admin") {
        const adminCount = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(users)
          .where(and(eq(users.organizationId, orgId), eq(users.role, "admin")));

        if ((adminCount[0]?.count ?? 0) <= 1) {
          return reply.status(400).send({
            data: null,
            error: "Cannot demote the last admin",
          });
        }
      }

      const [updated] = await db
        .update(users)
        .set({ role: newRole as UserRole })
        .where(and(eq(users.id, userId), eq(users.organizationId, orgId)))
        .returning({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
          role: users.role,
          createdAt: users.createdAt,
        });

      return { data: updated, error: null };
    },
  );

  // ─── Admin: Remove user ────────────────────────────────────────
  app.delete<{ Params: { userId: string } }>(
    "/api/v1/admin/users/:userId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id: orgId, role } = request.tigSession!.org;
      if (role !== "admin") {
        return reply
          .status(403)
          .send({ data: null, error: "Admin access required" });
      }

      const { userId } = request.params;
      const currentUserEmail = request.tigSession!.user.email;

      // Verify target user belongs to this org
      const [targetUser] = await db
        .select({ id: users.id, email: users.email, role: users.role })
        .from(users)
        .where(and(eq(users.id, userId), eq(users.organizationId, orgId)))
        .limit(1);

      if (!targetUser) {
        return reply
          .status(404)
          .send({ data: null, error: "User not found in your organization" });
      }

      // Cannot delete yourself
      if (targetUser.email === currentUserEmail) {
        return reply
          .status(400)
          .send({ data: null, error: "Cannot remove yourself" });
      }

      // Cannot delete the last admin
      if (targetUser.role === "admin") {
        const adminCount = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(users)
          .where(and(eq(users.organizationId, orgId), eq(users.role, "admin")));

        if ((adminCount[0]?.count ?? 0) <= 1) {
          return reply.status(400).send({
            data: null,
            error: "Cannot remove the last admin",
          });
        }
      }

      await db
        .delete(users)
        .where(and(eq(users.id, userId), eq(users.organizationId, orgId)));

      return { data: null, error: null };
    },
  );
}
