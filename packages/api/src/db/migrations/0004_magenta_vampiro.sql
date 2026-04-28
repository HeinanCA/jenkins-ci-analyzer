CREATE TYPE "public"."failure_priority" AS ENUM('BLOCKER', 'ACTIONABLE', 'FLAKY', 'INFRA', 'UNKNOWN');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp,
	"refreshTokenExpiresAt" timestamp,
	"scope" text,
	"password" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_health_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" text NOT NULL,
	"error_message" text,
	"response_time_ms" integer,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analysis_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"build_analysis_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"actor_user_id" text NOT NULL,
	"actor_email" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "failure_views" (
	"user_id" uuid NOT NULL,
	"build_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "failure_views_user_id_build_id_pk" PRIMARY KEY("user_id","build_id")
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"token" text NOT NULL,
	"invited_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "jenkins_users" (
	"ci_instance_id" uuid NOT NULL,
	"jenkins_user_id" text NOT NULL,
	"email" text,
	"display_name" text,
	"organization_id" uuid NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jenkins_users_ci_instance_id_jenkins_user_id_pk" PRIMARY KEY("ci_instance_id","jenkins_user_id")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp,
	"updatedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "alert_events" ADD COLUMN "organization_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "build_analyses" ADD COLUMN "organization_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "build_analyses" ADD COLUMN "ai_input_tokens" integer;--> statement-breakpoint
ALTER TABLE "build_analyses" ADD COLUMN "ai_output_tokens" integer;--> statement-breakpoint
ALTER TABLE "build_analyses" ADD COLUMN "ai_cost_usd" real;--> statement-breakpoint
ALTER TABLE "build_analyses" ADD COLUMN "log_noise_percent" integer;--> statement-breakpoint
ALTER TABLE "build_analyses" ADD COLUMN "log_top_noise" text;--> statement-breakpoint
ALTER TABLE "build_analyses" ADD COLUMN "priority" "failure_priority" DEFAULT 'UNKNOWN' NOT NULL;--> statement-breakpoint
ALTER TABLE "builds" ADD COLUMN "organization_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "builds" ADD COLUMN "git_sha" text;--> statement-breakpoint
ALTER TABLE "builds" ADD COLUMN "git_remote_url" text;--> statement-breakpoint
ALTER TABLE "builds" ADD COLUMN "triggered_by" text;--> statement-breakpoint
ALTER TABLE "builds" ADD COLUMN "culprits" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "health_snapshots" ADD COLUMN "organization_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "organization_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "pattern_candidates" ADD COLUMN "organization_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "team_members" ADD COLUMN "organization_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_feedback" ADD CONSTRAINT "analysis_feedback_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_feedback" ADD CONSTRAINT "analysis_feedback_build_analysis_id_build_analyses_id_fk" FOREIGN KEY ("build_analysis_id") REFERENCES "public"."build_analyses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_feedback" ADD CONSTRAINT "analysis_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "failure_views" ADD CONSTRAINT "failure_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "failure_views" ADD CONSTRAINT "failure_views_build_id_builds_id_fk" FOREIGN KEY ("build_id") REFERENCES "public"."builds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "failure_views" ADD CONSTRAINT "failure_views_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jenkins_users" ADD CONSTRAINT "jenkins_users_ci_instance_id_ci_instances_id_fk" FOREIGN KEY ("ci_instance_id") REFERENCES "public"."ci_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jenkins_users" ADD CONSTRAINT "jenkins_users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "feedback_user_analysis_idx" ON "analysis_feedback" USING btree ("user_id","build_analysis_id");--> statement-breakpoint
CREATE INDEX "audit_events_org_id_idx" ON "audit_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "audit_events_created_at_idx" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "failure_views_org_idx" ON "failure_views" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "jenkins_users_org_email_idx" ON "jenkins_users" USING btree ("organization_id",lower("email"));--> statement-breakpoint
CREATE INDEX "jenkins_users_org_id_idx" ON "jenkins_users" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_analyses" ADD CONSTRAINT "build_analyses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builds" ADD CONSTRAINT "builds_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_snapshots" ADD CONSTRAINT "health_snapshots_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pattern_candidates" ADD CONSTRAINT "pattern_candidates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "builds_org_id_idx" ON "builds" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "builds_started_at_idx" ON "builds" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "jobs_org_id_idx" ON "jobs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "users_org_id_idx" ON "users" USING btree ("organization_id");