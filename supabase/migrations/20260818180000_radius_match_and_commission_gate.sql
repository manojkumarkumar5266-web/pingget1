-- Production matching, first-accept, and commission-due gating.
-- Apply in Supabase SQL Editor if migrations are not auto-run.

-- 1) Nearby requests: DP range AND customer radius; exclude overdue commission DPs.
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
  request_category text,
  radius_meters integer,
  recurring_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_dp_lat double precision;
  v_dp_lng double precision;
  v_service_range integer;
  v_due numeric;
BEGIN
  -- Block DPs with unpaid commission accrued before today 00:00 local (approx UTC day).
  SELECT COALESCE(SUM(o.commission_amount), 0)
    - COALESCE((
        SELECT SUM(r.amount) FROM dp_commission_receipts r
        WHERE r.dp_user_id = p_dp_user_id AND r.status = 'confirmed'
      ), 0)
  INTO v_due
  FROM orders o
  WHERE o.dp_id = p_dp_user_id
    AND o.status <> 'cancelled'
    AND COALESCE(o.completed_at, o.created_at) < date_trunc('day', now());

  IF COALESCE(v_due, 0) > 0 THEN
    UPDATE delivery_partners SET is_online = false WHERE user_id = p_dp_user_id AND is_online = true;
    RETURN;
  END IF;

  SELECT p.gps_lat, p.gps_lng, COALESCE(dp.service_range_meters, 5000)
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
          sin(radians(COALESCE(r.delivery_lat, r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.delivery_lat, r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.delivery_lng, r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(COALESCE(r.delivery_lat, r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.delivery_lat, r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.delivery_lng, r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
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
    r.request_category,
    COALESCE(r.radius_meters, 6000),
    COALESCE(r.recurring_type, 'none')::text
  FROM requests r
  JOIN profiles up ON up.id = r.user_id
  WHERE (r.status = 'pending' OR r.status = 'searching_dp')
    AND NOT (r.declined_by @> ARRAY[p_dp_user_id])
    AND r.user_id != p_dp_user_id
    AND (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(COALESCE(r.delivery_lat, r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.delivery_lat, r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.delivery_lng, r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(COALESCE(r.delivery_lat, r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.delivery_lat, r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.delivery_lng, r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ))
      )
    ) <= LEAST(v_service_range, COALESCE(r.radius_meters, 6000))
  ORDER BY r.created_at DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION get_nearby_requests(uuid) TO authenticated;

-- 2) User scan: DP must also cover the distance with their own range; skip overdue commission.
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
    COALESCE(dp.current_lat, p.gps_lat),
    COALESCE(dp.current_lng, p.gps_lng),
    (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(COALESCE(dp.current_lat, p.gps_lat) - p_user_lat) / 2) ^ 2 +
          cos(radians(p_user_lat)) * cos(radians(COALESCE(dp.current_lat, p.gps_lat))) *
          sin(radians(COALESCE(dp.current_lng, p.gps_lng) - p_user_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(COALESCE(dp.current_lat, p.gps_lat) - p_user_lat) / 2) ^ 2 +
          cos(radians(p_user_lat)) * cos(radians(COALESCE(dp.current_lat, p.gps_lat))) *
          sin(radians(COALESCE(dp.current_lng, p.gps_lng) - p_user_lng) / 2) ^ 2
        ))
      )
    ) AS dist,
    dp.service_range_meters,
    dp.vehicle_type
  FROM delivery_partners dp
  JOIN profiles p ON p.id = dp.user_id
  WHERE dp.is_online = true
    AND dp.status = 'approved'
    AND COALESCE(dp.current_lat, p.gps_lat) IS NOT NULL
    AND COALESCE(dp.current_lng, p.gps_lng) IS NOT NULL
    AND (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(COALESCE(dp.current_lat, p.gps_lat) - p_user_lat) / 2) ^ 2 +
          cos(radians(p_user_lat)) * cos(radians(COALESCE(dp.current_lat, p.gps_lat))) *
          sin(radians(COALESCE(dp.current_lng, p.gps_lng) - p_user_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(COALESCE(dp.current_lat, p.gps_lat) - p_user_lat) / 2) ^ 2 +
          cos(radians(p_user_lat)) * cos(radians(COALESCE(dp.current_lat, p.gps_lat))) *
          sin(radians(COALESCE(dp.current_lng, p.gps_lng) - p_user_lng) / 2) ^ 2
        ))
      )
    ) <= LEAST(COALESCE(p_radius_meters, 6000), COALESCE(dp.service_range_meters, 5000))
    AND (
      p_request_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM requests r
        WHERE r.id = p_request_id
        AND r.declined_by @> ARRAY[dp.user_id]
      )
    )
    AND NOT EXISTS (
      SELECT 1
      WHERE (
        COALESCE((
          SELECT SUM(o.commission_amount) FROM orders o
          WHERE o.dp_id = dp.user_id AND o.status <> 'cancelled'
            AND COALESCE(o.completed_at, o.created_at) < date_trunc('day', now())
        ), 0)
        -
        COALESCE((
          SELECT SUM(r.amount) FROM dp_commission_receipts r
          WHERE r.dp_user_id = dp.user_id AND r.status = 'confirmed'
        ), 0)
      ) > 0
    );
END;
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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint,
    COALESCE(AVG(s.distance_meters), 0)::double precision
  FROM scan_nearby_dps(p_user_lat, p_user_lng, p_radius_meters, p_request_id) s;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.scan_nearby_dps_stats(double precision, double precision, integer, uuid) TO authenticated;
