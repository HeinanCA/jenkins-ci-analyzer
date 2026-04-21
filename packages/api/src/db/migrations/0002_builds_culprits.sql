-- Phase 2: culprits array on builds
-- Safe, additive-only — no RLS changes needed (builds already FORCE RLS on organization_id)

ALTER TABLE builds ADD COLUMN IF NOT EXISTS culprits text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS builds_culprits_gin_idx ON builds USING GIN(culprits);
