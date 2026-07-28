/*
# Fix accept_order failure, scanning page, and DP realtime updates

## Problems Fixed

### 1. DP cannot accept orders (CRITICAL BUG)
The `accept_request()` function inserts a message with `message_type = 'order_summary'`,
but the `messages` table CHECK constraint only allows
('text','image','voice','location','quotation'). The insert fails, the
function raises an error, and the entire transaction rolls back — so the
request never becomes 'accepted'. DPs see "Failed to accept request".

**Fix:** Add 'order_summary' to the allowed message_type values.

### 2. DP online toggle not real-time
The `delivery_partners` table is not in the `supabase_realtime` publication,
so the DpHome page never receives a realtime UPDATE event when the DP
flips online/offline. The page only updates after a manual refresh.

**Fix:** Add `delivery_partners` to the realtime publication.

### 3. Scanning page shows no DP spots / needs vehicle icons
The `scan_nearby_dps` function returns DP positions but not their
vehicle_type. The scanning page needs vehicle info to render the correct
vehicle icon (bicycle / motorbike / car) instead of yellow dots.

**Fix:** Add `vehicle_type` to the `scan_nearby_dps` return columns.

## Changes
1. `messages` table: add 'order_summary' to message_type CHECK constraint.
2. `supabase_realtime` publication: add `delivery_partners` and `orders` tables.
3. `scan_nearby_dps` function: add `vehicle_type text` output column.
4. Re-grant execute permissions on updated functions.

## Security
- No RLS policy changes.
- All functions remain SECURITY DEFINER with SET search_path = public.
*/

-- 1. Fix messages CHECK constraint to allow 'order_summary'
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_message_type_check
  CHECK (message_type IN ('text','image','voice','location','quotation','order_summary'));

-- 2. Add delivery_partners and orders to realtime publication so DP
--    online/offline changes and order status changes are pushed instantly.
ALTER PUBLICATION supabase_realtime ADD TABLE delivery_partners;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
DROP FUNCTION IF EXISTS public.scan_nearby_dps(
    double precision,
    double precision,
    integer
);

DROP FUNCTION IF EXISTS public.scan_nearby_dps(
    double precision,
    double precision,
    integer,
    uuid
);
-- 3. Update scan_nearby_dps to include vehicle_type in the result
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

-- 4. scan_nearby_dps_stats stays the same (aggregate only)
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

-- 5. Re-grant execute permissions (only the 4-arg signatures exist now)
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
