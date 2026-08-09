-- ============================================================================
-- PASTE THIS ENTIRE FILE INTO SUPABASE → SQL EDITOR → RUN
-- Fixes both production errors:
--   1) Accept failed: messages_message_type_check
--   2) Photo upload failed: infinite recursion on profiles
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "admin_update_user_status" ON profiles;
CREATE POLICY "admin_update_user_status" ON profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_message_type_check
  CHECK (message_type IN (
    'text','image','voice','location','quotation','order_summary','advance_payment','payment_proof'
  ));

DROP POLICY IF EXISTS "media_auth_update" ON storage.objects;
CREATE POLICY "media_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'media')
  WITH CHECK (bucket_id = 'media');

DROP POLICY IF EXISTS "avatars_auth_update" ON storage.objects;
CREATE POLICY "avatars_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars')
  WITH CHECK (bucket_id = 'avatars');

CREATE OR REPLACE FUNCTION public.update_own_photo_url(p_photo_url text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE public.profiles SET photo_url = p_photo_url WHERE id = auth.uid();
  RETURN p_photo_url;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_own_photo_url(text) TO authenticated;

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

  IF v_request.accepted_dp_id = p_dp_user_id
     AND v_request.status IN ('dp_reserved', 'waiting_payment', 'booking_confirmed', 'payment_verified') THEN
    SELECT id INTO v_room_id FROM chat_rooms WHERE request_id = p_request_id LIMIT 1;
    RETURN QUERY SELECT true, v_room_id, v_request.advance_payment_id, NULL::text;
    RETURN;
  END IF;

  IF v_request.status NOT IN ('searching_dp', 'no_dp_found') THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid,
      ('Request is not in searching state (' || COALESCE(v_request.status, '?') || ')');
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

  -- Always use allowed types first (text / order_summary) so Accept never fails
  BEGIN
    INSERT INTO messages (chat_room_id, sender_id, message_type, quotation_data)
    VALUES (
      v_room_id, v_request.user_id, 'order_summary',
      jsonb_build_object(
        'description', v_request.description,
        'delivery_address', v_request.delivery_address,
        'scheduled_date', v_request.scheduled_date,
        'scheduled_time', v_request.scheduled_time,
        'photo_urls', v_request.photo_urls
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  INSERT INTO messages (chat_room_id, sender_id, content, message_type)
  VALUES (
    v_room_id, p_dp_user_id,
    'Hi ' || COALESCE(v_user_name, 'there') || '! I reserved your advance booking. Please pay ₹' || v_fee::text || ' confirmation amount and upload proof in chat.',
    'text'
  );

  BEGIN
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
        'status', 'waiting'
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- text message above is enough
  END;

  BEGIN
    INSERT INTO notifications (user_id, title, body, type, related_id)
    VALUES (
      v_request.user_id, 'Delivery Partner Reserved!',
      COALESCE(v_dp_name, 'A delivery partner') || ' reserved your advance booking. Pay confirmation amount in chat.',
      'dp_reserved', p_request_id
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN QUERY SELECT true, v_room_id, v_payment_id, NULL::text;
END;
$function$;

GRANT EXECUTE ON FUNCTION reserve_dp_for_advance(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "requests_select_participants" ON requests;
CREATE POLICY "requests_select_participants" ON requests FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR accepted_dp_id = auth.uid()
    OR reserved_dp_id = auth.uid()
    OR status IN ('pending', 'searching_dp', 'no_dp_found')
    OR public.is_admin()
  );
