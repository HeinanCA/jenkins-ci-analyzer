/**
 * Jenkins user cache: fetch + upsert logic shared between
 * the sync-builds lazy hook and the backfill worker task.
 */
import { eq, and, sql, gt } from "drizzle-orm";
import { jenkinsUsers } from "../db/schema";
import { jenkinsGet, JenkinsApiError } from "./jenkins-client";
import {
  parseJenkinsUserResponse,
  type JenkinsUserApiResponse,
} from "./jenkins-user-parser";
import type { PlainCredentials } from "./credential-vault";
import type { Database } from "../db/connection";

/** 7-day staleness threshold for cache entries */
const CACHE_TTL_DAYS = 7;

export interface JenkinsUserCacheDeps {
  readonly db: Database;
  readonly baseUrl: string;
  readonly credentials: PlainCredentials;
  readonly ciInstanceId: string;
  readonly organizationId: string;
  readonly logger: { warn: (msg: string) => void };
}

/**
 * Returns true if the cache already has a fresh entry for this user
 * (fetched within the last 7 days).
 */
export async function isCacheFresh(
  db: Database,
  ciInstanceId: string,
  jenkinsUserId: string,
): Promise<boolean> {
  const cutoff = sql`now() - interval '${sql.raw(String(CACHE_TTL_DAYS))} days'`;

  const rows = await db
    .select({ fetchedAt: jenkinsUsers.fetchedAt })
    .from(jenkinsUsers)
    .where(
      and(
        eq(jenkinsUsers.ciInstanceId, ciInstanceId),
        eq(jenkinsUsers.jenkinsUserId, jenkinsUserId),
        gt(jenkinsUsers.fetchedAt, cutoff),
      ),
    )
    .limit(1);

  return rows.length > 0;
}

/**
 * Fetches a Jenkins user from the API and upserts into the cache.
 * On 403/404/network error: upserts with null email/displayName and
 * current fetchedAt so we don't retry every sync cycle.
 */
export async function fetchAndCacheUser(
  deps: JenkinsUserCacheDeps,
  jenkinsUserId: string,
): Promise<void> {
  const { db, baseUrl, credentials, ciInstanceId, organizationId, logger } =
    deps;

  let displayName: string | null = null;
  let email: string | null = null;

  try {
    const normalizedBase = baseUrl.replace(/\/$/, "");
    const url = `${normalizedBase}/user/${encodeURIComponent(jenkinsUserId)}/api/json?tree=fullName,property[address]`;

    const data = await jenkinsGet<JenkinsUserApiResponse>(url, credentials);
    const parsed = parseJenkinsUserResponse(data);
    displayName = parsed.displayName;
    email = parsed.email;
  } catch (error: unknown) {
    if (error instanceof JenkinsApiError) {
      const { statusCode } = error;
      if (statusCode === 403 || statusCode === 404) {
        logger.warn(
          `Jenkins user fetch failed for "${jenkinsUserId}": HTTP ${statusCode} — caching null entry`,
        );
      } else {
        logger.warn(
          `Jenkins user fetch failed for "${jenkinsUserId}": HTTP ${statusCode}`,
        );
      }
    } else {
      logger.warn(
        `Jenkins user fetch failed for "${jenkinsUserId}": network error`,
      );
    }
    // Fall through — upsert with nulls so we don't retry every sync
  }

  await upsertJenkinsUser(db, {
    ciInstanceId,
    jenkinsUserId,
    email,
    displayName,
    organizationId,
  });
}

interface UpsertParams {
  readonly ciInstanceId: string;
  readonly jenkinsUserId: string;
  readonly email: string | null;
  readonly displayName: string | null;
  readonly organizationId: string;
}

async function upsertJenkinsUser(
  db: Database,
  params: UpsertParams,
): Promise<void> {
  await db
    .insert(jenkinsUsers)
    .values({
      ciInstanceId: params.ciInstanceId,
      jenkinsUserId: params.jenkinsUserId,
      email: params.email,
      displayName: params.displayName,
      organizationId: params.organizationId,
      fetchedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [jenkinsUsers.ciInstanceId, jenkinsUsers.jenkinsUserId],
      set: {
        email: sql`excluded.email`,
        displayName: sql`excluded.display_name`,
        fetchedAt: sql`now()`,
      },
    });
}
