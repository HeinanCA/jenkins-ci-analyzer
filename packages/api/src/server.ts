import Fastify from "fastify";
import cors from "@fastify/cors";
import { auth } from "./auth";
import { toNodeHandler } from "better-auth/node";
import { organizationRoutes } from "./routes/organizations";
import { instanceRoutes } from "./routes/instances";
import { jobRoutes } from "./routes/jobs";
import { dashboardRoutes } from "./routes/dashboard";
import http from "node:http";

const PORT = Number(process.env["PORT"] ?? 3000);
const HOST = process.env["HOST"] ?? "0.0.0.0";

const app = Fastify({
  logger: true,
  serverFactory: (handler) => {
    const authHandler = toNodeHandler(auth);

    return http.createServer((req, res) => {
      // Route /api/auth/* to better-auth directly (bypasses Fastify)
      if (req.url?.startsWith("/api/auth")) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader(
          "Access-Control-Allow-Methods",
          "GET, POST, PUT, DELETE, OPTIONS",
        );
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
        authHandler(req, res);
        return;
      }
      // Everything else goes to Fastify
      handler(req, res);
    });
  },
});

await app.register(cors, { origin: true, credentials: true });

// Routes
await app.register(organizationRoutes);
await app.register(instanceRoutes);
await app.register(jobRoutes);
await app.register(dashboardRoutes);

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
