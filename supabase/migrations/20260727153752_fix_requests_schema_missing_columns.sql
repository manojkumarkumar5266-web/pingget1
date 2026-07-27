-- Add photo_urls array column (replaces single photo_url)
ALTER TABLE requests ADD COLUMN IF NOT EXISTS photo_urls text[];

-- Drop title column (frontend no longer sends it; description is used)
ALTER TABLE requests DROP COLUMN IF EXISTS title;

-- Allow null delivery_address (some requests may not have one initially)
ALTER TABLE requests ALTER COLUMN delivery_address DROP NOT NULL;

-- Add email column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles (email);

-- Backfill email for existing profiles from auth.users
UPDATE profiles p SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- Add gps_updated_at to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gps_updated_at timestamptz;

-- Add indexes for location queries
CREATE INDEX IF NOT EXISTS idx_delivery_partners_online
  ON delivery_partners(is_online) WHERE is_online = true;
CREATE INDEX IF NOT EXISTS idx_profiles_gps
  ON profiles(gps_lat, gps_lng)
  WHERE gps_lat IS NOT NULL AND gps_lng IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_requests_pending
  ON requests(status, created_at)
  WHERE status = 'pending';