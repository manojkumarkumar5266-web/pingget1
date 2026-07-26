-- Add email column to profiles so we can match Google OAuth users to existing accounts
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles (email);

-- Backfill email for existing profiles from auth.users
UPDATE profiles p SET email = u.email FROM auth.users u WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');