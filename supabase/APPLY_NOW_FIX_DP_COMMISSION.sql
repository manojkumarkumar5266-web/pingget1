-- Accrue admin commission when DP accepts payment (order completed).
-- Run in the Supabase SQL Editor if wallet still shows ₹0 / "all paid" after a completed order.

CREATE OR REPLACE FUNCTION public.accrue_order_commission(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.requests%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_pct numeric := 10;
  v_charge numeric := 0;
  v_quote numeric := 0;
  v_comm numeric := 0;
  v_dp uuid;
  v_city text;
BEGIN
  SELECT * INTO v_req FROM public.requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_dp := COALESCE(v_req.accepted_dp_id, v_req.reserved_dp_id);

  SELECT * INTO v_order
  FROM public.orders
  WHERE request_id = p_request_id
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT p.city INTO v_city
  FROM public.profiles p
  WHERE p.id = COALESCE(v_dp, v_req.user_id);

  IF to_regclass('public.cities') IS NOT NULL AND v_city IS NOT NULL THEN
    SELECT c.commission_pct INTO v_pct
    FROM public.cities c
    WHERE c.name ILIKE v_city
    LIMIT 1;
  END IF;

  IF v_pct IS NULL OR v_pct <= 0 THEN
    v_pct := 10;
  END IF;

  SELECT COALESCE(
    NULLIF((m.quotation_data->>'delivery_charge')::numeric, 0), 0
  ) + COALESCE((m.quotation_data->>'booking_charge')::numeric, 0)
  INTO v_quote
  FROM public.messages m
  JOIN public.chat_rooms cr ON cr.id = m.chat_room_id
  WHERE cr.request_id = p_request_id
    AND m.message_type = 'quotation'
  ORDER BY m.created_at DESC
  LIMIT 1;

  v_charge := COALESCE(
    NULLIF(v_order.delivery_charge, 0),
    NULLIF(v_quote, 0),
    NULLIF(v_req.estimated_total_charge, 0),
    NULLIF(v_req.max_budget, 0),
    0
  );

  IF COALESCE(v_order.commission_amount, 0) > 0 THEN
    UPDATE public.orders
    SET status = 'completed', completed_at = COALESCE(completed_at, now())
    WHERE id = v_order.id;
    RETURN;
  END IF;

  IF v_charge <= 0 THEN
    IF v_order.id IS NOT NULL THEN
      UPDATE public.orders
      SET status = 'completed', completed_at = COALESCE(completed_at, now())
      WHERE id = v_order.id;
    END IF;
    RETURN;
  END IF;

  v_comm := ROUND(v_charge * v_pct / 100.0, 2);

  IF v_order.id IS NOT NULL THEN
    UPDATE public.orders
    SET
      delivery_charge = v_charge,
      commission_pct = v_pct,
      commission_amount = v_comm,
      dp_earnings = GREATEST(v_charge - v_comm, 0),
      status = 'completed',
      completed_at = COALESCE(completed_at, now())
    WHERE id = v_order.id;
  ELSIF v_dp IS NOT NULL AND v_req.user_id IS NOT NULL THEN
    INSERT INTO public.orders (
      request_id, user_id, dp_id, items_summary, item_cost,
      delivery_charge, commission_pct, commission_amount, dp_earnings,
      status, completed_at
    ) VALUES (
      p_request_id,
      v_req.user_id,
      v_dp,
      COALESCE(split_part(v_req.description, E'\n', 1), v_req.request_category, 'Delivery'),
      0,
      v_charge,
      v_pct,
      v_comm,
      GREATEST(v_charge - v_comm, 0),
      'completed',
      now()
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accrue_order_commission(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accrue_order_commission(uuid) TO anon;

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

  PERFORM public.accrue_order_commission(p_request_id);

  RETURN jsonb_build_object(
    'ok', true,
    'payment_accepted_at', (SELECT payment_accepted_at FROM public.requests WHERE id = p_request_id),
    'status', (SELECT status FROM public.requests WHERE id = p_request_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_dp_payment_accepted(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_dp_payment_accepted(uuid) TO anon;
