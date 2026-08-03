/*
# Advance Request V3 — Additive Upgrade

1. Purpose
   Upgrades the existing PingGET database to support the V3 reservation-based advance request flow
   without touching any existing tables, columns, migrations, or business logic.
   All statements use IF NOT EXISTS / CREATE OR REPLACE so re-running is safe.

2. New Columns on `requests` (added only if missing)
   - reserved_dp_id, reserved_at, payment_deadline, advance_payment_id,
     search_radius_current, dp_cancelled_count, task_started_at, task_completed_at

3. New Columns on `advance_settings` (added only if missing)
   - confirmation_fee, reservation_search_radius_meters, payment_deadline_minutes,
     dp_cancel_research, min_advance_buffer_minutes

4. New Columns on `messages` — advance_payment_id
5. New Columns on `notifications` — image_url, route, entity_id, notification_type, read_at, deleted_at
6. New Tables — advance_payments, device_tokens, notification_delivery_logs
7. New RPCs — search_available_dps_for_advance, reserve_dp_for_advance, retry_search_for_advance
8. Modified RPC — get_nearby_requests (signature unchanged, now also returns 'searching_dp' requests)
*/

-- 1. ADD COLUMNS TO requests
ALTER TABLE requests ADD COLUMN IF NOT EXISTS reserved_dp_id uuid;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS reserved_at timestamptz;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS payment_deadline timestamptz;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS advance_payment_id uuid;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS search_radius_current int;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS dp_cancelled_count int DEFAULT 0;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS task_started_at timestamptz;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS task_completed_at timestamptz;

-- 2. ADD COLUMNS TO advance_settings
ALTER TABLE advance_settings ADD COLUMN IF NOT EXISTS confirmation_fee numeric DEFAULT 50;
ALTER TABLE advance_settings ADD COLUMN IF NOT EXISTS reservation_search_radius_meters int DEFAULT 5000;
ALTER TABLE advance_settings ADD COLUMN IF NOT EXISTS payment_deadline_minutes int DEFAULT 30;
ALTER TABLE advance_settings ADD COLUMN IF NOT EXISTS dp_cancel_research boolean DEFAULT true;
ALTER TABLE advance_settings ADD COLUMN IF NOT EXISTS min_advance_buffer_minutes int DEFAULT 60;

-- 3. ADD COLUMNS TO messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS advance_payment_id uuid;

-- 4. ADD COLUMNS TO notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS route text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_id uuid;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notification_type text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at timestamptz;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 5. CREATE advance_payments TABLE
CREATE TABLE IF NOT EXISTS advance_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  chat_room_id uuid REFERENCES chat_rooms(id) ON DELETE SET NULL,
  dp_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  payment_deadline timestamptz,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','proof_uploaded','verified','rejected','expired')),
  screenshot_url text,
  upi_ref text,
  transaction_id text,
  customer_remarks text,
  uploaded_at timestamptz,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  reject_reason text,
  admin_override boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE advance_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "advance_payments_select_participants" ON advance_payments;
CREATE POLICY "advance_payments_select_participants" ON advance_payments FOR SELECT
  TO authenticated USING (customer_id = auth.uid() OR dp_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "advance_payments_insert_participants" ON advance_payments;
CREATE POLICY "advance_payments_insert_participants" ON advance_payments FOR INSERT
  TO authenticated WITH CHECK (customer_id = auth.uid() OR dp_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "advance_payments_update_participants" ON advance_payments;
CREATE POLICY "advance_payments_update_participants" ON advance_payments FOR UPDATE
  TO authenticated USING (customer_id = auth.uid() OR dp_id = auth.uid() OR public.is_admin())
  WITH CHECK (customer_id = auth.uid() OR dp_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "advance_payments_delete_admin" ON advance_payments;
CREATE POLICY "advance_payments_delete_admin" ON advance_payments FOR DELETE
  TO authenticated USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_advance_payments_request ON advance_payments(request_id);
CREATE INDEX IF NOT EXISTS idx_advance_payments_status ON advance_payments(status);

-- 6. CREATE device_tokens TABLE
CREATE TABLE IF NOT EXISTS device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text,
  app_version text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "device_tokens_select_own" ON device_tokens;
CREATE POLICY "device_tokens_select_own" ON device_tokens FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "device_tokens_insert_own" ON device_tokens;
CREATE POLICY "device_tokens_insert_own" ON device_tokens FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "device_tokens_update_own" ON device_tokens;
CREATE POLICY "device_tokens_update_own" ON device_tokens FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "device_tokens_delete_own" ON device_tokens;
CREATE POLICY "device_tokens_delete_own" ON device_tokens FOR DELETE
  TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_token ON device_tokens(token);

-- 7. CREATE notification_delivery_logs TABLE
CREATE TABLE IF NOT EXISTS notification_delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES notifications(id) ON DELETE SET NULL,
  device_token_id uuid REFERENCES device_tokens(id) ON DELETE SET NULL,
  token text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  fcm_message_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notification_delivery_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_logs_select_own_admin" ON notification_delivery_logs;
CREATE POLICY "notif_logs_select_own_admin" ON notification_delivery_logs FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM device_tokens dt WHERE dt.id = notification_delivery_logs.device_token_id AND dt.user_id = auth.uid())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "notif_logs_insert_own" ON notification_delivery_logs;
CREATE POLICY "notif_logs_insert_own" ON notification_delivery_logs FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_notif_logs_notification ON notification_delivery_logs(notification_id);

-- 8. ADD FK from requests.advance_payment_id to advance_payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'requests_advance_payment_id_fkey'
      AND table_name = 'requests' AND table_schema = 'public'
  ) THEN
    ALTER TABLE requests ADD CONSTRAINT requests_advance_payment_id_fkey
      FOREIGN KEY (advance_payment_id) REFERENCES advance_payments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 9. RPC: search_available_dps_for_advance
CREATE OR REPLACE FUNCTION search_available_dps_for_advance(
  p_request_id uuid
)
RETURNS TABLE (
  dp_user_id uuid,
  full_name text,
  gps_lat double precision,
  gps_lng double precision,
  distance_meters double precision,
  service_range_meters integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_request RECORD;
  v_settings RECORD;
  v_radius integer;
  v_lat double precision;
  v_lng double precision;
BEGIN
  SELECT * INTO v_request FROM requests WHERE id = p_request_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_lat := COALESCE(v_request.pickup_lat, v_request.delivery_lat);
  v_lng := COALESCE(v_request.pickup_lng, v_request.delivery_lng);
  IF v_lat IS NULL OR v_lng IS NULL THEN RETURN; END IF;

  SELECT * INTO v_settings FROM advance_settings LIMIT 1;
  v_radius := COALESCE(v_request.search_radius_current, v_settings.reservation_search_radius_meters, 5000);

  RETURN QUERY
  SELECT
    dp.user_id,
    p.full_name,
    p.gps_lat,
    p.gps_lng,
    (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(p.gps_lat - v_lat) / 2) ^ 2 +
          cos(radians(v_lat)) * cos(radians(p.gps_lat)) *
          sin(radians(p.gps_lng - v_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(p.gps_lat - v_lat) / 2) ^ 2 +
          cos(radians(v_lat)) * cos(radians(p.gps_lat)) *
          sin(radians(p.gps_lng - v_lng) / 2) ^ 2
        ))
      )
    ) AS dist,
    dp.service_range_meters
  FROM delivery_partners dp
  JOIN profiles p ON p.id = dp.user_id
  WHERE dp.is_online = true
    AND dp.status = 'approved'
    AND p.gps_lat IS NOT NULL AND p.gps_lng IS NOT NULL
    AND NOT (v_request.declined_by @> ARRAY[dp.user_id])
    AND dp.user_id != v_request.user_id
    AND (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(p.gps_lat - v_lat) / 2) ^ 2 +
          cos(radians(v_lat)) * cos(radians(p.gps_lat)) *
          sin(radians(p.gps_lng - v_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(p.gps_lat - v_lat) / 2) ^ 2 +
          cos(radians(v_lat)) * cos(radians(p.gps_lat)) *
          sin(radians(p.gps_lng - v_lng) / 2) ^ 2
        ))
      )
    ) <= v_radius
  ORDER BY dist ASC;
END;
$function$;

GRANT EXECUTE ON FUNCTION search_available_dps_for_advance(uuid) TO authenticated;

-- 10. RPC: reserve_dp_for_advance
CREATE OR REPLACE FUNCTION reserve_dp_for_advance(
  p_request_id uuid,
  p_dp_user_id uuid
)
RETURNS TABLE (
  success boolean,
  chat_room_id uuid,
  advance_payment_id uuid,
  error_msg text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_request RECORD;
  v_settings RECORD;
  v_room_id uuid;
  v_dp_name text;
  v_user_name text;
  v_payment_id uuid;
  v_deadline timestamptz;
  v_fee numeric;
  v_deadline_minutes integer;
BEGIN
  SELECT * INTO v_request FROM requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, 'Request not found';
    RETURN;
  END IF;

  IF v_request.status NOT IN ('searching_dp', 'no_dp_found') THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, 'Request is not in searching state';
    RETURN;
  END IF;

  IF v_request.declined_by @> ARRAY[p_dp_user_id] THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, 'You declined this request';
    RETURN;
  END IF;

  SELECT * INTO v_settings FROM advance_settings LIMIT 1;
  v_fee := COALESCE(v_settings.confirmation_fee, 50);
  v_deadline_minutes := COALESCE(v_settings.payment_deadline_minutes, 30);
  v_deadline := now() + (v_deadline_minutes || ' minutes')::interval;

  UPDATE requests
  SET status = 'dp_reserved',
      reserved_dp_id = p_dp_user_id,
      reserved_at = now(),
      accepted_dp_id = p_dp_user_id,
      payment_deadline = v_deadline
  WHERE id = p_request_id;

  SELECT full_name INTO v_dp_name FROM profiles WHERE id = p_dp_user_id;
  SELECT full_name INTO v_user_name FROM profiles WHERE id = v_request.user_id;

  SELECT id INTO v_room_id FROM chat_rooms WHERE request_id = p_request_id LIMIT 1;
  IF v_room_id IS NULL THEN
    INSERT INTO chat_rooms (request_id, user_id, dp_id)
    VALUES (p_request_id, v_request.user_id, p_dp_user_id)
    RETURNING id INTO v_room_id;
  END IF;

  INSERT INTO advance_payments (request_id, chat_room_id, dp_id, customer_id, amount, payment_deadline, status)
  VALUES (p_request_id, v_room_id, p_dp_user_id, v_request.user_id, v_fee, v_deadline, 'waiting')
  RETURNING id INTO v_payment_id;

  UPDATE requests SET advance_payment_id = v_payment_id WHERE id = p_request_id;

  INSERT INTO messages (chat_room_id, sender_id, message_type, quotation_data)
  VALUES (
    v_room_id, v_request.user_id, 'order_summary',
    jsonb_build_object(
      'description', v_request.description,
      'preferred_shop', v_request.preferred_shop,
      'pickup_address', v_request.pickup_address,
      'delivery_address', v_request.delivery_address,
      'scheduled_date', v_request.scheduled_date,
      'scheduled_time', v_request.scheduled_time,
      'photo_urls', v_request.photo_urls,
      'voice_note_url', v_request.voice_note_url
    )
  );

  INSERT INTO messages (chat_room_id, sender_id, content, message_type)
  VALUES (
    v_room_id, p_dp_user_id,
    COALESCE('Hi ' || v_user_name || '! I''ve reserved your advance booking. Please pay the Advance Confirmation Amount to confirm this booking.', 'Hello! Please pay the confirmation amount to confirm.'),
    'text'
  );

  INSERT INTO messages (chat_room_id, sender_id, message_type, advance_payment_id, quotation_data)
  VALUES (
    v_room_id, p_dp_user_id, 'advance_payment', v_payment_id,
    jsonb_build_object('amount', v_fee, 'deadline', v_deadline::text, 'message', 'Please pay the Advance Confirmation Amount to reserve this booking.')
  );

  INSERT INTO notifications (user_id, title, body, type, related_id, route, entity_id, notification_type)
  VALUES (
    v_request.user_id, 'Delivery Partner Reserved!',
    COALESCE(v_dp_name, 'A delivery partner') || ' has reserved your advance booking. Pay the confirmation amount to confirm.',
    'dp_reserved', p_request_id, 'chat', v_room_id, 'dp_reserved'
  );

  INSERT INTO notifications (user_id, title, body, type, related_id, route, entity_id, notification_type)
  VALUES (
    p_dp_user_id, 'Advance Booking Reserved',
    'You reserved an advance booking for ' || COALESCE(v_user_name, 'a customer') || '. Waiting for payment confirmation.',
    'advance_reserved', p_request_id, 'chat', v_room_id, 'advance_reserved'
  );

  RETURN QUERY SELECT true, v_room_id, v_payment_id, NULL::text;
END;
$function$;

GRANT EXECUTE ON FUNCTION reserve_dp_for_advance(uuid, uuid) TO authenticated;

-- 11. RPC: retry_search_for_advance
CREATE OR REPLACE FUNCTION retry_search_for_advance(
  p_request_id uuid
)
RETURNS TABLE (
  success boolean,
  new_radius integer,
  found_dps integer,
  error_msg text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_request RECORD;
  v_settings RECORD;
  v_new_radius integer;
  v_dp_count integer;
BEGIN
  SELECT * INTO v_request FROM requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0, 'Request not found';
    RETURN;
  END IF;

  IF v_request.order_type != 'advance' THEN
    RETURN QUERY SELECT false, 0, 0, 'Not an advance request';
    RETURN;
  END IF;

  IF v_request.status NOT IN ('searching_dp', 'no_dp_found', 'dp_reserved') THEN
    RETURN QUERY SELECT false, 0, 0, 'Request is not in a retryable state';
    RETURN;
  END IF;

  SELECT * INTO v_settings FROM advance_settings LIMIT 1;
  IF NOT FOUND THEN
    v_new_radius := COALESCE(v_request.search_radius_current, 5000) + 1000;
  ELSE
    IF NOT COALESCE(v_settings.expand_search_radius, false) THEN
      RETURN QUERY SELECT false, COALESCE(v_request.search_radius_current, 5000), 0, 'Radius expansion is disabled';
      RETURN;
    END IF;

    v_new_radius := COALESCE(v_request.search_radius_current, v_settings.reservation_search_radius_meters, 5000)
      + COALESCE(v_settings.search_radius_increment_meters, 1000);

    IF v_new_radius > COALESCE(v_settings.max_search_radius_meters, 20000) THEN
      v_new_radius := COALESCE(v_settings.max_search_radius_meters, 20000);
    END IF;
  END IF;

  UPDATE requests
  SET search_radius_current = v_new_radius,
      status = 'searching_dp',
      reserved_dp_id = NULL,
      reserved_at = NULL,
      dp_cancelled_count = COALESCE(dp_cancelled_count, 0) + 1
  WHERE id = p_request_id;

  SELECT COUNT(*)::integer INTO v_dp_count
  FROM search_available_dps_for_advance(p_request_id);

  IF v_dp_count = 0 THEN
    UPDATE requests SET status = 'no_dp_found' WHERE id = p_request_id;
  END IF;

  RETURN QUERY SELECT true, v_new_radius, v_dp_count, NULL::text;
END;
$function$;

GRANT EXECUTE ON FUNCTION retry_search_for_advance(uuid) TO authenticated;

-- 12. UPDATE get_nearby_requests for V3 — drop and recreate (same signature)
DROP FUNCTION IF EXISTS get_nearby_requests(uuid);

CREATE OR REPLACE FUNCTION get_nearby_requests(
  p_dp_user_id uuid
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  description text,
  photo_urls text[],
  voice_note_url text,
  preferred_shop text,
  pickup_address text,
  pickup_lat double precision,
  pickup_lng double precision,
  delivery_address text,
  delivery_lat double precision,
  delivery_lng double precision,
  expected_time text,
  max_budget numeric,
  special_instructions text,
  created_at timestamptz,
  user_full_name text,
  user_gps_lat double precision,
  user_gps_lng double precision,
  distance_meters double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_dp_lat double precision;
  v_dp_lng double precision;
  v_service_range integer;
BEGIN
  SELECT p.gps_lat, p.gps_lng, dp.service_range_meters
  INTO v_dp_lat, v_dp_lng, v_service_range
  FROM delivery_partners dp
  JOIN profiles p ON p.id = dp.user_id
  WHERE dp.user_id = p_dp_user_id
    AND dp.is_online = true
    AND dp.status = 'approved';

  IF v_dp_lat IS NULL OR v_dp_lng IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    r.id, r.user_id, r.description, r.photo_urls, r.voice_note_url,
    r.preferred_shop, r.pickup_address, r.pickup_lat, r.pickup_lng,
    r.delivery_address, r.delivery_lat, r.delivery_lng, r.expected_time,
    r.max_budget, r.special_instructions, r.created_at,
    up.full_name, up.gps_lat, up.gps_lng,
    (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(COALESCE(r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(COALESCE(r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ))
      )
    ) AS dist
  FROM requests r
  JOIN profiles up ON up.id = r.user_id
  WHERE (r.status = 'pending' OR r.status = 'searching_dp')
    AND NOT (r.declined_by @> ARRAY[p_dp_user_id])
    AND r.user_id != p_dp_user_id
    AND (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(COALESCE(r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(COALESCE(r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ))
      )
    ) <= v_service_range
  ORDER BY r.created_at DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION get_nearby_requests TO authenticated;