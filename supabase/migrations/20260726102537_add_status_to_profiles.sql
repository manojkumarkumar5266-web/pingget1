ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'pending', 'rejected', 'suspended', 'banned'));

DROP POLICY IF EXISTS "admin_update_user_status" ON profiles;
CREATE POLICY "admin_update_user_status" ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );