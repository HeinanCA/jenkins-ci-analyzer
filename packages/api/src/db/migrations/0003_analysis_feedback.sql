-- Analysis feedback: thumbs up/down on AI failure analyses
CREATE TABLE IF NOT EXISTS "analysis_feedback" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "build_analysis_id" uuid NOT NULL REFERENCES "build_analyses"("id"),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "rating" text NOT NULL,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "feedback_user_analysis_idx"
  ON "analysis_feedback" ("user_id", "build_analysis_id");

-- RLS policy: users can only see/manage feedback in their own org
ALTER TABLE "analysis_feedback" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analysis_feedback_org_isolation"
  ON "analysis_feedback"
  USING (organization_id::text = current_setting('app.current_org_id', true));

-- Index for aggregation queries (ai-cost endpoint)
CREATE INDEX IF NOT EXISTS "feedback_org_rating_idx"
  ON "analysis_feedback" ("organization_id", "rating");
