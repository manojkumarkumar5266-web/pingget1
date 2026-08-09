-- Allow advance booking chat message types used by reserve_dp_for_advance and ChatScreen.
-- Without this, Accept on advance bookings fails with a check-constraint error and never opens chat.
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_message_type_check
  CHECK (message_type IN (
    'text',
    'image',
    'voice',
    'location',
    'quotation',
    'order_summary',
    'advance_payment',
    'payment_proof'
  ));

-- Storage upserts need UPDATE; INSERT-only policy caused attachment upload failures.
DROP POLICY IF EXISTS "media_auth_update" ON storage.objects;
CREATE POLICY "media_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'media')
  WITH CHECK (bucket_id = 'media');

DROP POLICY IF EXISTS "media_auth_delete" ON storage.objects;
CREATE POLICY "media_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'media');

-- Harden reserve_dp_for_advance: idempotent + clearer errors; avoid optional notification columns.
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

  -- Idempotent: if this DP already reserved, return existing chat
  IF v_request.accepted_dp_id = p_dp_user_id
     AND v_request.status IN ('dp_reserved', 'waiting_payment', 'booking_confirmed') THEN
    SELECT id INTO v_room_id FROM chat_rooms WHERE request_id = p_request_id LIMIT 1;
    RETURN QUERY SELECT true, v_room_id, v_request.advance_payment_id, NULL::text;
    RETURN;
  END IF;

  IF v_request.status NOT IN ('searching_dp', 'no_dp_found') THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, 'Request is not in searching state (' || COALESCE(v_request.status, '?') || ')';
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
  ELSE
    UPDATE chat_rooms SET dp_id = p_dp_user_id WHERE id = v_room_id AND dp_id IS DISTINCT FROM p_dp_user_id;
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
    jsonb_build_object(
      'amount', v_fee,
      'deadline', v_deadline::text,
      'booking_id', p_request_id,
      'scheduled_date', v_request.scheduled_date,
      'scheduled_time', COALESCE(v_request.scheduled_slot, v_request.scheduled_time),
      'purpose', 'Advance Booking Confirmation',
      'status', 'waiting',
      'message', 'Please pay the Advance Confirmation Amount to reserve this booking.'
    )
  );

  INSERT INTO notifications (user_id, title, body, type, related_id)
  VALUES (
    v_request.user_id, 'Delivery Partner Reserved!',
    COALESCE(v_dp_name, 'A delivery partner') || ' has reserved your advance booking. Pay the confirmation amount to confirm.',
    'dp_reserved', p_request_id
  );

  INSERT INTO notifications (user_id, title, body, type, related_id)
  VALUES (
    p_dp_user_id, 'Advance Booking Reserved',
    'You reserved an advance booking for ' || COALESCE(v_user_name, 'a customer') || '. Waiting for payment confirmation.',
    'advance_reserved', p_request_id
  );

  RETURN QUERY SELECT true, v_room_id, v_payment_id, NULL::text;
END;
$function$;

GRANT EXECUTE ON FUNCTION reserve_dp_for_advance(uuid, uuid) TO authenticated;
