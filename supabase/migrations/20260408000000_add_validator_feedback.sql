-- Migration: add validator_feedback table
-- Records human override decisions made in validate.html

CREATE TABLE validator_feedback (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id  uuid        NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  original_result text     NOT NULL CHECK (original_result IN ('PASS', 'WARN', 'FAIL')),
  original_flags  text[]   NOT NULL DEFAULT '{}',
  your_decision   text     NOT NULL CHECK (your_decision IN ('PASS', 'WARN', 'FAIL')),
  reason          text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE validator_feedback ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by serverless functions and direct scripts)
CREATE POLICY "service_role_full_access"
  ON validator_feedback
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Index for fast recent-feedback queries
CREATE INDEX idx_validator_feedback_created_at
  ON validator_feedback (created_at DESC);
