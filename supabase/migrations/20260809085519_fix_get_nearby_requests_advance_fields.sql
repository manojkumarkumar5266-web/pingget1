-- Restore advance booking metadata on nearby requests for DP home.
-- V3 get_nearby_requests included searching_dp but dropped order_type/status/schedule fields,
-- which made advance cards show as INSTANT and Accept call accept_request (fails for searching_dp).

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
  distance_meters double precision,
  status text,
  order_type text,
  is_scheduled boolean,
  scheduled_date date,
  scheduled_time text,
  scheduled_slot text,
  scheduled_timestamp timestamptz,
  request_category text
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
    ) AS dist,
    r.status::text,
    COALESCE(r.order_type, 'instant')::text,
    COALESCE(r.is_scheduled, false),
    r.scheduled_date,
    r.scheduled_time,
    r.scheduled_slot,
    r.scheduled_timestamp,
    r.request_category
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
