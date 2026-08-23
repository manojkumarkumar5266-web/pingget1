-- Production-safe: replace get_nearby_requests only.
-- Does NOT drop, alter, grant, or recreate scan_nearby_dps.
-- Idempotent. Run the entire file in the Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.geo_distance_m(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
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

-- Drop by argument list only. Return type may differ across environments.
DROP FUNCTION IF EXISTS public.get_nearby_requests(uuid);

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
    ),
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
