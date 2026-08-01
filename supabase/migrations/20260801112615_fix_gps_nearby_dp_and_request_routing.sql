/*
# Fix GPS, Nearby DP Detection, and Order Request Routing

## Problem
The core database functions needed for the entire delivery matching flow were
missing from the live database. The frontend called scan_nearby_dps,
get_nearby_requests, update_location, and accept_request via supabase.rpc(),
but none existed — so every call failed silently and:
  - Users never saw nearby delivery partners on the scanning page
  - Delivery partners never received user order requests
  - GPS coordinates were never saved to profiles
  - DP accept always failed

Additionally:
  - profiles.gps_updated_at column was missing (update_location references it)
  - messages CHECK constraint lacked 'order_summary' (accept_request inserts one)
  - delivery_partners and orders were not in the realtime publication

## Changes

### 1. Add gps_updated_at column to profiles
   - Needed by update_location to track when GPS was last refreshed.

### 2. Add 'order_summary' to messages message_type CHECK constraint
   - accept_request inserts an order_summary message; without this the
     entire accept transaction rolls back and DPs can never accept orders.

### 3. Add delivery_partners and orders to supabase_realtime publication
   - So DP online/offline toggles and order status changes push instantly
     to subscribed clients.

### 4. Create scan_nearby_dps function
   - Returns online approved DPs within a radius of the user's GPS.
   - Includes vehicle_type for rendering correct vehicle icons.
   - Excludes DPs who already declined the specific request.
   - SECURITY DEFINER, SET search_path = public.

### 5. Create scan_nearby_dps_stats function
   - Returns aggregate count and average distance for the scanning radar.

### 6. Create get_nearby_requests function
   - Returns pending requests within a DP's service range.
   - Uses DP's GPS + service_range_meters for filtering.
   - Excludes requests the DP already declined.

### 7. Create update_location function
   - Updates the caller's GPS coordinates in profiles.
   - Uses auth.uid() so only the authenticated user can update their own GPS.

### 8. Create accept_request function
   - Atomically accepts a delivery request (prevents race conditions).
   - Creates/updates chat room, inserts order_summary + welcome messages.
   - Sends notification to the user.

### 9. Add indexes for performance
   - delivery_partners online status
   - profiles GPS coordinates
   - requests pending status

## Security
   - All functions are SECURITY DEFINER with SET search_path = public.
   - update_location uses auth.uid() — only the caller can update their own GPS.
   - accept_request uses FOR UPDATE lock to prevent race conditions.
   - No RLS policy changes.
*/

-- 1. Add gps_updated_at to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND table_schema = 'public' AND column_name = 'gps_updated_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN gps_updated_at timestamptz;
  END IF;
END $$;

-- 2. Fix messages CHECK constraint to allow 'order_summary'
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_message_type_check
  CHECK (message_type IN ('text','image','voice','location','quotation','order_summary'));

-- 3. Add delivery_partners and orders to realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'delivery_partners'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE delivery_partners;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  END IF;
END $$;

-- 4. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_delivery_partners_online
  ON delivery_partners(is_online) WHERE is_online = true;

CREATE INDEX IF NOT EXISTS idx_profiles_gps
  ON profiles(gps_lat, gps_lng)
  WHERE gps_lat IS NOT NULL AND gps_lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_requests_pending
  ON requests(status, created_at)
  WHERE status = 'pending';

-- 5. scan_nearby_dps: returns all nearby online approved DPs within radius
DROP FUNCTION IF EXISTS public.scan_nearby_dps(double precision, double precision, integer);
DROP FUNCTION IF EXISTS public.scan_nearby_dps(double precision, double precision, integer, uuid);

CREATE OR REPLACE FUNCTION public.scan_nearby_dps(
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
  service_range_meters integer,
  vehicle_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    dp.service_range_meters,
    dp.vehicle_type
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

-- 6. scan_nearby_dps_stats: aggregate stats for the scanning radar
CREATE OR REPLACE FUNCTION public.scan_nearby_dps_stats(
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
SET search_path = public
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

-- 7. get_nearby_requests: returns pending requests within DP's service range
CREATE OR REPLACE FUNCTION public.get_nearby_requests(
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

-- 8. update_location: update caller's GPS coordinates
CREATE OR REPLACE FUNCTION public.update_location(
  p_lat double precision,
  p_lng double precision
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- 9. accept_request: atomic order acceptance (prevents race conditions)
CREATE OR REPLACE FUNCTION public.accept_request(
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
SET search_path = public
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

-- 10. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.scan_nearby_dps(
    double precision,
    double precision,
    integer,
    uuid
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.scan_nearby_dps_stats(
    double precision,
    double precision,
    integer,
    uuid
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_nearby_requests(
    uuid
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.accept_request(
    uuid,
    uuid
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.update_location(
    double precision,
    double precision
) TO authenticated;
