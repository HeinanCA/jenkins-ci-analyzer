import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection';
import { ciInstances } from '../db/schema';
import {
  encryptCredentials,
  decryptCredentials,
  type EncryptedCredentials,
} from '../services/credential-vault';
import {
  testJenkinsConnection,
  jenkinsGet,
  jenkinsGetText,
} from '../services/jenkins-client';

export async function instanceRoutes(app: FastifyInstance) {
  // List all instances
  app.get('/api/v1/instances', async () => {
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
      .from(ciInstances);

    return { data: instances, error: null };
  });

  // Get single instance
  app.get<{ Params: { id: string } }>(
    '/api/v1/instances/:id',
    async (request, reply) => {
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
        .where(eq(ciInstances.id, request.params.id))
        .limit(1);

      if (instance.length === 0) {
        return reply.status(404).send({
          data: null,
          error: 'Instance not found',
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
      organizationId: string;
    };
  }>('/api/v1/instances', async (request, reply) => {
    const { name, baseUrl, username, token, organizationId } = request.body;

    if (!name || !baseUrl || !username || !token || !organizationId) {
      return reply.status(400).send({
        data: null,
        error: 'Missing required fields: name, baseUrl, username, token, organizationId',
      });
    }

    const normalizedUrl = baseUrl.replace(/\/$/, '');
    const encrypted = encryptCredentials({ username, token });

    const [created] = await db
      .insert(ciInstances)
      .values({
        name,
        baseUrl: normalizedUrl,
        organizationId,
        credentials: encrypted,
      })
      .returning({
        id: ciInstances.id,
        name: ciInstances.name,
        baseUrl: ciInstances.baseUrl,
        createdAt: ciInstances.createdAt,
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
  }>('/api/v1/instances/:id', async (request, reply) => {
    const { id } = request.params;
    const { name, baseUrl, username, token, isActive, crawlConfig } =
      request.body;

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates['name'] = name;
    if (baseUrl !== undefined) updates['baseUrl'] = baseUrl.replace(/\/$/, '');
    if (isActive !== undefined) updates['isActive'] = isActive;
    if (crawlConfig !== undefined) updates['crawlConfig'] = crawlConfig;

    if (username !== undefined && token !== undefined) {
      updates['credentials'] = encryptCredentials({ username, token });
    }

    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({
        data: null,
        error: 'No fields to update',
      });
    }

    const [updated] = await db
      .update(ciInstances)
      .set(updates)
      .where(eq(ciInstances.id, id))
      .returning({
        id: ciInstances.id,
        name: ciInstances.name,
        baseUrl: ciInstances.baseUrl,
        isActive: ciInstances.isActive,
      });

    if (!updated) {
      return reply.status(404).send({ data: null, error: 'Instance not found' });
    }

    return { data: updated, error: null };
  });

  // Delete instance
  app.delete<{ Params: { id: string } }>(
    '/api/v1/instances/:id',
    async (request, reply) => {
      const [deleted] = await db
        .delete(ciInstances)
        .where(eq(ciInstances.id, request.params.id))
        .returning({ id: ciInstances.id });

      if (!deleted) {
        return reply.status(404).send({ data: null, error: 'Instance not found' });
      }

      return { data: { id: deleted.id }, error: null };
    },
  );

  // Test connection
  app.post<{ Params: { id: string } }>(
    '/api/v1/instances/:id/test',
    async (request, reply) => {
      const [instance] = await db
        .select({
          baseUrl: ciInstances.baseUrl,
          credentials: ciInstances.credentials,
        })
        .from(ciInstances)
        .where(eq(ciInstances.id, request.params.id))
        .limit(1);

      if (!instance) {
        return reply.status(404).send({ data: null, error: 'Instance not found' });
      }

      const credentials = decryptCredentials(
        instance.credentials as EncryptedCredentials,
      );
      const result = await testJenkinsConnection(instance.baseUrl, credentials);

      return { data: result, error: null };
    },
  );

  // Proxy Jenkins API — JSON
  app.get<{ Params: { id: string; '*': string } }>(
    '/api/v1/instances/:id/proxy/*',
    async (request, reply) => {
      const [instance] = await db
        .select({
          baseUrl: ciInstances.baseUrl,
          credentials: ciInstances.credentials,
        })
        .from(ciInstances)
        .where(eq(ciInstances.id, request.params.id))
        .limit(1);

      if (!instance) {
        return reply.status(404).send({ data: null, error: 'Instance not found' });
      }

      const credentials = decryptCredentials(
        instance.credentials as EncryptedCredentials,
      );
      const jenkinsPath = request.params['*'];
      const queryString = request.url.includes('?')
        ? request.url.slice(request.url.indexOf('?'))
        : '';
      const url = `${instance.baseUrl}/${jenkinsPath}${queryString}`;

      try {
        if (jenkinsPath.endsWith('consoleText')) {
          const text = await jenkinsGetText(url, credentials);
          return reply.type('text/plain').send(text);
        }
        const data = await jenkinsGet(url, credentials);
        return { data, error: null };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Jenkins proxy error';
        return reply.status(502).send({ data: null, error: message });
      }
    },
  );
}
