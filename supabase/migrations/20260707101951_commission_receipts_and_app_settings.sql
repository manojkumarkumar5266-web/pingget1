-- Daily commission receipts: DP submits proof of payment → admin confirms
CREATE TABLE IF NOT EXISTS dp_commission_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dp_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  upi_ref text NOT NULL,
  screenshot_url text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'confirmed', 'rejected')),
  reject_reason text,
  submitted_at timestamptz DEFAULT now(),
  confirmed_at timestamptz,
  confirmed_by uuid REFERENCES auth.users(id)
);
ALTER TABLE dp_commission_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "receipts_select_own_admin" ON dp_commission_receipts FOR SELECT
  TO authenticated USING (dp_user_id = auth.uid() OR public.is_admin());
CREATE POLICY "receipts_insert_own" ON dp_commission_receipts FOR INSERT
  TO authenticated WITH CHECK (dp_user_id = auth.uid());
CREATE POLICY "receipts_update_admin" ON dp_commission_receipts FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- App-level key/value settings (admin UPI ID, etc.)
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT ''
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_select_authenticated" ON app_settings FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "settings_insert_admin" ON app_settings FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "settings_update_admin" ON app_settings FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO app_settings (key, value) VALUES ('admin_upi_id', 'admin@upi') ON CONFLICT DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('admin_name', 'pingGET Admin') ON CONFLICT DO NOTHING;
