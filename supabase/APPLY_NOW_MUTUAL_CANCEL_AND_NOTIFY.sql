-- ============================================================================
-- PASTE INTO SUPABASE → SQL EDITOR → RUN
-- Adds mutual cancel for advance + notification_broadcasts schedule table
-- Also deploy edge function: notify-broadcast
-- ============================================================================

-- Mutual cancel for advance bookings + scheduled admin broadcasts

-- 1) Mutual cancel columns on requests
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS cancel_requested_by text,
  ADD COLUMN IF NOT EXISTS cancel_request_reason text,
  ADD COLUMN IF NOT EXISTS cancel_requested_at timestamptz;

COMMENT ON COLUMN requests.cancel_requested_by IS 'user | dp — party who requested mutual cancel on advance booking';

-- 2) Request mutual cancel (advance only once a DP is involved)
CREATE OR REPLACE FUNCTION request_mutual_cancel(
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

  -- Who is calling?
  IF v_uid = v_req.user_id THEN
    v_role := 'user';
    v_other := COALESCE(v_req.reserved_dp_id, v_req.accepted_dp_id);
  ELSIF v_uid = v_req.reserved_dp_id OR v_uid = v_req.accepted_dp_id THEN
    v_role := 'dp';
    v_other := v_req.user_id;
  ELSE
    RETURN json_build_object('success', false, 'error', 'Not a party on this order');
  END IF;

  -- No partner yet → user may cancel alone
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

  -- Already requested by the other party → confirm cancel
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

  -- Same party refreshing request
  IF v_req.cancel_requested_by = v_role THEN
    UPDATE requests SET
      cancel_request_reason = COALESCE(p_reason, cancel_request_reason),
      cancel_requested_at = now()
    WHERE id = p_request_id;
    RETURN json_build_object('success', true, 'cancelled', false, 'mode', 'pending', 'waiting_for', CASE WHEN v_role = 'user' THEN 'dp' ELSE 'user' END);
  END IF;

  -- New request from this party
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

GRANT EXECUTE ON FUNCTION request_mutual_cancel(uuid, text) TO authenticated;
NOTIFY pgrst, 'reload schema';

-- 3) Instant cancel (customer only)
CREATE OR REPLACE FUNCTION cancel_instant_order(
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
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_req FROM requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Request not found');
  END IF;

  IF v_req.user_id <> v_uid THEN
    RETURN json_build_object('success', false, 'error', 'Only the customer can cancel instant orders');
  END IF;

  IF COALESCE(v_req.order_type, 'instant') = 'advance' THEN
    RETURN json_build_object('success', false, 'error', 'Use mutual cancel for advance bookings');
  END IF;

  IF v_req.status NOT IN ('pending', 'accepted', 'confirmed', 'shopping', 'purchased') THEN
    RETURN json_build_object('success', false, 'error', 'This order can no longer be cancelled');
  END IF;

  UPDATE requests SET
    status = 'cancelled',
    cancellation_reason = COALESCE(p_reason, 'Cancelled by customer'),
    cancelled_by = 'customer'
  WHERE id = p_request_id;

  UPDATE orders SET status = 'cancelled' WHERE request_id = p_request_id;

  IF v_req.accepted_dp_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, body, type, related_id, notification_type)
    VALUES (
      v_req.accepted_dp_id,
      'Order cancelled',
      'The customer cancelled this instant order.',
      'order_status',
      p_request_id,
      'instant_cancelled'
    );
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_instant_order(uuid, text) TO authenticated;

-- 4) Scheduled / admin broadcast queue
CREATE TABLE IF NOT EXISTS notification_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  image_url text,
  target_type text NOT NULL CHECK (target_type IN ('broadcast', 'all_users', 'all_dps', 'single')),
  target_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  recipient_count integer DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

ALTER TABLE notification_broadcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "broadcasts_admin_all" ON notification_broadcasts;
CREATE POLICY "broadcasts_admin_all" ON notification_broadcasts FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_notification_broadcasts_pending
  ON notification_broadcasts (scheduled_for)
  WHERE status = 'pending';
