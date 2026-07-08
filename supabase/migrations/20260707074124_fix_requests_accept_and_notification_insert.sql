-- Fix 1: Allow DPs to accept pending requests.
-- The old USING clause checked accepted_dp_id = auth.uid(), but on a pending request
-- accepted_dp_id is NULL so any DP's update attempt was silently rejected.
-- Adding status = 'pending' to USING lets any authenticated user (DP) update a pending request.
-- The WITH CHECK still ensures the new row has the updater as accepted_dp_id or owner.
DROP POLICY IF EXISTS "requests_update_own_or_dp" ON requests;
CREATE POLICY "requests_update_own_or_dp" ON requests FOR UPDATE
  TO authenticated USING (
    user_id = auth.uid() OR
    accepted_dp_id = auth.uid() OR
    status = 'pending' OR
    public.is_admin()
  ) WITH CHECK (
    user_id = auth.uid() OR accepted_dp_id = auth.uid() OR public.is_admin()
  );

-- Fix 2: Allow any authenticated user to insert notifications for other users.
-- DPs need to notify users when accepting requests, but the old policy only allowed
-- inserting notifications where user_id = auth.uid() (i.e. only self-notifications).
DROP POLICY IF EXISTS "notifications_insert_own" ON notifications;
CREATE POLICY "notifications_insert_any" ON notifications FOR INSERT
  TO authenticated WITH CHECK (true);
