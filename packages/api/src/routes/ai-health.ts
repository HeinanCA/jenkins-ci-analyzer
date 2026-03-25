import type { FastifyInstance } from "fastify";
import { desc } from "drizzle-orm";
import { db } from "../db/connection";
import { aiHealthChecks } from "../db/schema";
import { requireAuth } from "../middleware/auth";

const HEALTH_CHECK_INTERVAL_MS = Number(
  process.env["AI_HEALTH_CHECK_INTERVAL_MS"] ?? 300_000,
);

// In-memory cache — health status changes at most every 5 min,
// no reason to hit DB on every request. Prevents DoS.
let cachedResponse: { data: unknown; cachedAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

export async function aiHealthRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/api/v1/ai/health", async () => {
    // Serve from cache if fresh
    if (cachedResponse && Date.now() - cachedResponse.cachedAt < CACHE_TTL_MS) {
      return cachedResponse.data;
    }

    const [latest] = await db
      .select({
        status: aiHealthChecks.status,
        responseTimeMs: aiHealthChecks.responseTimeMs,
        checkedAt: aiHealthChecks.checkedAt,
      })
      .from(aiHealthChecks)
      .orderBy(desc(aiHealthChecks.checkedAt))
      .limit(1);

    let response;

    if (!latest) {
      // No health checks yet — cold start
      response = {
        data: {
          status: "unknown",
          message: "No health checks recorded yet. Waiting for first check.",
          lastCheckedAt: null,
          responseTimeMs: null,
        },
        error: null,
      };
    } else {
      // Staleness check: if latest is older than 2× interval, report unknown
      const age = Date.now() - new Date(latest.checkedAt).getTime();
      const isStale = age > HEALTH_CHECK_INTERVAL_MS * 2;

      // Only expose sanitized status messages — never raw error details
      const sanitizedMessage = isStale
        ? "Health check data is stale. The worker may not be running."
        : latest.status === "healthy"
          ? null
          : "AI service is currently unavailable.";

      response = {
        data: {
          status: isStale ? "unknown" : latest.status,
          message: sanitizedMessage,
          lastCheckedAt: latest.checkedAt,
          responseTimeMs: latest.responseTimeMs,
        },
        error: null,
      };
    }

    // Cache the response
    cachedResponse = { data: response, cachedAt: Date.now() };

    return response;
  });
}
