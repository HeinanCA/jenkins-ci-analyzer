import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { lookup } from "node:dns/promises";
import { db } from "../db/connection";
import { ciInstances } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import {
  encryptCredentials,
  decryptCredentials,
  type EncryptedCredentials,
} from "../services/credential-vault";
import {
  testJenkinsConnection,
  jenkinsGet,
  jenkinsGetText,
} from "../services/jenkins-client";
import { logAudit } from "../services/audit";

const MAX_NAME_LENGTH = 200;
const MAX_URL_LENGTH = 2048;
const MAX_TOKEN_LENGTH = 500;
const MAX_USERNAME_LENGTH = 200;

function isPrivateIp(ip: string): boolean {
  // IPv4 private/reserved ranges
  if (
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("127.") ||
    ip.startsWith("0.") ||
    ip.startsWith("169.254.") ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1"
  ) {
    return true;
  }
  // 172.16.0.0/12
  const match = ip.match(/^172\.(\d+)\./);
  if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) {
    return true;
  }
  return false;
}

async function validateBaseUrl(
  url: string,
): Promise<{ valid: true } | { valid: false; error: string }> {
  try {
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol)) {
      return { valid: false, error: "baseUrl must use http or https" };
    }
    const hostname = parsed.hostname.toLowerCase();
    // Block obviously internal hostnames
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "[::1]" ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".local")
    ) {
      return {
        valid: false,
        error: "baseUrl cannot point to internal or metadata addresses",
      };
    }
    // Check if hostname statically looks like a private IP
    if (isPrivateIp(hostname)) {
      return {
        valid: false,
        error: "baseUrl cannot point to internal or metadata addresses",
      };
    }
    // DNS resolution check — hostname may resolve to internal IP
    try {
      const { address } = await lookup(hostname);
      if (isPrivateIp(address)) {
        return {
          valid: false,
          error: "baseUrl resolves to an internal address",
        };
      }
    } catch {
      return { valid: false, error: "baseUrl hostname could not be resolved" };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "baseUrl is not a valid URL" };
  }
}

export async function instanceRoutes(app: FastifyInstance) {
  // All instance routes require auth
  app.addHook("preHandler", requireAuth);

  // List all instances
  app.get("/api/v1/instances", async (request) => {
    const orgId = request.tigSession!.org.id;

    const instances = await db
      .select({
        id: ciInstances.id,
        name: ciInstances.name,
        provider: ciInstances.provider,
        baseUrl: ciInstances.baseUrl,
        isActive: ciInstances.isActive,
        lastCrawlAt: ciInstances.lastCrawlAt,
        createdAt: ciInstances.createdAt,
      })
      .from(ciInstances)
      .where(eq(ciInstances.organizationId, orgId));

    return { data: instances, error: null };
  });

  // Get single instance
  app.get<{ Params: { id: string } }>(
    "/api/v1/instances/:id",
    async (request, reply) => {
      const orgId = request.tigSession!.org.id;

      const instance = await db
        .select({
          id: ciInstances.id,
          name: ciInstances.name,
          provider: ciInstances.provider,
          baseUrl: ciInstances.baseUrl,
          isActive: ciInstances.isActive,
          crawlConfig: ciInstances.crawlConfig,
          lastCrawlAt: ciInstances.lastCrawlAt,
          createdAt: ciInstances.createdAt,
        })
        .from(ciInstances)
        .where(
          and(
            eq(ciInstances.id, request.params.id),
            eq(ciInstances.organizationId, orgId),
          ),
        )
        .limit(1);

      if (instance.length === 0) {
        return reply.status(404).send({
          data: null,
          error: "Instance not found",
        });
      }

      return { data: instance[0], error: null };
    },
  );

  // Create instance
  app.post<{
    Body: {
      name: string;
      baseUrl: string;
      username: string;
      token: string;
    };
  }>("/api/v1/instances", async (request, reply) => {
    const orgId = request.tigSession!.org.id;
    const { name, baseUrl, username, token } = request.body;

    if (!name || !baseUrl || !username || !token) {
      return reply.status(400).send({
        data: null,
        error: "Missing required fields: name, baseUrl, username, token",
      });
    }

    // Input length validation
    if (
      name.length > MAX_NAME_LENGTH ||
      baseUrl.length > MAX_URL_LENGTH ||
      username.length > MAX_USERNAME_LENGTH ||
      token.length > MAX_TOKEN_LENGTH
    ) {
      return reply.status(400).send({
        data: null,
        error: "One or more fields exceed maximum allowed length",
      });
    }

    const normalizedUrl = baseUrl.replace(/\/$/, "");

    // SSRF protection: validate baseUrl including DNS resolution check
    const urlCheck = await validateBaseUrl(normalizedUrl);
    if (!urlCheck.valid) {
      return reply.status(400).send({ data: null, error: urlCheck.error });
    }

    const encrypted = encryptCredentials({ username, token });

    const [created] = await db
      .insert(ciInstances)
      .values({
        name,
        baseUrl: normalizedUrl,
        organizationId: orgId,
        credentials: encrypted,
      })
      .returning({
        id: ciInstances.id,
        name: ciInstances.name,
        baseUrl: ciInstances.baseUrl,
        createdAt: ciInstances.createdAt,
      });

    await logAudit({
      organizationId: orgId,
      actorUserId: request.tigSession!.user.id,
      actorEmail: request.tigSession!.user.email,
      action: "instance.created",
      targetType: "ci_instance",
      targetId: created.id,
      metadata: { name, baseUrl: normalizedUrl },
    });

    return reply.status(201).send({ data: created, error: null });
  });

  // Update instance
  app.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      baseUrl?: string;
      username?: string;
      token?: string;
      isActive?: boolean;
      crawlConfig?: Record<string, unknown>;
    };
  }>("/api/v1/instances/:id", async (request, reply) => {
    const orgId = request.tigSession!.org.id;
    const { id } = request.params;
    const { name, baseUrl, username, token, isActive, crawlConfig } =
      request.body;

    // Input length validation
    if (
      (name !== undefined && name.length > MAX_NAME_LENGTH) ||
      (baseUrl !== undefined && baseUrl.length > MAX_URL_LENGTH) ||
      (username !== undefined && username.length > MAX_USERNAME_LENGTH) ||
      (token !== undefined && token.length > MAX_TOKEN_LENGTH)
    ) {
      return reply.status(400).send({
        data: null,
        error: "One or more fields exceed maximum allowed length",
      });
    }

    // SSRF protection on baseUrl update
    if (baseUrl !== undefined) {
      const urlCheck = await validateBaseUrl(baseUrl.replace(/\/$/, ""));
      if (!urlCheck.valid) {
        return reply.status(400).send({ data: null, error: urlCheck.error });
      }
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates["name"] = name;
    if (baseUrl !== undefined) updates["baseUrl"] = baseUrl.replace(/\/$/, "");
    if (isActive !== undefined) updates["isActive"] = isActive;
    if (crawlConfig !== undefined) updates["crawlConfig"] = crawlConfig;

    if (username !== undefined && token !== undefined) {
      updates["credentials"] = encryptCredentials({ username, token });
    }

    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({
        data: null,
        error: "No fields to update",
      });
    }

    const [updated] = await db
      .update(ciInstances)
      .set(updates)
      .where(and(eq(ciInstances.id, id), eq(ciInstances.organizationId, orgId)))
      .returning({
        id: ciInstances.id,
        name: ciInstances.name,
        baseUrl: ciInstances.baseUrl,
        isActive: ciInstances.isActive,
      });

    if (!updated) {
      return reply
        .status(404)
        .send({ data: null, error: "Instance not found" });
    }

    const changedFields = Object.keys(updates).filter(
      (k) => k !== "credentials",
    );
    await logAudit({
      organizationId: orgId,
      actorUserId: request.tigSession!.user.id,
      actorEmail: request.tigSession!.user.email,
      action: "instance.updated",
      targetType: "ci_instance",
      targetId: id,
      metadata: { fieldsChanged: changedFields },
    });

    return { data: updated, error: null };
  });

  // Delete instance
  app.delete<{ Params: { id: string } }>(
    "/api/v1/instances/:id",
    async (request, reply) => {
      const orgId = request.tigSession!.org.id;

      const [deleted] = await db
        .delete(ciInstances)
        .where(
          and(
            eq(ciInstances.id, request.params.id),
            eq(ciInstances.organizationId, orgId),
          ),
        )
        .returning({ id: ciInstances.id, name: ciInstances.name });

      if (!deleted) {
        return reply
          .status(404)
          .send({ data: null, error: "Instance not found" });
      }

      await logAudit({
        organizationId: orgId,
        actorUserId: request.tigSession!.user.id,
        actorEmail: request.tigSession!.user.email,
        action: "instance.deleted",
        targetType: "ci_instance",
        targetId: deleted.id,
        metadata: { name: deleted.name },
      });

      return { data: { id: deleted.id }, error: null };
    },
  );

  // Test connection
  app.post<{ Params: { id: string } }>(
    "/api/v1/instances/:id/test",
    async (request, reply) => {
      const orgId = request.tigSession!.org.id;

      const [instance] = await db
        .select({
          baseUrl: ciInstances.baseUrl,
          credentials: ciInstances.credentials,
        })
        .from(ciInstances)
        .where(
          and(
            eq(ciInstances.id, request.params.id),
            eq(ciInstances.organizationId, orgId),
          ),
        )
        .limit(1);

      if (!instance) {
        return reply
          .status(404)
          .send({ data: null, error: "Instance not found" });
      }

      const credentials = decryptCredentials(
        instance.credentials as EncryptedCredentials,
      );
      const result = await testJenkinsConnection(instance.baseUrl, credentials);

      return { data: result, error: null };
    },
  );

  // Proxy Jenkins API — JSON
  app.get<{ Params: { id: string; "*": string } }>(
    "/api/v1/instances/:id/proxy/*",
    async (request, reply) => {
      const orgId = request.tigSession!.org.id;

      const [instance] = await db
        .select({
          baseUrl: ciInstances.baseUrl,
          credentials: ciInstances.credentials,
        })
        .from(ciInstances)
        .where(
          and(
            eq(ciInstances.id, request.params.id),
            eq(ciInstances.organizationId, orgId),
          ),
        )
        .limit(1);

      if (!instance) {
        return reply
          .status(404)
          .send({ data: null, error: "Instance not found" });
      }

      const credentials = decryptCredentials(
        instance.credentials as EncryptedCredentials,
      );
      const jenkinsPath = request.params["*"];

      // Path traversal protection: reject paths with .. or protocol prefixes
      if (
        jenkinsPath.includes("..") ||
        jenkinsPath.startsWith("/") ||
        jenkinsPath.includes("://")
      ) {
        return reply
          .status(400)
          .send({ data: null, error: "Invalid proxy path" });
      }

      // Limit proxy path length
      if (jenkinsPath.length > 2048) {
        return reply
          .status(400)
          .send({ data: null, error: "Proxy path too long" });
      }

      const queryString = request.url.includes("?")
        ? request.url.slice(request.url.indexOf("?"))
        : "";
      const url = `${instance.baseUrl}/${jenkinsPath}${queryString}`;

      // Verify the constructed URL is still under the instance baseUrl
      if (!url.startsWith(instance.baseUrl + "/")) {
        return reply
          .status(400)
          .send({ data: null, error: "Invalid proxy path" });
      }

      try {
        if (jenkinsPath.endsWith("consoleText")) {
          const text = await jenkinsGetText(url, credentials);
          return reply.type("text/plain").send(text);
        }
        const data = await jenkinsGet(url, credentials);
        return { data, error: null };
      } catch {
        return reply
          .status(502)
          .send({ data: null, error: "Failed to proxy request to Jenkins" });
      }
    },
  );
}
