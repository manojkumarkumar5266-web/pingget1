-- Allow closing advance booking chats after payment is verified
ALTER TABLE chat_rooms
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "chat_rooms_update_participants" ON chat_rooms;
CREATE POLICY "chat_rooms_update_participants" ON chat_rooms
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR dp_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR dp_id = auth.uid() OR public.is_admin());
