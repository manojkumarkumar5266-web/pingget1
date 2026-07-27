/*
# Add nearby DP scanning function (Rapido-style)

1. Purpose
   - Users can "scan" for nearby delivery partners within a radius.
   - Returns count of online DPs within the user's specified radius.
   - Uses the haversine formula to compute distance between user GPS and DP GPS.

2. New Functions
   - `scan_nearby_dps(p_user_lat double precision, p_user_lng double precision, p_radius_meters integer)`
     - Returns: table with `dp_count` (integer) — number of online DPs within radius.
     - Joins `delivery_partners` with `profiles` to get GPS coordinates.
     - Only counts DPs that are `is_online = true` and `status = 'approved'`.

3. Security
   - Function is `SECURITY DEFINER` so it can read DP profiles (which may not be
     directly visible to the user via RLS).
   - Granted to `authenticated` and `anon` roles.
*/

CREATE OR REPLACE FUNCTION scan_nearby_dps(
  p_user_lat double precision,
  p_user_lng double precision,
  p_radius_meters integer DEFAULT 5000
)
RETURNS TABLE (dp_count integer, avg_distance_meters double precision)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
  v_avg_dist double precision;
BEGIN
  SELECT
    COUNT(*)::integer,
    COALESCE(AVG(
      6371000 * 2 * ASIN(SQRT(
        POWER(SIN((RADIANS(p_user_lat) - RADIANS(p.gps_lat)) / 2), 2) +
        COS(RADIANS(p_user_lat)) * COS(RADIANS(p.gps_lat)) *
        POWER(SIN((RADIANS(p_user_lng) - RADIANS(p.gps_lng)) / 2), 2)
      ))
    ), 0)::double precision
  INTO v_count, v_avg_dist
  FROM delivery_partners dp
  INNER JOIN profiles p ON p.id = dp.user_id
  WHERE dp.is_online = true
    AND dp.status = 'approved'
    AND p.gps_lat IS NOT NULL
    AND p.gps_lng IS NOT NULL
    AND 6371000 * 2 * ASIN(SQRT(
      POWER(SIN((RADIANS(p_user_lat) - RADIANS(p.gps_lat)) / 2), 2) +
      COS(RADIANS(p_user_lat)) * COS(RADIANS(p.gps_lat)) *
      POWER(SIN((RADIANS(p_user_lng) - RADIANS(p.gps_lng)) / 2), 2)
    )) <= p_radius_meters;

  RETURN QUERY SELECT v_count, v_avg_dist;
END;
$$;

GRANT EXECUTE ON FUNCTION scan_nearby_dps TO authenticated, anon;