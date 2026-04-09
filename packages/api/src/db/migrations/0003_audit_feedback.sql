-- Migration: audit_events + analysis_feedback tables
-- Created: 2026-04-09

-- ─── Audit Events (append-only) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_events (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid    NOT NULL REFERENCES organizations(id),
  actor_user_id   text    NOT NULL,
  actor_email     text    NOT NULL,
  action          text    NOT NULL,
  target_type     text,
  target_id       text,
  metadata        jsonb   DEFAULT '{}',
  created_at      timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS audit_events_org_id_idx ON audit_events(organization_id);
CREATE INDEX IF NOT EXISTS audit_events_created_at_idx ON audit_events(created_at);

-- RLS: read + insert only — no UPDATE or DELETE
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_read ON audit_events
  FOR SELECT
  USING (organization_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY audit_insert ON audit_events
  FOR INSERT
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

-- NO UPDATE or DELETE policy — audit log is append-only

-- ─── Analysis Feedback ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS analysis_feedback (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id   uuid        NOT NULL REFERENCES organizations(id),
  build_analysis_id uuid        NOT NULL REFERENCES build_analyses(id),
  user_id           uuid        NOT NULL REFERENCES users(id),
  rating            text        NOT NULL CHECK (rating IN ('helpful', 'not_helpful')),
  note              text,
  created_at        timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS feedback_user_analysis_idx
  ON analysis_feedback(user_id, build_analysis_id);

ALTER TABLE analysis_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY feedback_read ON analysis_feedback
  FOR SELECT
  USING (organization_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY feedback_insert ON analysis_feedback
  FOR INSERT
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY feedback_update ON analysis_feedback
  FOR UPDATE
  USING (organization_id = current_setting('app.current_org_id', true)::uuid);
