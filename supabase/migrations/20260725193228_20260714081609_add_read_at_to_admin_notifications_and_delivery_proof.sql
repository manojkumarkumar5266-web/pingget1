ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS read_at timestamptz;

ALTER TABLE requests ADD COLUMN IF NOT EXISTS delivery_proof_url text;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS delivery_proof_by uuid;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS delivery_proof_at timestamptz;