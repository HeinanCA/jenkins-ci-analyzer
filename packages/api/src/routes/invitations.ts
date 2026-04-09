import type { FastifyInstance } from "fastify";
import { eq, and, isNull, gt } from "drizzle-orm";
import crypto from "node:crypto";
import { db } from "../db/connection";
import { sql } from "../db/connection";
import { invitations, users } from "../db/schema";
import { requireAdmin } from "../middleware/auth";
import { auth } from "../auth";
import { logAudit } from "../services/audit";

const INVITATION_EXPIRY_DAYS = 7;
const MAX_EMAIL_LENGTH = 320;
const VALID_ROLES = ["admin", "member", "viewer"] as const;

const FRONTEND_URL = process.env["FRONTEND_URL"] ?? "http://localhost:8090";

function getFrontendBase(): string {
  return FRONTEND_URL.split(",")[0].trim();
}

// ─── Admin routes (auth required) ────────────────────────────────

export async function invitationRoutes(app: FastifyInstance) {
  // Create invitation — admin only
  app.post<{
    Body: { email: string; role?: string };
  }>(
    "/api/v1/admin/invitations",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { email, role } = request.body;
      const orgId = request.tigSession!.org.id;
      const invitedById = request.tigSession!.user.id;

      if (!email || typeof email !== "string") {
        return reply.status(400).send({
          data: null,
          error: "Email is required",
        });
      }

      if (email.length > MAX_EMAIL_LENGTH) {
        return reply.status(400).send({
          data: null,
          error: "Email exceeds maximum length",
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return reply.status(400).send({
          data: null,
          error: "Invalid email format",
        });
      }

      const selectedRole = role ?? "member";
      if (!VALID_ROLES.includes(selectedRole as (typeof VALID_ROLES)[number])) {
        return reply.status(400).send({
          data: null,
          error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`,
        });
      }

      // Check if user already exists in this org
      const existingUser = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.organizationId, orgId), eq(users.email, email)))
        .limit(1);

      if (existingUser.length > 0) {
        return reply.status(409).send({
          data: null,
          error: "User with this email already exists in the organization",
        });
      }

      // Check for existing pending invitation
      const existingInvite = await db
        .select({ id: invitations.id })
        .from(invitations)
        .where(
          and(
            eq(invitations.organizationId, orgId),
            eq(invitations.email, email),
            isNull(invitations.acceptedAt),
            gt(invitations.expiresAt, new Date()),
          ),
        )
        .limit(1);

      if (existingInvite.length > 0) {
        return reply.status(409).send({
          data: null,
          error: "A pending invitation already exists for this email",
        });
      }

      // Resolve invitedBy: find the users table ID for the current auth user
      const inviterRows = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.organizationId, orgId),
            eq(users.email, request.tigSession!.user.email),
          ),
        )
        .limit(1);

      const inviterId =
        inviterRows.length > 0 ? inviterRows[0].id : invitedById;

      const token = crypto.randomUUID();
      const expiresAt = new Date(
        Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      );

      const [created] = await db
        .insert(invitations)
        .values({
          organizationId: orgId,
          email,
          role: selectedRole as (typeof VALID_ROLES)[number],
          token,
          invitedBy: inviterId,
          expiresAt,
        })
        .returning({
          id: invitations.id,
          email: invitations.email,
          token: invitations.token,
          expiresAt: invitations.expiresAt,
        });

      const inviteUrl = `${getFrontendBase()}/invite?token=${token}`;

      await logAudit({
        organizationId: orgId,
        actorUserId: request.tigSession!.user.id,
        actorEmail: request.tigSession!.user.email,
        action: "invite.created",
        targetType: "invitation",
        targetId: created.id,
        metadata: { email, role: selectedRole },
      });

      return reply.status(201).send({
        data: { ...created, inviteUrl },
        error: null,
      });
    },
  );

  // List pending invitations — admin only
  app.get(
    "/api/v1/admin/invitations",
    { preHandler: requireAdmin },
    async (request) => {
      const orgId = request.tigSession!.org.id;

      const pending = await db
        .select({
          id: invitations.id,
          email: invitations.email,
          role: invitations.role,
          token: invitations.token,
          expiresAt: invitations.expiresAt,
          createdAt: invitations.createdAt,
        })
        .from(invitations)
        .where(
          and(
            eq(invitations.organizationId, orgId),
            isNull(invitations.acceptedAt),
            gt(invitations.expiresAt, new Date()),
          ),
        );

      return { data: pending, error: null };
    },
  );

  // Revoke invitation — admin only
  app.delete<{ Params: { id: string } }>(
    "/api/v1/admin/invitations/:id",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const orgId = request.tigSession!.org.id;

      const [deleted] = await db
        .delete(invitations)
        .where(
          and(
            eq(invitations.id, request.params.id),
            eq(invitations.organizationId, orgId),
          ),
        )
        .returning({ id: invitations.id, email: invitations.email });

      if (!deleted) {
        return reply.status(404).send({
          data: null,
          error: "Invitation not found",
        });
      }

      await logAudit({
        organizationId: orgId,
        actorUserId: request.tigSession!.user.id,
        actorEmail: request.tigSession!.user.email,
        action: "invite.revoked",
        targetType: "invitation",
        targetId: deleted.id,
        metadata: { email: deleted.email },
      });

      return { data: { id: deleted.id }, error: null };
    },
  );
}

// ─── Public route (no auth) ──────────────────────────────────────

export async function inviteAcceptRoute(app: FastifyInstance) {
  app.post<{
    Body: { token: string; name: string; password: string };
  }>("/api/v1/invite/accept", async (request, reply) => {
    const { token, name, password } = request.body;

    if (!token || !name || !password) {
      return reply.status(400).send({
        data: null,
        error: "Missing required fields: token, name, password",
      });
    }

    if (typeof name !== "string" || name.trim().length === 0) {
      return reply.status(400).send({
        data: null,
        error: "Name is required",
      });
    }

    if (typeof password !== "string" || password.length < 12) {
      return reply.status(400).send({
        data: null,
        error: "Password must be at least 12 characters",
      });
    }

    // Look up invitation via SECURITY DEFINER function (bypasses RLS)
    const rows = await sql`
      SELECT * FROM lookup_invitation_by_token(${token})
    `;

    const invitation = rows[0] as
      | {
          id: string;
          organization_id: string;
          email: string;
          role: string;
          token: string;
          invited_by: string;
          expires_at: Date;
          accepted_at: Date | null;
          created_at: Date;
        }
      | undefined;

    if (!invitation) {
      return reply.status(404).send({
        data: null,
        error: "Invitation not found",
      });
    }

    if (invitation.accepted_at) {
      return reply.status(410).send({
        data: null,
        error: "This invitation has already been used",
      });
    }

    if (new Date() > new Date(invitation.expires_at)) {
      return reply.status(410).send({
        data: null,
        error: "This invitation has expired",
      });
    }

    // Create better-auth account via internal API call
    try {
      const signUpResult = await auth.api.signUpEmail({
        body: {
          email: invitation.email,
          password,
          name: name.trim(),
        },
      });

      if (!signUpResult?.user) {
        return reply.status(500).send({
          data: null,
          error: "Failed to create account",
        });
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Account creation failed";

      request.log.error(error, "Failed to create better-auth account");
      return reply.status(400).send({
        data: null,
        error: message,
      });
    }

    // Create users table entry with the invitation's org + role
    // Use raw SQL to bypass RLS since there is no auth context
    await sql`
      INSERT INTO users (organization_id, email, display_name, role)
      VALUES (
        ${invitation.organization_id},
        ${invitation.email},
        ${name.trim()},
        ${invitation.role}
      )
    `;

    // Mark invitation as accepted (raw SQL to bypass RLS)
    await sql`
      UPDATE invitations
      SET accepted_at = now()
      WHERE id = ${invitation.id}::uuid
    `;

    await logAudit({
      organizationId: invitation.organization_id,
      actorUserId: invitation.invited_by,
      actorEmail: invitation.email,
      action: "invite.accepted",
      targetType: "invitation",
      targetId: invitation.id,
      metadata: { email: invitation.email },
    });

    return { data: { success: true }, error: null };
  });
}
