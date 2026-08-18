-- Ensure mutual cancel RPC exists (fixes PostgREST "schema cache" errors on reserved advance cancel)
-- Safe to re-run.

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS cancel_requested_by text,
  ADD COLUMN IF NOT EXISTS cancel_request_reason text,
  ADD COLUMN IF NOT EXISTS cancel_requested_at timestamptz;

CREATE OR REPLACE FUNCTION public.request_mutual_cancel(
  p_request_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req requests%ROWTYPE;
  v_role text;
  v_other uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_req FROM requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Request not found');
  END IF;

  IF v_req.status IN ('cancelled', 'completed', 'expired') THEN
    RETURN json_build_object('success', false, 'error', 'Order already closed');
  END IF;

  IF COALESCE(v_req.order_type, 'instant') <> 'advance' THEN
    RETURN json_build_object('success', false, 'error', 'Use normal cancel for instant orders');
  END IF;

  IF v_uid = v_req.user_id THEN
    v_role := 'user';
    v_other := COALESCE(v_req.reserved_dp_id, v_req.accepted_dp_id);
  ELSIF v_uid = v_req.reserved_dp_id OR v_uid = v_req.accepted_dp_id THEN
    v_role := 'dp';
    v_other := v_req.user_id;
  ELSE
    RETURN json_build_object('success', false, 'error', 'Not a party on this order');
  END IF;

  IF v_role = 'user' AND v_other IS NULL THEN
    UPDATE requests SET
      status = 'cancelled',
      cancellation_reason = COALESCE(p_reason, 'Cancelled before partner reserved'),
      cancelled_by = 'customer',
      cancel_requested_by = NULL,
      cancel_request_reason = NULL,
      cancel_requested_at = NULL
    WHERE id = p_request_id;
    RETURN json_build_object('success', true, 'cancelled', true, 'mode', 'solo');
  END IF;

  IF v_req.cancel_requested_by IS NOT NULL AND v_req.cancel_requested_by <> v_role THEN
    UPDATE requests SET
      status = 'cancelled',
      cancellation_reason = COALESCE(p_reason, v_req.cancel_request_reason, 'Cancelled by mutual agreement'),
      cancelled_by = 'mutual',
      cancel_requested_by = NULL,
      cancel_request_reason = NULL,
      cancel_requested_at = NULL
    WHERE id = p_request_id;

    UPDATE orders SET status = 'cancelled' WHERE request_id = p_request_id;

    IF v_other IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, body, type, related_id, notification_type)
      VALUES (
        v_other,
        'Booking cancelled',
        'This advance booking was cancelled by mutual agreement.',
        'order_status',
        p_request_id,
        'advance_cancel_confirmed'
      );
    END IF;

    RETURN json_build_object('success', true, 'cancelled', true, 'mode', 'mutual');
  END IF;

  IF v_req.cancel_requested_by = v_role THEN
    UPDATE requests SET
      cancel_request_reason = COALESCE(p_reason, cancel_request_reason),
      cancel_requested_at = now()
    WHERE id = p_request_id;
    RETURN json_build_object('success', true, 'cancelled', false, 'mode', 'pending', 'waiting_for', CASE WHEN v_role = 'user' THEN 'dp' ELSE 'user' END);
  END IF;

  UPDATE requests SET
    cancel_requested_by = v_role,
    cancel_request_reason = p_reason,
    cancel_requested_at = now()
  WHERE id = p_request_id;

  IF v_other IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, body, type, related_id, notification_type)
    VALUES (
      v_other,
      'Cancel requested',
      CASE WHEN v_role = 'user'
        THEN 'Customer requested to cancel this advance booking. Open Orders to agree or ignore.'
        ELSE 'Partner requested to cancel this advance booking. Open Orders to agree or ignore.'
      END,
      'order_status',
      p_request_id,
      'advance_cancel_request'
    );
  END IF;

  RETURN json_build_object('success', true, 'cancelled', false, 'mode', 'pending', 'waiting_for', CASE WHEN v_role = 'user' THEN 'dp' ELSE 'user' END);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_mutual_cancel(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_mutual_cancel(uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';
