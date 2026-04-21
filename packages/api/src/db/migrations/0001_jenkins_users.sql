-- Migration: Add jenkins_users table (Phase 1 — "Mine first" foundation)
-- Additive only — safe on fresh DB and production schema.

CREATE TABLE IF NOT EXISTS "jenkins_users" (
  "ci_instance_id" uuid NOT NULL REFERENCES "ci_instances"("id"),
  "jenkins_user_id" text NOT NULL,
  "email" text,
  "display_name" text,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "fetched_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("ci_instance_id", "jenkins_user_id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "jenkins_users_org_email_idx"
  ON "jenkins_users" ("organization_id", lower("email"));
CREATE INDEX IF NOT EXISTS "jenkins_users_org_id_idx"
  ON "jenkins_users" ("organization_id");

-- RLS: match existing pattern (13th RLS-enabled table)
ALTER TABLE "jenkins_users" OWNER TO pulsci_admin;
ALTER TABLE "jenkins_users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "jenkins_users" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "jenkins_users";
CREATE POLICY tenant_isolation ON "jenkins_users"
  USING ("organization_id" = current_setting('app.current_org_id', true)::uuid);

DROP POLICY IF EXISTS tenant_insert ON "jenkins_users";
CREATE POLICY tenant_insert ON "jenkins_users"
  FOR INSERT WITH CHECK ("organization_id" = current_setting('app.current_org_id', true)::uuid);

-- Grant app role access
GRANT SELECT, INSERT, UPDATE, DELETE ON "jenkins_users" TO pulsci_app;
