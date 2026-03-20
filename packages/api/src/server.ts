import Fastify from 'fastify';
import cors from '@fastify/cors';
import { auth } from './auth';
import { toNodeHandler } from 'better-auth/node';
import { instanceRoutes } from './routes/instances';

const PORT = Number(process.env['PORT'] ?? 3000);
const HOST = process.env['HOST'] ?? '0.0.0.0';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true, credentials: true });

// Auth
const authHandler = toNodeHandler(auth);
app.all('/api/auth/*', async (request, reply) => {
  await authHandler(request.raw, reply.raw);
});

// Routes
await app.register(instanceRoutes);

// Health
app.get('/health', async () => ({
  status: 'ok',
  service: 'tig-api',
  timestamp: new Date().toISOString(),
}));

app.get('/api/v1/status', async () => ({
  data: {
    version: '0.1.0',
    service: 'tig-api',
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
