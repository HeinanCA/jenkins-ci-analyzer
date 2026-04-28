-- D1: priority enum + column on build_analyses.
-- AI-emitted priority for ranking failures: BLOCKER > ACTIONABLE > FLAKY > INFRA > UNKNOWN.
-- Additive only — existing rows default to UNKNOWN, RLS inherits from build_analyses.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'failure_priority') THEN
    CREATE TYPE failure_priority AS ENUM ('BLOCKER', 'ACTIONABLE', 'FLAKY', 'INFRA', 'UNKNOWN');
  END IF;
END$$;

ALTER TABLE build_analyses
  ADD COLUMN IF NOT EXISTS priority failure_priority NOT NULL DEFAULT 'UNKNOWN';
