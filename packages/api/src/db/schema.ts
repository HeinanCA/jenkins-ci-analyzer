import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  real,
  timestamp,
  jsonb,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";

// ─── better-auth managed tables ─────────────────────────────────

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt"),
  updatedAt: timestamp("updatedAt"),
});

// ─── Application tables ─────────────────────────────────────────

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    role: text("role", { enum: ["admin", "member", "viewer"] })
      .notNull()
      .default("viewer"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("users_org_email_idx").on(table.organizationId, table.email),
  ],
);

export const ciInstances = pgTable(
  "ci_instances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    name: text("name").notNull(),
    provider: text("provider").notNull().default("jenkins"),
    baseUrl: text("base_url").notNull(),
    credentials: jsonb("credentials").notNull(),
    crawlConfig: jsonb("crawl_config").notNull().default({}),
    isActive: boolean("is_active").default(true).notNull(),
    lastCrawlAt: timestamp("last_crawl_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("ci_instances_org_url_idx").on(
      table.organizationId,
      table.baseUrl,
    ),
  ],
);

export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  ciInstanceId: uuid("ci_instance_id")
    .references(() => ciInstances.id)
    .notNull(),
  name: text("name").notNull(),
  folderPatterns: text("folder_patterns").array().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const teamMembers = pgTable(
  "team_members",
  {
    teamId: uuid("team_id")
      .references(() => teams.id)
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.teamId, table.userId] })],
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ciInstanceId: uuid("ci_instance_id")
      .references(() => ciInstances.id)
      .notNull(),
    fullPath: text("full_path").notNull(),
    name: text("name").notNull(),
    url: text("url").notNull(),
    jobClass: text("job_class"),
    color: text("color"),
    healthScore: integer("health_score"),
    isActive: boolean("is_active").default(true).notNull(),
    discoveredAt: timestamp("discovered_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("jobs_instance_path_idx").on(
      table.ciInstanceId,
      table.fullPath,
    ),
  ],
);

export const builds = pgTable(
  "builds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .references(() => jobs.id)
      .notNull(),
    buildNumber: integer("build_number").notNull(),
    result: text("result"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    durationMs: integer("duration_ms"),
    estimatedDurationMs: integer("estimated_duration_ms"),
    logFetched: boolean("log_fetched").default(false).notNull(),
    logSizeBytes: integer("log_size_bytes"),
    gitSha: text("git_sha"),
    gitRemoteUrl: text("git_remote_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("builds_job_number_idx").on(table.jobId, table.buildNumber),
  ],
);

export const buildAnalyses = pgTable("build_analyses", {
  id: uuid("id").defaultRandom().primaryKey(),
  buildId: uuid("build_id")
    .references(() => builds.id)
    .notNull()
    .unique(),
  classification: text("classification", {
    enum: ["infrastructure", "code", "unknown"],
  }),
  confidence: real("confidence"),
  matches: jsonb("matches").notNull().default([]),
  aiSummary: text("ai_summary"),
  aiRootCause: text("ai_root_cause"),
  aiSuggestedFixes: jsonb("ai_suggested_fixes"),
  aiSkippedReason: text("ai_skipped_reason", {
    enum: ["budget_exhausted", "high_confidence_match", "disabled"],
  }),
  aiInputTokens: integer("ai_input_tokens"),
  aiOutputTokens: integer("ai_output_tokens"),
  aiCostUsd: real("ai_cost_usd"),
  logNoisePercent: integer("log_noise_percent"),
  logTopNoise: text("log_top_noise"),
  analyzedAt: timestamp("analyzed_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const healthSnapshots = pgTable("health_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  ciInstanceId: uuid("ci_instance_id")
    .references(() => ciInstances.id)
    .notNull(),
  level: text("level").notNull(),
  score: integer("score").notNull(),
  agentsOnline: integer("agents_online").notNull(),
  agentsTotal: integer("agents_total").notNull(),
  executorsBusy: integer("executors_busy").notNull(),
  executorsTotal: integer("executors_total").notNull(),
  queueDepth: integer("queue_depth").notNull(),
  stuckBuilds: integer("stuck_builds").notNull(),
  issues: jsonb("issues").notNull().default([]),
  recordedAt: timestamp("recorded_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const alertRules = pgTable("alert_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  name: text("name").notNull(),
  condition: jsonb("condition").notNull(),
  channels: jsonb("channels").notNull(),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const alertEvents = pgTable("alert_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  alertRuleId: uuid("alert_rule_id")
    .references(() => alertRules.id)
    .notNull(),
  triggeredAt: timestamp("triggered_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  payload: jsonb("payload").notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const patternCandidates = pgTable("pattern_candidates", {
  id: uuid("id").defaultRandom().primaryKey(),
  ciInstanceId: uuid("ci_instance_id")
    .references(() => ciInstances.id)
    .notNull(),
  buildAnalysisId: uuid("build_analysis_id")
    .references(() => buildAnalyses.id)
    .notNull(),
  proposedName: text("proposed_name").notNull(),
  proposedCategory: text("proposed_category").notNull(),
  proposedPatterns: jsonb("proposed_patterns").notNull(),
  aiConfidence: real("ai_confidence"),
  flaggedBy: uuid("flagged_by").references(() => users.id),
  flaggedAt: timestamp("flagged_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  status: text("status", { enum: ["pending", "promoted", "rejected"] })
    .notNull()
    .default("pending"),
  promotedAt: timestamp("promoted_at", { withTimezone: true }),
  promotedBy: uuid("promoted_by").references(() => users.id),
});
