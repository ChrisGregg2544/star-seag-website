-- Fix test account subscription — use UPSERT not UPDATE
-- (UPDATE silently affects 0 rows if the row doesn't exist)
-- Run in Supabase SQL editor.

INSERT INTO parent_subscriptions (parent_id, stripe_customer_id, subscription_status, trial_end)
VALUES (
  'c8df4366-4c54-4376-b178-dfd984c93773',
  'cus_UPk9g4zF7Tumxh',
  'trialing',
  '2026-05-04'
)
ON CONFLICT (parent_id) DO UPDATE SET
  stripe_customer_id  = EXCLUDED.stripe_customer_id,
  subscription_status = EXCLUDED.subscription_status,
  trial_end           = EXCLUDED.trial_end;

-- Also sync profiles table (checked by pricing.html)
UPDATE profiles
SET   stripe_customer_id  = 'cus_UPk9g4zF7Tumxh',
      subscription_status = 'trialing',
      trial_end           = '2026-05-04'
WHERE id = 'c8df4366-4c54-4376-b178-dfd984c93773';
