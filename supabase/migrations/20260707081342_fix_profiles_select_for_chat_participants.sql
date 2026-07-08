-- Allow users to see profiles of people they share a chat room with.
-- Without this, ChatScreen shows null name/avatar for the other participant.
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  TO authenticated USING (
    auth.uid() = id
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM chat_rooms
      WHERE (chat_rooms.user_id = auth.uid() AND chat_rooms.dp_id = profiles.id)
         OR (chat_rooms.dp_id = auth.uid() AND chat_rooms.user_id = profiles.id)
    )
  );
