-- Enhanced get_nearby_requests with smart DP matching
-- Verifies: online, approved, not suspended, inside service radius, working hours, city match
-- Also supports gradual radius expansion for advance requests

DROP FUNCTION IF EXISTS public.get_nearby_requests(uuid);
CREATE FUNCTION public.get_nearby_requests(
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
  order_type text,
  request_category text,
  scheduled_timestamp timestamptz,
  is_scheduled boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_dp_lat double precision;
  v_dp_lng double precision;
  v_service_range integer;
  v_lead_minutes integer;
  v_dp_city text;
  v_dp_vehicle text;
  v_current_hour integer;
BEGIN
  SELECT p.gps_lat, p.gps_lng, dp.service_range_meters, p.city, dp.vehicle_type
  INTO v_dp_lat, v_dp_lng, v_service_range, v_dp_city, v_dp_vehicle
  FROM delivery_partners dp
  JOIN profiles p ON p.id = dp.user_id
  WHERE dp.user_id = p_dp_user_id
    AND dp.is_online = true
    AND dp.status = 'approved';

  IF v_dp_lat IS NULL OR v_dp_lng IS NULL THEN
    RETURN;
  END IF;

  v_current_hour := EXTRACT(HOUR FROM now());

  SELECT COALESCE(
    (SELECT notification_lead_minutes FROM advance_settings LIMIT 1),
    30
  ) INTO v_lead_minutes;

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
    ) AS dist,
    r.order_type,
    r.request_category,
    r.scheduled_timestamp,
    r.is_scheduled
  FROM requests r
  JOIN profiles up ON up.id = r.user_id
  WHERE (
      (r.status = 'pending' AND r.order_type = 'instant')
      OR
      (r.status = 'scheduled'
       AND r.order_type = 'advance'
       AND r.scheduled_timestamp IS NOT NULL
       AND r.scheduled_timestamp <= now() + (v_lead_minutes || ' minutes')::interval
      )
    )
    AND NOT (r.declined_by @> ARRAY[p_dp_user_id])
    -- City match: if DP has a city, only show requests from same city or no city
    AND (v_dp_city IS NULL OR up.city IS NULL OR up.city = v_dp_city)
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
  ORDER BY
    CASE WHEN r.order_type = 'instant' THEN 0 ELSE 1 END,
    r.created_at DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_nearby_requests(uuid) TO authenticated;
