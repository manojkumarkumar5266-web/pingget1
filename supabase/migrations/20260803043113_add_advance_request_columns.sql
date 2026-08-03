/*
# Add Advance Request (Scheduled Task) Feature

## Purpose
Extends the existing `requests` table with columns for scheduled/advance requests,
and creates a new `advance_settings` table for admin-configurable scheduling,
time slots, and service charges. This does NOT change any existing columns,
business logic, or instant request workflow.

## 1. New Columns on `requests` table
- `order_type` (text, default 'instant') — 'instant' or 'advance'
- `is_scheduled` (boolean, default false) — true for advance requests
- `scheduled_date` (date) — the scheduled date
- `scheduled_time` (text) — human-readable time slot label
- `scheduled_slot` (text) — slot key e.g. "14:00-14:30"
- `scheduled_timestamp` (timestamptz) — full scheduled datetime
- `request_category` (text) — category of the scheduled task
- `shop_name` (text) — optional shop name
- `shop_phone` (text) — optional shop phone
- `shop_address` (text) — optional shop address
- `shop_lat` (double precision) — optional shop latitude
- `shop_lng` (double precision) — optional shop longitude
- `estimated_task_duration` (integer) — estimated duration in minutes
- `special_instructions` (text) — already exists in some schemas; added if missing
- `estimated_total_charge` (numeric) — calculated charge estimate
- `charge_breakdown` (jsonb) — breakdown of charges

## 2. New Status Value
- Adds 'scheduled' to the requests status CHECK constraint.
- Adds 'expired' to the requests status CHECK constraint.
- Adds 'rescheduled' to the requests status CHECK constraint.

## 3. New Table: `advance_settings`
Admin-configurable settings for the Advance Request feature.
- `id` (uuid PK)
- `enabled` (boolean, default true)
- `max_advance_days` (integer, default 7)
- `notification_lead_minutes` (integer, default 30)
- `business_hours_start` (text, default '08:00')
- `business_hours_end` (text, default '20:00')
- `slot_duration_minutes` (integer, default 30)
- `advance_booking_fee` (numeric, default 10)
- `platform_fee` (numeric, default 5)
- `min_service_charge` (numeric, default 20)
- `max_service_charge` (numeric, default 500)
- `dp_convenience_charge` (numeric, default 15)
- `emergency_charge` (numeric, default 0)
- `holiday_charge` (numeric, default 0)
- `night_charge` (numeric, default 0)
- `night_charge_start` (text, default '22:00')
- `night_charge_end` (text, default '06:00')
- `peak_hour_charge` (numeric, default 0)
- `peak_hours_start` (text, default '17:00')
- `peak_hours_end` (text, default '20:00')
- `cancellation_cutoff_minutes` (integer, default 120)
- `reschedule_cutoff_minutes` (integer, default 360)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

## 4. Security
- `advance_settings` RLS enabled.
- SELECT for all authenticated (so the app can read config).
- INSERT/UPDATE/DELETE for admins only.
- No changes to existing RLS policies on `requests`.

## 5. Indexes
- Index on `requests(is_scheduled)` for scheduled request filtering.
- Index on `requests(scheduled_timestamp)` for due-time queries.
- Index on `requests(order_type)` for filtering.
*/

-- 1. Add new columns to requests table (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requests' AND column_name='order_type') THEN
    ALTER TABLE requests ADD COLUMN order_type text NOT NULL DEFAULT 'instant';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requests' AND column_name='is_scheduled') THEN
    ALTER TABLE requests ADD COLUMN is_scheduled boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requests' AND column_name='scheduled_date') THEN
    ALTER TABLE requests ADD COLUMN scheduled_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requests' AND column_name='scheduled_time') THEN
    ALTER TABLE requests ADD COLUMN scheduled_time text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requests' AND column_name='scheduled_slot') THEN
    ALTER TABLE requests ADD COLUMN scheduled_slot text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requests' AND column_name='scheduled_timestamp') THEN
    ALTER TABLE requests ADD COLUMN scheduled_timestamp timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requests' AND column_name='request_category') THEN
    ALTER TABLE requests ADD COLUMN request_category text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requests' AND column_name='shop_name') THEN
    ALTER TABLE requests ADD COLUMN shop_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requests' AND column_name='shop_phone') THEN
    ALTER TABLE requests ADD COLUMN shop_phone text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requests' AND column_name='shop_address') THEN
    ALTER TABLE requests ADD COLUMN shop_address text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requests' AND column_name='shop_lat') THEN
    ALTER TABLE requests ADD COLUMN shop_lat double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requests' AND column_name='shop_lng') THEN
    ALTER TABLE requests ADD COLUMN shop_lng double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requests' AND column_name='estimated_task_duration') THEN
    ALTER TABLE requests ADD COLUMN estimated_task_duration integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requests' AND column_name='special_instructions') THEN
    ALTER TABLE requests ADD COLUMN special_instructions text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requests' AND column_name='estimated_total_charge') THEN
    ALTER TABLE requests ADD COLUMN estimated_total_charge numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requests' AND column_name='charge_breakdown') THEN
    ALTER TABLE requests ADD COLUMN charge_breakdown jsonb;
  END IF;
END $$;

-- 2. Update status CHECK constraint to include scheduled/expired/rescheduled
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='requests_status_check' AND table_name='requests') THEN
    ALTER TABLE requests DROP CONSTRAINT requests_status_check;
  END IF;
END $$;
ALTER TABLE requests ADD CONSTRAINT requests_status_check
  CHECK (status IN ('pending','accepted','confirmed','shopping','purchased','on_the_way','arrived','delivered','cash_received','completed','cancelled','scheduled','expired','rescheduled'));

-- 3. Create advance_settings table
CREATE TABLE IF NOT EXISTS advance_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT true,
  max_advance_days integer NOT NULL DEFAULT 7,
  notification_lead_minutes integer NOT NULL DEFAULT 30,
  business_hours_start text NOT NULL DEFAULT '08:00',
  business_hours_end text NOT NULL DEFAULT '20:00',
  slot_duration_minutes integer NOT NULL DEFAULT 30,
  advance_booking_fee numeric NOT NULL DEFAULT 10,
  platform_fee numeric NOT NULL DEFAULT 5,
  min_service_charge numeric NOT NULL DEFAULT 20,
  max_service_charge numeric NOT NULL DEFAULT 500,
  dp_convenience_charge numeric NOT NULL DEFAULT 15,
  emergency_charge numeric NOT NULL DEFAULT 0,
  holiday_charge numeric NOT NULL DEFAULT 0,
  night_charge numeric NOT NULL DEFAULT 0,
  night_charge_start text NOT NULL DEFAULT '22:00',
  night_charge_end text NOT NULL DEFAULT '06:00',
  peak_hour_charge numeric NOT NULL DEFAULT 0,
  peak_hours_start text NOT NULL DEFAULT '17:00',
  peak_hours_end text NOT NULL DEFAULT '20:00',
  cancellation_cutoff_minutes integer NOT NULL DEFAULT 120,
  reschedule_cutoff_minutes integer NOT NULL DEFAULT 360,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE advance_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "advance_settings_select_all" ON advance_settings;
CREATE POLICY "advance_settings_select_all" ON advance_settings FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "advance_settings_insert_admin" ON advance_settings;
CREATE POLICY "advance_settings_insert_admin" ON advance_settings FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "advance_settings_update_admin" ON advance_settings;
CREATE POLICY "advance_settings_update_admin" ON advance_settings FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "advance_settings_delete_admin" ON advance_settings;
CREATE POLICY "advance_settings_delete_admin" ON advance_settings FOR DELETE
  TO authenticated USING (public.is_admin());

-- Seed a default row if none exists
INSERT INTO advance_settings (id, enabled)
SELECT gen_random_uuid(), true
WHERE NOT EXISTS (SELECT 1 FROM advance_settings);

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_requests_is_scheduled ON requests(is_scheduled) WHERE is_scheduled = true;
CREATE INDEX IF NOT EXISTS idx_requests_scheduled_timestamp ON requests(scheduled_timestamp) WHERE scheduled_timestamp IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_requests_order_type ON requests(order_type);

-- 5. Add advance_settings to realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'advance_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE advance_settings;
  END IF;
END $$;
