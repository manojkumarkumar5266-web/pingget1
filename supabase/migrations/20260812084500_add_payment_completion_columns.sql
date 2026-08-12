-- Instant order tracking: customer marks paid → DP accepts payment
ALTER TABLE requests ADD COLUMN IF NOT EXISTS payment_completed_at timestamptz;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS payment_accepted_at timestamptz;

-- Ensure waitlist exists (idempotent for DBs that never got the squash footer)
CREATE TABLE IF NOT EXISTS service_area_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  email text NOT NULL,
  pincode text,
  area_name text,
  city_name text,
  lat double precision,
  lng double precision,
  source text DEFAULT 'app',
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS service_area_waitlist_email_uidx
  ON service_area_waitlist (lower(email));

-- Expand requests.status check so advance + COD payment statuses are allowed
DO $$
BEGIN
  ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_status_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE requests ADD CONSTRAINT requests_status_check
  CHECK (status IN (
    'pending','accepted','confirmed','shopping','purchased','on_the_way','arrived',
    'delivered','cash_received','completed','cancelled','scheduled','expired','rescheduled',
    'searching_dp','dp_reserved','waiting_payment','payment_verified','booking_confirmed',
    'task_started','task_completed','no_dp_found'
  ));
