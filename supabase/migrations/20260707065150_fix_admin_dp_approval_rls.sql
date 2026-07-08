
DO $$ BEGIN
  DROP POLICY IF EXISTS "dp_update_admin" ON delivery_partners;
  DROP POLICY IF EXISTS "dp_delete_admin" ON delivery_partners;
  DROP POLICY IF EXISTS "dp_select_admin" ON delivery_partners;
  DROP POLICY IF EXISTS "dp_insert_admin" ON delivery_partners;
END $$;

CREATE POLICY "dp_update_admin" ON delivery_partners FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "dp_select_admin" ON delivery_partners FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
