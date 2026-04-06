import type { FastifyRequest, FastifyReply } from "fastify";
import { auth } from "../auth";
import { fromNodeHeaders } from "better-auth/node";
import { sql } from "../db/connection";

// ─── Org lookup cache (email → { orgId, role, expiresAt }) ──────
interface OrgCacheEntry {
  readonly orgId: string;
  readonly role: string;
  readonly expiresAt: number;
}

const ORG_CACHE_TTL_MS = 60_000;
const orgCache = new Map<string, OrgCacheEntry>();

function getCachedOrg(email: string): OrgCacheEntry | undefined {
  const entry = orgCache.get(email);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    orgCache.delete(email);
    return undefined;
  }
  return entry;
}

function setCachedOrg(
  email: string,
  orgId: string,
  role: string,
): OrgCacheEntry {
  const entry: OrgCacheEntry = {
    orgId,
    role,
    expiresAt: Date.now() + ORG_CACHE_TTL_MS,
  };
  orgCache.set(email, entry);
  return entry;
}

// ─── Middleware ──────────────────────────────────────────────────
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // 1. Validate better-auth session
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });

  if (!session) {
    return reply.status(401).send({
      data: null,
      error: "Ah ah ah, you didn't say the magic word!",
    });
  }

  const email = session.user.email;

  // 2. Resolve org context (cached or from DB)
  let orgEntry = getCachedOrg(email);

  if (!orgEntry) {
    try {
      // Use SECURITY DEFINER function to bypass RLS — org context isn't set yet
      const rows = await sql`
        SELECT * FROM lookup_user_org(${email})
      `;

      const row = rows[0] as
        | { organization_id: string; role: string }
        | undefined;
      if (!row) {
        return reply.status(403).send({
          data: null,
          error: "User not associated with any organization",
        });
      }

      orgEntry = setCachedOrg(email, row.organization_id, row.role);
    } catch (error) {
      request.log.error(error, "Failed to resolve org context");
      return reply.status(500).send({
        data: null,
        error: "Internal server error",
      });
    }
  }

  // 3. Set Postgres session variable for RLS / query filtering
  try {
    await sql`SELECT set_config('app.current_org_id', ${orgEntry.orgId}, false)`;
  } catch (error) {
    request.log.error(error, "Failed to set org session variable");
    return reply.status(500).send({
      data: null,
      error: "Internal server error",
    });
  }

  // 4. Attach session + org to request
  request.tigSession = {
    ...session,
    org: { id: orgEntry.orgId, role: orgEntry.role },
  };
}

// ─── Admin guard ─────────────────────────────────────────────────
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // requireAuth must run first to populate tigSession
  await requireAuth(request, reply);
  if (reply.sent) return;

  if (request.tigSession?.org.role !== "admin") {
    return reply.status(403).send({
      data: null,
      error: "Admin access required",
    });
  }
}

// ─── Type augmentation ──────────────────────────────────────────
declare module "fastify" {
  interface FastifyRequest {
    tigSession?: {
      session: {
        id: string;
        userId: string;
        expiresAt: Date;
      };
      user: {
        id: string;
        email: string;
        name: string;
      };
      org: {
        id: string;
        role: string;
      };
    };
  }
}
