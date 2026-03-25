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
).split(",");

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
  entry.count++;
  return entry.count > AUTH_RATE_LIMIT;
}

const app = Fastify({
  logger: true,
  serverFactory: (handler) => {
    const authHandler = toNodeHandler(auth);

    return http.createServer((req, res) => {
      // Route /api/auth/* to better-auth directly (bypasses Fastify)
      if (req.url?.startsWith("/api/auth")) {
        const origin = req.headers.origin ?? "";
        const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
          ? origin
          : ALLOWED_ORIGINS[0];
        res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
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
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error("CORS not allowed"), false);
    }
  },
  credentials: true,
});

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
