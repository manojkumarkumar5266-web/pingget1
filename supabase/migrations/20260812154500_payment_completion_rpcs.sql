-- Instant COD payment: ensure columns + SECURITY DEFINER RPCs so customer/DP
-- can complete the payment handshake even when schema lag / RLS edge cases.

ALTER TABLE requests ADD COLUMN IF NOT EXISTS payment_completed_at timestamptz;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS payment_accepted_at timestamptz;

-- Expand status check (idempotent)
DO $$
BEGIN
  ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_status_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE requests ADD CONSTRAINT requests_status_check
  CHECK (status IN (
    'pending','accepted','confirmed','shopping','purchased','on_the_way','arrived',
    'delivered','cash_received','completed','cancelled','scheduled','expired','rescheduled',
    'searching_dp','dp_reserved','waiting_payment','payment_verified','booking_confirmed',
    'task_started','task_completed','no_dp_found'
  ));

CREATE OR REPLACE FUNCTION public.mark_customer_payment_completed(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req public.requests%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_req FROM public.requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_req.user_id IS DISTINCT FROM v_uid AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  UPDATE public.requests
  SET
    payment_completed_at = COALESCE(payment_completed_at, now()),
    status = CASE
      WHEN status IN ('completed', 'delivered', 'cash_received') THEN 'cash_received'
      ELSE status
    END
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'ok', true,
    'payment_completed_at', (SELECT payment_completed_at FROM public.requests WHERE id = p_request_id),
    'status', (SELECT status FROM public.requests WHERE id = p_request_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_dp_payment_accepted(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req public.requests%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_req FROM public.requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_req.accepted_dp_id IS DISTINCT FROM v_uid AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  UPDATE public.requests
  SET payment_accepted_at = COALESCE(payment_accepted_at, now())
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'ok', true,
    'payment_accepted_at', (SELECT payment_accepted_at FROM public.requests WHERE id = p_request_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_customer_payment_completed(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_dp_payment_accepted(uuid) TO authenticated;
