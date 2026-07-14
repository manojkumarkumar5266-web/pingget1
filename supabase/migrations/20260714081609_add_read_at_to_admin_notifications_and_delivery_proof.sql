/*
# Add read_at to admin_notifications and delivery_proof_url to requests

## Changes
1. Add `read_at` (timestamptz, nullable) to `admin_notifications` — tracks when admin viewed each notification
2. Add `delivery_proof_url` (text, nullable) to `requests` — stores photo proof of delivery uploaded by DP or user
3. Add `delivery_proof_by` (uuid, nullable) to `requests` — stores who uploaded the proof (user_id or dp_id)
4. Add `delivery_proof_at` (timestamptz, nullable) to `requests` — when proof was uploaded

## Security
- No RLS policy changes needed; existing policies cover the new columns
*/

ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS read_at timestamptz;

ALTER TABLE requests ADD COLUMN IF NOT EXISTS delivery_proof_url text;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS delivery_proof_by uuid;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS delivery_proof_at timestamptz;
