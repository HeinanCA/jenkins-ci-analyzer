import Fastify from "fastify";
import cors from "@fastify/cors";
import { auth } from "./auth";
import { toNodeHandler } from "better-auth/node";
import { organizationRoutes } from "./routes/organizations";
import { instanceRoutes } from "./routes/instances";
import { jobRoutes } from "./routes/jobs";
import { dashboardRoutes } from "./routes/dashboard";
import { teamRoutes } from "./routes/teams";
import { trendsRoutes } from "./routes/trends";
import { aiHealthRoutes } from "./routes/ai-health";
import http from "node:http";

const PORT = Number(process.env["PORT"] ?? 3000);
const HOST = process.env["HOST"] ?? "0.0.0.0";
const ALLOWED_ORIGINS = (
  process.env["CORS_ORIGINS"] ?? "http://localhost:8090,http://localhost:5173"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Simple in-memory rate limiter for auth endpoints
const authAttempts = new Map<string, { count: number; resetAt: number }>();
const AUTH_RATE_LIMIT = 10; // max attempts per window
const AUTH_RATE_WINDOW = 15 * 60 * 1000; // 15 minutes

function isAuthRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = authAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    authAttempts.set(ip, { count: 1, resetAt: now + AUTH_RATE_WINDOW });
    return false;
  }
  // Create new entry instead of mutating
  const newCount = entry.count + 1;
  authAttempts.set(ip, { count: newCount, resetAt: entry.resetAt });
  return newCount > AUTH_RATE_LIMIT;
}

// Periodic cleanup of expired rate limit entries to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of authAttempts) {
    if (now > entry.resetAt) {
      authAttempts.delete(ip);
    }
  }
}, AUTH_RATE_WINDOW);

const app = Fastify({
  logger: true,
  serverFactory: (handler) => {
    const authHandler = toNodeHandler(auth);

    return http.createServer((req, res) => {
      // Block sign-up entirely — invitation-only
      const pathname = (req.url ?? "").split("?")[0];
      if (pathname.includes("/sign-up")) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ error: "Sign-up is disabled. Contact your admin." }),
        );
        return;
      }

      // Route /api/auth/* to better-auth directly (bypasses Fastify)
      if (req.url?.startsWith("/api/auth")) {
        const origin = req.headers.origin ?? "";
        if (!ALLOWED_ORIGINS.includes(origin)) {
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Origin not allowed" }));
          return;
        }
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization",
        );
        res.setHeader("Access-Control-Allow-Credentials", "true");
        if (req.method === "OPTIONS") {
          res.writeHead(204);
          res.end();
          return;
        }
        // Rate limit login/signup
        if (req.url.includes("sign-in") || req.url.includes("sign-up")) {
          const ip =
            req.headers["x-forwarded-for"]?.toString().split(",")[0] ??
            req.socket.remoteAddress ??
            "unknown";
          if (isAuthRateLimited(ip)) {
            res.writeHead(429, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({ error: "Too many attempts. Try again later." }),
            );
            return;
          }
        }
        authHandler(req, res);
        return;
      }
      // Everything else goes to Fastify
      handler(req, res);
    });
  },
});

await app.register(cors, {
  origin: (origin, cb) => {
    // Allow requests with no Origin (server-to-server, nginx proxy)
    // Allow requests from configured origins
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      cb(null, true);
    } else {
      // Log rejected origins for debugging, but still reject
      console.warn(
        `CORS rejected origin: ${origin} (allowed: ${ALLOWED_ORIGINS.join(", ")})`,
      );
      cb(null, false);
    }
  },
  credentials: true,
});

// Security headers
app.addHook("onSend", async (_request, reply) => {
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("X-Frame-Options", "DENY");
  reply.header("X-XSS-Protection", "0");
  reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
  reply.header(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );
  reply.header("Cache-Control", "no-store");
});

// Global error handler — never leak stack traces or internal details
app.setErrorHandler(
  async (error: Error & { statusCode?: number }, _request, reply) => {
    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 500) {
      app.log.error(error);
      return reply.status(500).send({
        data: null,
        error: "Internal server error",
      });
    }
    return reply.status(statusCode).send({
      data: null,
      error: error.message ?? "Request error",
    });
  },
);

// Routes
await app.register(organizationRoutes);
await app.register(instanceRoutes);
await app.register(jobRoutes);
await app.register(dashboardRoutes);
await app.register(teamRoutes);
await app.register(trendsRoutes);
await app.register(aiHealthRoutes);

// Health
app.get("/health", async () => ({
  status: "ok",
  service: "tig-api",
  timestamp: new Date().toISOString(),
}));

app.get("/api/v1/status", async () => ({
  data: {
    version: "0.1.0",
    service: "tig-api",
  },
  error: null,
}));

try {
  await app.listen({ port: PORT, host: HOST });
  console.log(`TIG API running on ${HOST}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
