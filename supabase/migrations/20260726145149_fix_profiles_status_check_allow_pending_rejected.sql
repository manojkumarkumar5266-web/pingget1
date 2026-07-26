-- Fix: the profiles.status CHECK constraint only allows 'active', 'suspended', 'banned'.
-- But the signup edge function inserts 'pending' for DP accounts and 'rejected'
-- is also used. This causes the profile insert to fail with a CHECK violation,
-- which makes signup return a 400 error even though the auth user was created.

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('active', 'suspended', 'banned', 'pending', 'rejected'));