-- Fix requests UPDATE policy: remove the "status = 'pending'" loophole
-- that allowed ANY authenticated user to update ANY pending request.
DROP POLICY IF EXISTS "requests_update_own_or_dp" ON requests;
DROP POLICY IF EXISTS "requests_update_own_accepted_dp" ON requests;
DROP POLICY IF EXISTS "requests_update_own_or_accepted_dp" ON requests;

CREATE POLICY "requests_update_own_or_accepted_dp"
ON requests FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR accepted_dp_id = auth.uid()
  OR is_admin()
)
WITH CHECK (
  user_id = auth.uid()
  OR accepted_dp_id = auth.uid()
  OR is_admin()
);