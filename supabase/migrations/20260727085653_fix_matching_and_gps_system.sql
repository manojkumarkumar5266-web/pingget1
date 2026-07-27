/*
# Fix Real-Time GPS Order Matching, Distance Calculation, and Atomic Accept

## Problem Summary
1. The `scan_nearby_dps` RPC function referenced by the frontend does NOT exist in the database,
   so the user scanning page always finds zero delivery partners.
2. There is no server-side function to fetch nearby requests for a DP based on GPS distance.
3. Order acceptance is done client-side with a simple UPDATE, which is prone to race conditions
   (two DPs could accept the same order simultaneously).
4. The `profiles` table is missing the `email` column that the frontend and edge functions reference.
5. The `requests.title` column is NOT NULL with no default, but the frontend no longer sends a title.
6. The `requests_update_own_or_dp` RLS policy allows ANY authenticated user to update ANY pending
   request — a security hole that enables cross-user tampering.
7. There is no function to atomically update a user/DP GPS location.
8. No index exists on `delivery_partners.is_online` or `profiles.gps_lat` for efficient nearby queries.

## Changes

### 1. Add `email` column to `profiles`
- New column `email` (text, nullable) on `profiles` so edge functions and frontend can read/write it.

### 2. Fix `requests.title` column
- Alter `title` to be nullable (drop the NOT NULL constraint) since the frontend no longer sends it.
- Set a default of `NULL` so inserts that omit `title` succeed.

### 3. Create `scan_nearby_dps` function
- SECURITY DEFINER function that finds all delivery partners who are:
  (a) online (`is_online = true`),
  (b) have an approved status,
  (c) have non-null GPS coordinates,
  (d) are within `p_radius_meters` of the given user coordinates (Haversine distance),
  (e) have NOT declined the request identified by `p_request_id`.
- Returns a set of rows with: dp_user_id, full_name, gps_lat, gps_lng, distance_meters, service_range_meters.
- Also returns aggregate stats (dp_count, avg_distance_meters) via a separate wrapper or the frontend
  can count the rows.

### 4. Create `scan_nearby_dps_stats` function
- Returns a single row with `dp_count` and `avg_distance_meters` for the scanning page radar.

### 5. Create `get_nearby_requests` function
- SECURITY DEFINER function for DPs: given the DP's user ID and GPS coordinates, returns all
  pending requests where the Haversine distance between the DP and the request's pickup location
  is within the DP's `service_range_meters`, and the DP has not already declined the request.
- This replaces the client-side "fetch all + filter" approach with server-side distance filtering.

### 6. Create `accept_request` function
- SECURITY DEFINER atomic function that:
  (a) Locks the request row with `FOR UPDATE`.
  (b) Checks that `status = 'pending'`.
  (c) Updates the request to `status = 'accepted'`, `accepted_dp_id = p_dp_id`.
  (d) Creates a chat room if one doesn't exist.
  (e) Inserts an order_summary message.
  (f) Inserts a notification for the user.
  (g) Returns the chat room ID so the DP can navigate to chat.
- This prevents race conditions: if two DPs call this simultaneously, only the first succeeds;
  the second gets a clear error.

### 7. Create `update_location` function
- SECURITY DEFINER function that updates `profiles.gps_lat` and `profiles.gps_lng` for the
  authenticated user. Also updates `updated_at` timestamp.

### 8. Fix `requests_update_own_or_dp` RLS policy
- Drop the old policy that allowed any authenticated user to update any pending request.
- Create a new policy that only allows:
  (a) The request owner (user_id = auth.uid()) to update.
  (b) The accepted DP (accepted_dp_id = auth.uid()) to update.
  (c) Admins to update.
- DPs can no longer update a request they haven't accepted — they must use `accept_request()`.

### 9. Add indexes
- `idx_delivery_partners_online` on `delivery_partners(is_online)` for nearby DP queries.
- `idx_profiles_gps` on `profiles(gps_lat, gps_lng)` for location-based lookups.
- `idx_requests_pending` on `requests(status, created_at)` for the pending requests feed.

### 10. Add `gps_updated_at` column to `profiles`
- Tracks when GPS was last updated, enabling stale location detection.

## Security
- All new functions are SECURITY DEFINER so they can read across tables that RLS would otherwise restrict.
- The `accept_request` function is the ONLY way a DP can accept an order — the RLS policy no longer
  allows direct updates to pending requests by non-owners.
- `update_location` only updates the caller's own row.
*/

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

-- 10. Add gps_updated_at to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND table_schema = 'public' AND column_name = 'gps_updated_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN gps_updated_at timestamptz;
  END IF;
END $$;

-- 9. Add indexes
CREATE INDEX IF NOT EXISTS idx_delivery_partners_online
  ON delivery_partners(is_online) WHERE is_online = true;

CREATE INDEX IF NOT EXISTS idx_profiles_gps
  ON profiles(gps_lat, gps_lng)
  WHERE gps_lat IS NOT NULL AND gps_lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_requests_pending
  ON requests(status, created_at)
  WHERE status = 'pending';

-- 8. Fix requests UPDATE policy
DROP POLICY IF EXISTS "requests_update_own_or_dp" ON requests;
DROP POLICY IF EXISTS "requests_update_own_accepted_dp" ON requests;

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

-- 3. scan_nearby_dps: returns all nearby online approved DPs within radius
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

-- 4. scan_nearby_dps_stats: aggregate stats for the scanning radar
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

-- 5. get_nearby_requests: returns pending requests within DP's service range
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
  -- Get DP's GPS and service range
  SELECT p.gps_lat, p.gps_lng, dp.service_range_meters
  INTO v_dp_lat, v_dp_lng, v_service_range
  FROM delivery_partners dp
  JOIN profiles p ON p.id = dp.user_id
  WHERE dp.user_id = p_dp_user_id
    AND dp.is_online = true
    AND dp.status = 'approved';

  -- If DP has no GPS or is not online, return nothing
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

-- 6. accept_request: atomic order acceptance
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
  -- Lock the request row to prevent race conditions
  SELECT * INTO v_request
  FROM requests
  WHERE id = p_request_id
  FOR UPDATE;

  -- Check if request exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Request not found';
    RETURN;
  END IF;

  -- Check if still pending
  IF v_request.status != 'pending' THEN
    RETURN QUERY SELECT false, NULL::uuid, 'This request was already accepted by another delivery partner';
    RETURN;
  END IF;

  -- Check if DP declined this request
  IF v_request.declined_by @> ARRAY[p_dp_user_id] THEN
    RETURN QUERY SELECT false, NULL::uuid, 'You declined this request earlier';
    RETURN;
  END IF;

  -- Atomically update the request
  UPDATE requests
  SET status = 'accepted',
      accepted_dp_id = p_dp_user_id
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, 'This request was just accepted by another delivery partner';
    RETURN;
  END IF;

  -- Get names for chat/notifications
  SELECT full_name INTO v_dp_name FROM profiles WHERE id = p_dp_user_id;
  SELECT full_name INTO v_user_name FROM profiles WHERE id = v_request.user_id;

  -- Create or reuse chat room
  SELECT id INTO v_room_id
  FROM chat_rooms
  WHERE request_id = p_request_id
  LIMIT 1;

  IF v_room_id IS NULL THEN
    INSERT INTO chat_rooms (request_id, user_id, dp_id)
    VALUES (p_request_id, v_request.user_id, p_dp_user_id)
    RETURNING id INTO v_room_id;
  END IF;

  -- Insert order summary message
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

  -- Insert greeting message from DP
  INSERT INTO messages (chat_room_id, sender_id, content, message_type)
  VALUES (
    v_room_id,
    p_dp_user_id,
    COALESCE('Hi ' || v_user_name || '! I''m ' || v_dp_name || ' and I''ve accepted your delivery request. I can see your order details above — let me know if anything needs clarification!', 'Hello! I''ve accepted your delivery request.'),
    'text'
  );

  -- Insert location message if delivery coords available
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

  -- Notify the user
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

-- 7. update_location: update caller's GPS
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION scan_nearby_dps TO authenticated;
GRANT EXECUTE ON FUNCTION scan_nearby_dps_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_nearby_requests TO authenticated;
GRANT EXECUTE ON FUNCTION accept_request TO authenticated;
GRANT EXECUTE ON FUNCTION update_location TO authenticated;
