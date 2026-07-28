-- 1. Add email column to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND table_schema = 'public' AND column_name = 'email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email text;
  END IF;
END $$;

-- 2. Fix requests.title: make nullable with NULL default
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND table_schema = 'public' AND column_name = 'title'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE requests ALTER COLUMN title DROP NOT NULL;
    ALTER TABLE requests ALTER COLUMN title SET DEFAULT NULL;
  END IF;
END $$;

-- 3. Add gps_updated_at to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND table_schema = 'public' AND column_name = 'gps_updated_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN gps_updated_at timestamptz;
  END IF;
END $$;

-- 4. Add indexes
CREATE INDEX IF NOT EXISTS idx_delivery_partners_online
  ON delivery_partners(is_online) WHERE is_online = true;

CREATE INDEX IF NOT EXISTS idx_profiles_gps
  ON profiles(gps_lat, gps_lng)
  WHERE gps_lat IS NOT NULL AND gps_lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_requests_pending
  ON requests(status, created_at)
  WHERE status = 'pending';

-- 5. Fix requests UPDATE policy
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

-- 6. scan_nearby_dps: returns all nearby online approved DPs within radius
CREATE OR REPLACE FUNCTION scan_nearby_dps(
  p_user_lat double precision,
  p_user_lng double precision,
  p_radius_meters integer,
  p_request_id uuid DEFAULT NULL
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
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    dp.user_id,
    p.full_name,
    p.gps_lat,
    p.gps_lng,
    (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(p.gps_lat - p_user_lat) / 2) ^ 2 +
          cos(radians(p_user_lat)) * cos(radians(p.gps_lat)) *
          sin(radians(p.gps_lng - p_user_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(p.gps_lat - p_user_lat) / 2) ^ 2 +
          cos(radians(p_user_lat)) * cos(radians(p.gps_lat)) *
          sin(radians(p.gps_lng - p_user_lng) / 2) ^ 2
        ))
      )
    ) AS dist,
    dp.service_range_meters
  FROM delivery_partners dp
  JOIN profiles p ON p.id = dp.user_id
  WHERE dp.is_online = true
    AND dp.status = 'approved'
    AND p.gps_lat IS NOT NULL
    AND p.gps_lng IS NOT NULL
    AND (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(p.gps_lat - p_user_lat) / 2) ^ 2 +
          cos(radians(p_user_lat)) * cos(radians(p.gps_lat)) *
          sin(radians(p.gps_lng - p_user_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(p.gps_lat - p_user_lat) / 2) ^ 2 +
          cos(radians(p_user_lat)) * cos(radians(p.gps_lat)) *
          sin(radians(p.gps_lng - p_user_lng) / 2) ^ 2
        ))
      )
    ) <= p_radius_meters
    AND (
      p_request_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM requests r
        WHERE r.id = p_request_id
        AND r.declined_by @> ARRAY[dp.user_id]
      )
    );
END;
$function$;

-- 7. scan_nearby_dps_stats: aggregate stats for the scanning radar
CREATE OR REPLACE FUNCTION scan_nearby_dps_stats(
  p_user_lat double precision,
  p_user_lng double precision,
  p_radius_meters integer,
  p_request_id uuid DEFAULT NULL
)
RETURNS TABLE (
  dp_count bigint,
  avg_distance_meters double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  SELECT
    COUNT(*)::bigint,
    COALESCE(AVG(dist), 0)::double precision
  INTO
    dp_count, avg_distance_meters
  FROM scan_nearby_dps(p_user_lat, p_user_lng, p_radius_meters, p_request_id);
END;
$function$;

-- 8. get_nearby_requests: returns pending requests within DP's service range
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
    r.id,
    r.user_id,
    r.description,
    r.photo_urls,
    r.voice_note_url,
    r.preferred_shop,
    r.pickup_address,
    r.pickup_lat,
    r.pickup_lng,
    r.delivery_address,
    r.delivery_lat,
    r.delivery_lng,
    r.expected_time,
    r.max_budget,
    r.special_instructions,
    r.created_at,
    up.full_name,
    up.gps_lat,
    up.gps_lng,
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
  WHERE r.status = 'pending'
    AND NOT (r.declined_by @> ARRAY[p_dp_user_id])
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

-- 9. accept_request: atomic order acceptance (prevents race conditions)
CREATE OR REPLACE FUNCTION accept_request(
  p_request_id uuid,
  p_dp_user_id uuid
)
RETURNS TABLE (
  success boolean,
  chat_room_id uuid,
  error_msg text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_request RECORD;
  v_room_id uuid;
  v_dp_name text;
  v_user_name text;
BEGIN
  SELECT * INTO v_request
  FROM requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Request not found';
    RETURN;
  END IF;

  IF v_request.status != 'pending' THEN
    RETURN QUERY SELECT false, NULL::uuid, 'This request was already accepted by another delivery partner';
    RETURN;
  END IF;

  IF v_request.declined_by @> ARRAY[p_dp_user_id] THEN
    RETURN QUERY SELECT false, NULL::uuid, 'You declined this request earlier';
    RETURN;
  END IF;

  UPDATE requests
  SET status = 'accepted',
      accepted_dp_id = p_dp_user_id
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, 'This request was just accepted by another delivery partner';
    RETURN;
  END IF;

  SELECT full_name INTO v_dp_name FROM profiles WHERE id = p_dp_user_id;
  SELECT full_name INTO v_user_name FROM profiles WHERE id = v_request.user_id;

  SELECT id INTO v_room_id
  FROM chat_rooms
  WHERE request_id = p_request_id
  LIMIT 1;

  IF v_room_id IS NULL THEN
    INSERT INTO chat_rooms (request_id, user_id, dp_id)
    VALUES (p_request_id, v_request.user_id, p_dp_user_id)
    RETURNING id INTO v_room_id;
  END IF;

  INSERT INTO messages (chat_room_id, sender_id, message_type, quotation_data)
  VALUES (
    v_room_id,
    v_request.user_id,
    'order_summary',
    jsonb_build_object(
      'description', v_request.description,
      'preferred_shop', v_request.preferred_shop,
      'pickup_address', v_request.pickup_address,
      'delivery_address', v_request.delivery_address,
      'expected_time', v_request.expected_time,
      'photo_urls', v_request.photo_urls,
      'voice_note_url', v_request.voice_note_url,
      'delivery_lat', v_request.delivery_lat,
      'delivery_lng', v_request.delivery_lng
    )
  );

  INSERT INTO messages (chat_room_id, sender_id, content, message_type)
  VALUES (
    v_room_id,
    p_dp_user_id,
    COALESCE('Hi ' || v_user_name || '! I''m ' || v_dp_name || ' and I''ve accepted your delivery request. I can see your order details above — let me know if anything needs clarification!', 'Hello! I''ve accepted your delivery request.'),
    'text'
  );

  IF v_request.delivery_lat IS NOT NULL AND v_request.delivery_lng IS NOT NULL THEN
    INSERT INTO messages (chat_room_id, sender_id, content, message_type, location_lat, location_lng)
    VALUES (
      v_room_id,
      p_dp_user_id,
      COALESCE(v_request.delivery_address, 'Delivery location'),
      'location',
      v_request.delivery_lat,
      v_request.delivery_lng
    );
  END IF;

  INSERT INTO notifications (user_id, title, body, type, related_id)
  VALUES (
    v_request.user_id,
    'Request Accepted!',
    COALESCE(v_dp_name, 'A delivery partner') || ' accepted your request. Tap to open chat now.',
    'request_accepted',
    p_request_id
  );

  RETURN QUERY SELECT true, v_room_id, NULL::text;
END;
$function$;

-- 10. update_location: update caller's GPS
CREATE OR REPLACE FUNCTION update_location(
  p_lat double precision,
  p_lng double precision
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  UPDATE profiles
  SET gps_lat = p_lat,
      gps_lng = p_lng,
      gps_updated_at = now(),
      updated_at = now()
  WHERE id = auth.uid();
END;
$function$;

-- 11. Grant execute permissions
GRANT EXECUTE ON FUNCTION scan_nearby_dps(
    double precision,
    double precision,
    integer
) TO authenticated;

GRANT EXECUTE ON FUNCTION scan_nearby_dps(
    double precision,
    double precision,
    integer,
    uuid
) TO authenticated;

GRANT EXECUTE ON FUNCTION scan_nearby_dps_stats(
    double precision,
    double precision,
    integer,
    uuid
) TO authenticated;

GRANT EXECUTE ON FUNCTION get_nearby_requests(
    uuid
) TO authenticated;

GRANT EXECUTE ON FUNCTION accept_request(
    uuid,
    uuid
) TO authenticated;

GRANT EXECUTE ON FUNCTION update_location(
    double precision,
    double precision
) TO authenticated;