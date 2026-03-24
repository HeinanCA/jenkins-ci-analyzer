import type { Task } from 'graphile-worker';
import { sql } from 'drizzle-orm';
import { db } from '../db/connection';
import { aiHealthChecks } from '../db/schema';
import Anthropic from '@anthropic-ai/sdk';
import { AnthropicBedrock } from '@anthropic-ai/bedrock-sdk';

// Frozen constant — never include dynamic content. See security review.
const HEALTH_CHECK_PROMPT = 'respond with OK' as const;

function sanitizeAwsError(error: unknown): string {
  if (!(error instanceof Error)) return 'AI service unavailable';
  const msg = error.message;

  if (msg.includes('ExpiredToken') || msg.includes('expired'))
    return 'AI service authentication expired';
  if (msg.includes('AccessDenied') || msg.includes('not authorized'))
    return 'AI service authorization failed';
  if (msg.includes('Throttl') || msg.includes('rate'))
    return 'AI service rate limited';
  if (msg.includes('Could not load credentials'))
    return 'AI service credentials not configured';
  if (msg.includes('security token') && msg.includes('invalid'))
    return 'AI service authentication expired';

  return 'AI service unavailable';
}

function createClient(): Anthropic | AnthropicBedrock | null {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (apiKey) return new Anthropic({ apiKey });

  const awsRegion =
    process.env['AWS_REGION'] ?? process.env['AWS_DEFAULT_REGION'] ?? 'us-east-1';
  if (awsRegion) return new AnthropicBedrock({ awsRegion });

  return null;
}

function getModelId(): string {
  if (process.env['ANTHROPIC_API_KEY']) return 'claude-haiku-4-5-20251001';
  return process.env['BEDROCK_MODEL_ID'] ?? 'us.anthropic.claude-haiku-4-5-20251001-v1:0';
}

export const checkAiHealth: Task = async (_payload, helpers) => {
  const client = createClient();
  if (!client) {
    await db.insert(aiHealthChecks).values({
      status: 'unhealthy',
      errorMessage: 'AI service credentials not configured',
      responseTimeMs: 0,
    });
    helpers.logger.info('AI health check: no credentials configured');
    return;
  }

  const start = Date.now();
  try {
    await client.messages.create({
      model: getModelId(),
      max_tokens: 10,
      messages: [{ role: 'user', content: HEALTH_CHECK_PROMPT }],
    });

    const responseTimeMs = Date.now() - start;

    await db.insert(aiHealthChecks).values({
      status: 'healthy',
      errorMessage: null,
      responseTimeMs,
    });

    helpers.logger.info(`AI health check: healthy (${responseTimeMs}ms)`);
  } catch (error) {
    const responseTimeMs = Date.now() - start;
    const sanitized = sanitizeAwsError(error);

    await db.insert(aiHealthChecks).values({
      status: 'unhealthy',
      errorMessage: sanitized,
      responseTimeMs,
    });

    // Log the real error server-side only
    helpers.logger.error(
      `AI health check: unhealthy — ${error instanceof Error ? error.message : 'unknown'}`,
    );
  }

  // Retention: delete rows older than 7 days
  await db.execute(
    sql`DELETE FROM ai_health_checks WHERE checked_at < NOW() - INTERVAL '7 days'`,
  );
};
