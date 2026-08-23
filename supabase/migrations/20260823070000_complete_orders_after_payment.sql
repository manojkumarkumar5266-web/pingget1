-- After customer pay + DP Accept Payment, keep the request COMPLETED
-- (do not bounce it back to cash_received, which keeps it on Active).

ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS payment_completed_at timestamptz;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS payment_accepted_at timestamptz;

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
      WHEN status = 'completed' THEN 'completed'
      WHEN status IN ('delivered', 'cash_received', 'task_completed') THEN 'cash_received'
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
  v_allowed boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_req FROM public.requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

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
    status = CASE
      WHEN status IN ('completed', 'delivered', 'cash_received', 'task_completed') THEN 'completed'
      ELSE status
    END,
    accepted_dp_id = COALESCE(accepted_dp_id, reserved_dp_id, v_uid)
  WHERE id = p_request_id;

  UPDATE public.orders
  SET status = 'completed', completed_at = COALESCE(completed_at, now())
  WHERE request_id = p_request_id;

  RETURN jsonb_build_object(
    'ok', true,
    'payment_accepted_at', (SELECT payment_accepted_at FROM public.requests WHERE id = p_request_id),
    'status', (SELECT status FROM public.requests WHERE id = p_request_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_customer_payment_completed(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_dp_payment_accepted(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_dp_payment_accepted(uuid) TO anon;
