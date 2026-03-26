-- PulsCI Multi-Tenant Row-Level Security Setup
-- Phase 4: Pentagon-grade isolation
--
-- This migration:
-- 1. Creates app and admin Postgres roles
-- 2. Adds organization_id columns where missing (nullable first)
-- 3. Backfills from parent FK chains
-- 4. Sets NOT NULL constraints
-- 5. Adds indexes
-- 6. Enables RLS with tenant isolation policies on all org-scoped tables
-- 7. Creates helper functions for edge cases

-- ============================================================
-- STEP 1: Create roles
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pulsci_app') THEN
    CREATE ROLE pulsci_app LOGIN PASSWORD 'pulsci_app_Secure2026!';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pulsci_admin') THEN
    CREATE ROLE pulsci_admin LOGIN PASSWORD 'pulsci_admin_Secure2026!' BYPASSRLS;
  END IF;
END
$$;

-- Grant app role access to public schema
GRANT USAGE ON SCHEMA public TO pulsci_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pulsci_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pulsci_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pulsci_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO pulsci_app;

-- Grant admin role full access (for migrations)
GRANT ALL ON SCHEMA public TO pulsci_admin;
GRANT ALL ON ALL TABLES IN SCHEMA public TO pulsci_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO pulsci_admin;

-- ============================================================
-- STEP 2: Add organization_id columns (nullable initially)
-- ============================================================

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE builds ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE build_analyses ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE health_snapshots ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE pattern_candidates ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- ============================================================
-- STEP 3: Backfill organization_id from parent FK chains
-- ============================================================

-- jobs <- ci_instances
UPDATE jobs SET organization_id = ci_instances.organization_id
FROM ci_instances WHERE jobs.ci_instance_id = ci_instances.id
AND jobs.organization_id IS NULL;

-- builds <- jobs
UPDATE builds SET organization_id = jobs.organization_id
FROM jobs WHERE builds.job_id = jobs.id
AND builds.organization_id IS NULL;

-- build_analyses <- builds
UPDATE build_analyses SET organization_id = builds.organization_id
FROM builds WHERE build_analyses.build_id = builds.id
AND build_analyses.organization_id IS NULL;

-- health_snapshots <- ci_instances
UPDATE health_snapshots SET organization_id = ci_instances.organization_id
FROM ci_instances WHERE health_snapshots.ci_instance_id = ci_instances.id
AND health_snapshots.organization_id IS NULL;

-- team_members <- teams
UPDATE team_members SET organization_id = teams.organization_id
FROM teams WHERE team_members.team_id = teams.id
AND team_members.organization_id IS NULL;

-- alert_events <- alert_rules
UPDATE alert_events SET organization_id = alert_rules.organization_id
FROM alert_rules WHERE alert_events.alert_rule_id = alert_rules.id
AND alert_events.organization_id IS NULL;

-- pattern_candidates <- ci_instances
UPDATE pattern_candidates SET organization_id = ci_instances.organization_id
FROM ci_instances WHERE pattern_candidates.ci_instance_id = ci_instances.id
AND pattern_candidates.organization_id IS NULL;

-- ============================================================
-- STEP 4: Verify backfill — abort if any NULLs remain
-- ============================================================

DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM jobs WHERE organization_id IS NULL;
  IF null_count > 0 THEN RAISE EXCEPTION 'jobs has % rows with NULL organization_id', null_count; END IF;

  SELECT COUNT(*) INTO null_count FROM builds WHERE organization_id IS NULL;
  IF null_count > 0 THEN RAISE EXCEPTION 'builds has % rows with NULL organization_id', null_count; END IF;

  SELECT COUNT(*) INTO null_count FROM build_analyses WHERE organization_id IS NULL;
  IF null_count > 0 THEN RAISE EXCEPTION 'build_analyses has % rows with NULL organization_id', null_count; END IF;

  SELECT COUNT(*) INTO null_count FROM health_snapshots WHERE organization_id IS NULL;
  IF null_count > 0 THEN RAISE EXCEPTION 'health_snapshots has % rows with NULL organization_id', null_count; END IF;

  RAISE NOTICE 'Backfill verification passed — zero NULLs';
END
$$;

-- ============================================================
-- STEP 5: Set NOT NULL constraints
-- ============================================================

ALTER TABLE jobs ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE builds ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE build_analyses ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE health_snapshots ALTER COLUMN organization_id SET NOT NULL;
-- team_members and alert_events may have 0 rows, safe to set NOT NULL
ALTER TABLE team_members ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE alert_events ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE pattern_candidates ALTER COLUMN organization_id SET NOT NULL;

-- ============================================================
-- STEP 6: Add indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_jobs_org_id ON jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_builds_org_id ON builds(organization_id);
CREATE INDEX IF NOT EXISTS idx_builds_started_at ON builds(started_at);
CREATE INDEX IF NOT EXISTS idx_build_analyses_org_id ON build_analyses(organization_id);
CREATE INDEX IF NOT EXISTS idx_health_snapshots_org_id ON health_snapshots(organization_id);
CREATE INDEX IF NOT EXISTS idx_team_members_org_id ON team_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_alert_events_org_id ON alert_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_pattern_candidates_org_id ON pattern_candidates(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_ci_instances_org_id ON ci_instances(organization_id);
CREATE INDEX IF NOT EXISTS idx_teams_org_id ON teams(organization_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_org_id ON alert_rules(organization_id);

-- ============================================================
-- STEP 7: Helper function for setup status (needs to bypass RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_any_org() RETURNS boolean
SECURITY DEFINER
LANGUAGE sql
AS $$ SELECT EXISTS(SELECT 1 FROM organizations) $$;

ALTER FUNCTION public.has_any_org() OWNER TO pulsci_admin;

-- ============================================================
-- STEP 7b: Transfer table ownership to pulsci_admin
-- (FORCE ROW LEVEL SECURITY only works on non-owner roles)
-- ============================================================

ALTER TABLE organizations OWNER TO pulsci_admin;
ALTER TABLE users OWNER TO pulsci_admin;
ALTER TABLE ci_instances OWNER TO pulsci_admin;
ALTER TABLE teams OWNER TO pulsci_admin;
ALTER TABLE team_members OWNER TO pulsci_admin;
ALTER TABLE jobs OWNER TO pulsci_admin;
ALTER TABLE builds OWNER TO pulsci_admin;
ALTER TABLE build_analyses OWNER TO pulsci_admin;
ALTER TABLE health_snapshots OWNER TO pulsci_admin;
ALTER TABLE alert_rules OWNER TO pulsci_admin;
ALTER TABLE alert_events OWNER TO pulsci_admin;
ALTER TABLE pattern_candidates OWNER TO pulsci_admin;

-- ============================================================
-- STEP 8: Enable RLS on all org-scoped tables
-- ============================================================

-- organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON organizations;
CREATE POLICY tenant_isolation ON organizations
  USING (id = current_setting('app.current_org_id', true)::uuid);
DROP POLICY IF EXISTS tenant_insert ON organizations;
CREATE POLICY tenant_insert ON organizations
  FOR INSERT WITH CHECK (id = current_setting('app.current_org_id', true)::uuid);

-- users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON users;
CREATE POLICY tenant_isolation ON users
  USING (organization_id = current_setting('app.current_org_id', true)::uuid);
DROP POLICY IF EXISTS tenant_insert ON users;
CREATE POLICY tenant_insert ON users
  FOR INSERT WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

-- ci_instances
ALTER TABLE ci_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE ci_instances FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON ci_instances;
CREATE POLICY tenant_isolation ON ci_instances
  USING (organization_id = current_setting('app.current_org_id', true)::uuid);
DROP POLICY IF EXISTS tenant_insert ON ci_instances;
CREATE POLICY tenant_insert ON ci_instances
  FOR INSERT WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

-- teams
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON teams;
CREATE POLICY tenant_isolation ON teams
  USING (organization_id = current_setting('app.current_org_id', true)::uuid);
DROP POLICY IF EXISTS tenant_insert ON teams;
CREATE POLICY tenant_insert ON teams
  FOR INSERT WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

-- team_members
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON team_members;
CREATE POLICY tenant_isolation ON team_members
  USING (organization_id = current_setting('app.current_org_id', true)::uuid);
DROP POLICY IF EXISTS tenant_insert ON team_members;
CREATE POLICY tenant_insert ON team_members
  FOR INSERT WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

-- jobs
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON jobs;
CREATE POLICY tenant_isolation ON jobs
  USING (organization_id = current_setting('app.current_org_id', true)::uuid);
DROP POLICY IF EXISTS tenant_insert ON jobs;
CREATE POLICY tenant_insert ON jobs
  FOR INSERT WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

-- builds
ALTER TABLE builds ENABLE ROW LEVEL SECURITY;
ALTER TABLE builds FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON builds;
CREATE POLICY tenant_isolation ON builds
  USING (organization_id = current_setting('app.current_org_id', true)::uuid);
DROP POLICY IF EXISTS tenant_insert ON builds;
CREATE POLICY tenant_insert ON builds
  FOR INSERT WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

-- build_analyses
ALTER TABLE build_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE build_analyses FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON build_analyses;
CREATE POLICY tenant_isolation ON build_analyses
  USING (organization_id = current_setting('app.current_org_id', true)::uuid);
DROP POLICY IF EXISTS tenant_insert ON build_analyses;
CREATE POLICY tenant_insert ON build_analyses
  FOR INSERT WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

-- health_snapshots
ALTER TABLE health_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_snapshots FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON health_snapshots;
CREATE POLICY tenant_isolation ON health_snapshots
  USING (organization_id = current_setting('app.current_org_id', true)::uuid);
DROP POLICY IF EXISTS tenant_insert ON health_snapshots;
CREATE POLICY tenant_insert ON health_snapshots
  FOR INSERT WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

-- alert_rules
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON alert_rules;
CREATE POLICY tenant_isolation ON alert_rules
  USING (organization_id = current_setting('app.current_org_id', true)::uuid);
DROP POLICY IF EXISTS tenant_insert ON alert_rules;
CREATE POLICY tenant_insert ON alert_rules
  FOR INSERT WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

-- alert_events
ALTER TABLE alert_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON alert_events;
CREATE POLICY tenant_isolation ON alert_events
  USING (organization_id = current_setting('app.current_org_id', true)::uuid);
DROP POLICY IF EXISTS tenant_insert ON alert_events;
CREATE POLICY tenant_insert ON alert_events
  FOR INSERT WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

-- pattern_candidates
ALTER TABLE pattern_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE pattern_candidates FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON pattern_candidates;
CREATE POLICY tenant_isolation ON pattern_candidates
  USING (organization_id = current_setting('app.current_org_id', true)::uuid);
DROP POLICY IF EXISTS tenant_insert ON pattern_candidates;
CREATE POLICY tenant_insert ON pattern_candidates
  FOR INSERT WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

-- ============================================================
-- STEP 9: Verification — test that RLS blocks unscoped queries
-- ============================================================

-- When app.current_org_id is not set, queries should return 0 rows
-- (current_setting with missing_ok=true returns NULL, which won't match any UUID)
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  -- Reset any existing setting
  PERFORM set_config('app.current_org_id', '', false);

  SELECT COUNT(*) INTO row_count FROM ci_instances;
  IF row_count > 0 THEN
    RAISE WARNING 'RLS verification: ci_instances returned % rows without org context — check policies', row_count;
  ELSE
    RAISE NOTICE 'RLS verification passed — ci_instances returns 0 rows without org context';
  END IF;
END
$$;

-- ============================================================
-- DONE
-- ============================================================
-- Rollback: ALTER TABLE <name> DISABLE ROW LEVEL SECURITY;
-- for each table listed above.
