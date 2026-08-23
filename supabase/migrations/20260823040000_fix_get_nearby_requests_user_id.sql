-- FIX: "column reference user_id is ambiguous" on DP Home.
-- Run this entire file in the Supabase SQL Editor, then hard-refresh the partner app.

CREATE OR REPLACE FUNCTION public.geo_distance_m(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT CASE
    WHEN lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN NULL
    ELSE (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(lat2 - lat1) / 2) ^ 2 +
          cos(radians(lat1)) * cos(radians(lat2)) *
          sin(radians(lng2 - lng1) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(lat2 - lat1) / 2) ^ 2 +
          cos(radians(lat1)) * cos(radians(lat2)) *
          sin(radians(lng2 - lng1) / 2) ^ 2
        ))
      )
    )
  END
$fn$;

DROP FUNCTION IF EXISTS public.get_nearby_requests(uuid);

-- LANGUAGE sql (not plpgsql) so RETURNS TABLE user_id does not clash with requests.user_id.
CREATE FUNCTION public.get_nearby_requests(p_dp_user_id uuid)
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
  request_category text,
  radius_meters integer,
  recurring_type text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH partner AS (
    SELECT
      COALESCE(dp.current_lat, p.gps_lat) AS lat,
      COALESCE(dp.current_lng, p.gps_lng) AS lng,
      COALESCE(dp.service_range_meters, 5000) AS service_range,
      p.city AS city
    FROM delivery_partners AS dp
    INNER JOIN profiles AS p ON p.id = dp.user_id
    WHERE dp.user_id = p_dp_user_id
      AND dp.is_online = true
      AND dp.status = 'approved'
    LIMIT 1
  )
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
    public.geo_distance_m(
      partner.lat,
      partner.lng,
      COALESCE(r.delivery_lat, r.pickup_lat, up.gps_lat),
      COALESCE(r.delivery_lng, r.pickup_lng, up.gps_lng)
    ) AS distance_meters,
    r.status::text,
    COALESCE(r.order_type, 'instant')::text,
    COALESCE(r.is_scheduled, false),
    r.scheduled_date,
    r.scheduled_time,
    r.scheduled_slot,
    r.scheduled_timestamp,
    r.request_category,
    COALESCE(r.radius_meters, 6000),
    COALESCE(r.recurring_type, 'none')::text
  FROM requests AS r
  INNER JOIN profiles AS up ON up.id = r.user_id
  INNER JOIN partner ON true
  WHERE (r.status = 'pending' OR r.status = 'searching_dp')
    AND NOT (COALESCE(r.declined_by, '{}'::uuid[]) @> ARRAY[p_dp_user_id])
    AND r.user_id <> p_dp_user_id
    AND (
      (
        partner.lat IS NOT NULL
        AND partner.lng IS NOT NULL
        AND COALESCE(r.delivery_lat, r.pickup_lat, up.gps_lat) IS NOT NULL
        AND COALESCE(r.delivery_lng, r.pickup_lng, up.gps_lng) IS NOT NULL
        AND public.geo_distance_m(
          partner.lat,
          partner.lng,
          COALESCE(r.delivery_lat, r.pickup_lat, up.gps_lat),
          COALESCE(r.delivery_lng, r.pickup_lng, up.gps_lng)
        ) <= COALESCE(partner.service_range, 5000)
      )
      OR (
        (
          partner.lat IS NULL
          OR COALESCE(r.delivery_lat, r.pickup_lat, up.gps_lat) IS NULL
        )
        AND NULLIF(lower(btrim(COALESCE(up.city, ''))), '') IS NOT NULL
        AND lower(btrim(up.city)) = lower(btrim(COALESCE(partner.city, '')))
      )
    )
  ORDER BY r.created_at DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.get_nearby_requests(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.scan_nearby_dps(double precision, double precision, integer);
DROP FUNCTION IF EXISTS public.scan_nearby_dps(double precision, double precision, integer, uuid);

CREATE FUNCTION public.scan_nearby_dps(
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    dp.user_id,
    p.full_name,
    COALESCE(dp.current_lat, p.gps_lat),
    COALESCE(dp.current_lng, p.gps_lng),
    public.geo_distance_m(
      p_user_lat,
      p_user_lng,
      COALESCE(dp.current_lat, p.gps_lat),
      COALESCE(dp.current_lng, p.gps_lng)
    ),
    dp.service_range_meters,
    dp.vehicle_type
  FROM delivery_partners AS dp
  INNER JOIN profiles AS p ON p.id = dp.user_id
  WHERE dp.is_online = true
    AND dp.status = 'approved'
    AND COALESCE(dp.current_lat, p.gps_lat) IS NOT NULL
    AND COALESCE(dp.current_lng, p.gps_lng) IS NOT NULL
    AND public.geo_distance_m(
      p_user_lat,
      p_user_lng,
      COALESCE(dp.current_lat, p.gps_lat),
      COALESCE(dp.current_lng, p.gps_lng)
    ) <= COALESCE(p_radius_meters, 6000)
    AND public.geo_distance_m(
      p_user_lat,
      p_user_lng,
      COALESCE(dp.current_lat, p.gps_lat),
      COALESCE(dp.current_lng, p.gps_lng)
    ) <= COALESCE(dp.service_range_meters, 5000)
    AND (
      p_request_id IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM requests AS req
        WHERE req.id = p_request_id
          AND COALESCE(req.declined_by, '{}'::uuid[]) @> ARRAY[dp.user_id]
      )
    );
$function$;

GRANT EXECUTE ON FUNCTION public.scan_nearby_dps(double precision, double precision, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.scan_nearby_dps(double precision, double precision, integer, uuid) TO authenticated;

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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    COUNT(*)::bigint,
    COALESCE(AVG(s.distance_meters), 0)::double precision
  FROM public.scan_nearby_dps(p_user_lat, p_user_lng, p_radius_meters, p_request_id) AS s;
$function$;

GRANT EXECUTE ON FUNCTION public.scan_nearby_dps_stats(double precision, double precision, integer, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_location(
  p_lat double precision,
  p_lng double precision
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
#variable_conflict use_column
BEGIN
  UPDATE profiles
  SET gps_lat = p_lat,
      gps_lng = p_lng,
      gps_updated_at = now(),
      updated_at = now()
  WHERE profiles.id = auth.uid();

  UPDATE delivery_partners
  SET current_lat = p_lat,
      current_lng = p_lng,
      last_location_at = now()
  WHERE delivery_partners.user_id = auth.uid();
END;
$function$;

GRANT EXECUTE ON FUNCTION public.update_location(double precision, double precision) TO authenticated;
