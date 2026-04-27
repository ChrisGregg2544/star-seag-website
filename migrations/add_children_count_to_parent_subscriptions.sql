-- Add children_count to parent_subscriptions for Stripe per-child billing.
-- Run in Supabase SQL editor before deploying add-child.js.

ALTER TABLE parent_subscriptions
  ADD COLUMN IF NOT EXISTS children_count integer NOT NULL DEFAULT 0;

-- Backfill from existing child profiles
UPDATE parent_subscriptions ps
SET children_count = (
  SELECT COUNT(*) FROM profiles p WHERE p.parent_id = ps.parent_id
);
