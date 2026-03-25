import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/connection";
import { organizations, users } from "../db/schema";
import { requireAuth } from "../middleware/auth";

export async function organizationRoutes(app: FastifyInstance) {
  // Setup route — creates org + links user on first run
  // No auth required — this is the first thing a new user does
  app.post<{
    Body: {
      orgName: string;
      email: string;
      password: string;
      displayName: string;
    };
  }>("/api/v1/setup", async (request, reply) => {
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

  // Check setup status — no auth required
  app.get("/api/v1/setup/status", async () => {
    const existingOrgs = await db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .limit(1);

    return {
      data: {
        isSetUp: existingOrgs.length > 0,
        organization: existingOrgs[0] ?? null,
      },
      error: null,
    };
  });

  // Auth-protected org routes
  app.get(
    "/api/v1/organization",
    { preHandler: requireAuth },
    async (request, reply) => {
      // Get the org for the current user
      const session = request.tigSession;
      if (!session) {
        return reply
          .status(401)
          .send({ data: null, error: "Authentication required" });
      }

      const [user] = await db
        .select({ organizationId: users.organizationId })
        .from(users)
        .where(eq(users.email, session.user.email))
        .limit(1);

      if (!user) {
        return reply
          .status(404)
          .send({ data: null, error: "User not found in organization" });
      }

      const [org] = await db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
        })
        .from(organizations)
        .where(eq(organizations.id, user.organizationId))
        .limit(1);

      return { data: org ?? null, error: null };
    },
  );
}
