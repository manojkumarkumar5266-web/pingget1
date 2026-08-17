-- Fix DP Accept Payment failures.
-- Run in Supabase SQL Editor if Accept Payment still errors after deploy.

ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS payment_completed_at timestamptz;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS payment_accepted_at timestamptz;

CREATE OR REPLACE FUNCTION public.mark_dp_payment_accepted(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req public.requests%ROWTYPE;
  v_allowed boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_req FROM public.requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- Allow assigned DP via accepted_dp_id OR reserved_dp_id OR admin
  IF v_req.accepted_dp_id IS NOT DISTINCT FROM v_uid THEN
    v_allowed := true;
  ELSIF v_req.reserved_dp_id IS NOT DISTINCT FROM v_uid THEN
    v_allowed := true;
  ELSIF public.is_admin() THEN
    v_allowed := true;
  END IF;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden', 'hint', 'You are not the assigned delivery partner for this order');
  END IF;

  UPDATE public.requests
  SET
    payment_accepted_at = COALESCE(payment_accepted_at, now()),
    -- Keep cash_received if already set; otherwise leave status alone
    status = CASE
      WHEN status IN ('completed', 'delivered', 'cash_received') THEN 'cash_received'
      ELSE status
    END,
    -- Ensure accepted_dp_id is set for later rating lookups
    accepted_dp_id = COALESCE(accepted_dp_id, reserved_dp_id, v_uid)
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'ok', true,
    'payment_accepted_at', (SELECT payment_accepted_at FROM public.requests WHERE id = p_request_id),
    'status', (SELECT status FROM public.requests WHERE id = p_request_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_dp_payment_accepted(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_dp_payment_accepted(uuid) TO anon;

DROP POLICY IF EXISTS "requests_update_own_or_accepted_dp" ON public.requests;
CREATE POLICY "requests_update_own_or_accepted_dp" ON public.requests FOR UPDATE
  TO authenticated USING (
    user_id = auth.uid()
    OR accepted_dp_id = auth.uid()
    OR reserved_dp_id = auth.uid()
    OR status = 'pending'
    OR public.is_admin()
  ) WITH CHECK (
    user_id = auth.uid()
    OR accepted_dp_id = auth.uid()
    OR reserved_dp_id = auth.uid()
    OR public.is_admin()
  );
