-- Phase 3: failure_views table for "Fixed" card dismissal
-- Tracks which users have seen a recovery build for a previously-failing job.
-- RLS enforced: organization_id always from session setting.

CREATE TABLE IF NOT EXISTS failure_views (
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  build_id        uuid NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  viewed_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, build_id)
);

CREATE INDEX IF NOT EXISTS failure_views_org_idx ON failure_views(organization_id);

ALTER TABLE failure_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE failure_views FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON failure_views
  USING (organization_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY tenant_insert ON failure_views FOR INSERT
  WITH CHECK (organization_id = current_setting('app.current_org_id')::uuid);
