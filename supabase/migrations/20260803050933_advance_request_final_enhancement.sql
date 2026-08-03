-- Advance Request Final Enhancement
-- Adds: recurring support, reschedule history, cancellation policy, configurable expiry,
-- weekend charge, percentage charge support, smart reminder config, slot enable/disable,
-- recurring_enabled flag, cancellation_fee_after_accept, admin_override_cancellation

-- 1. New columns on advance_settings
ALTER TABLE advance_settings
  ADD COLUMN IF NOT EXISTS recurring_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS weekend_charge numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekend_charge_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS platform_fee_percent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dp_convenience_percent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancellation_fee_after_accept numeric DEFAULT 25,
  ADD COLUMN IF NOT EXISTS admin_override_cancellation boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS expiry_mode text DEFAULT '2_hours',
  ADD COLUMN IF NOT EXISTS expiry_custom_minutes integer DEFAULT 120,
  ADD COLUMN IF NOT EXISTS reminder_24h boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_12h boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_2h boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_1h boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_30m boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_15m boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_5m boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS expand_search_radius boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS search_radius_increment_meters integer DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS max_search_radius_meters integer DEFAULT 20000;

-- 2. New columns on requests for recurring, reschedule, cancellation
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS recurring_type text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS recurring_interval_days integer,
  ADD COLUMN IF NOT EXISTS recurring_weekday integer,
  ADD COLUMN IF NOT EXISTS recurring_month_day integer,
  ADD COLUMN IF NOT EXISTS recurring_parent_id uuid,
  ADD COLUMN IF NOT EXISTS recurring_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reschedule_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reschedule_history jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_by text,
  ADD COLUMN IF NOT EXISTS cancellation_fee numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expired_at timestamptz;

-- 3. Reschedule history table
CREATE TABLE IF NOT EXISTS reschedule_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  actor_type text NOT NULL DEFAULT 'customer',
  old_date date,
  old_slot text,
  new_date date,
  new_slot text,
  old_shop_name text,
  new_shop_name text,
  old_description text,
  new_description text,
  reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reschedule_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_reschedule_logs" ON reschedule_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_reschedule_logs" ON reschedule_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_reschedule_logs_admin" ON reschedule_logs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 4. Slot overrides table (admin can enable/disable individual slots)
CREATE TABLE IF NOT EXISTS advance_slot_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_key text NOT NULL,
  date_key date,
  is_disabled boolean DEFAULT false,
  reason text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  UNIQUE(slot_key, date_key)
);

ALTER TABLE advance_slot_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_slot_overrides" ON advance_slot_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_slot_overrides_admin" ON advance_slot_overrides FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_slot_overrides_admin" ON advance_slot_overrides FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_slot_overrides_admin" ON advance_slot_overrides FOR DELETE TO authenticated USING (true);

-- 5. Add recurring_parent_id foreign key constraint (self-reference, nullable)
-- Already added as plain column above; add FK carefully
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'requests_recurring_parent_id_fkey'
    AND table_name = 'requests'
  ) THEN
    ALTER TABLE requests
      ADD CONSTRAINT requests_recurring_parent_id_fkey
      FOREIGN KEY (recurring_parent_id) REFERENCES requests(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 6. Add check constraint for recurring_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'requests_recurring_type_check'
  ) THEN
    ALTER TABLE requests
      ADD CONSTRAINT requests_recurring_type_check
      CHECK (recurring_type IN ('none', 'daily', 'weekly', 'monthly', 'custom'));
  END IF;
END $$;

-- 7. Add check constraint for expiry_mode
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'advance_settings_expiry_mode_check'
  ) THEN
    ALTER TABLE advance_settings
      ADD CONSTRAINT advance_settings_expiry_mode_check
      CHECK (expiry_mode IN ('30_minutes', '1_hour', '2_hours', '4_hours', 'end_of_slot', 'never'));
  END IF;
END $$;
