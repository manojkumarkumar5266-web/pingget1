-- Add live tracking columns to delivery_partners
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_partners' AND column_name = 'current_lat') THEN
    ALTER TABLE delivery_partners ADD COLUMN current_lat double precision;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_partners' AND column_name = 'current_lng') THEN
    ALTER TABLE delivery_partners ADD COLUMN current_lng double precision;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_partners' AND column_name = 'heading') THEN
    ALTER TABLE delivery_partners ADD COLUMN heading double precision;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_partners' AND column_name = 'speed_kmh') THEN
    ALTER TABLE delivery_partners ADD COLUMN speed_kmh double precision DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_partners' AND column_name = 'battery_level') THEN
    ALTER TABLE delivery_partners ADD COLUMN battery_level int;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_partners' AND column_name = 'last_location_at') THEN
    ALTER TABLE delivery_partners ADD COLUMN last_location_at timestamptz;
  END IF;
END $$;

-- Add live tracking columns to requests
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'dp_lat') THEN
    ALTER TABLE requests ADD COLUMN dp_lat double precision;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'dp_lng') THEN
    ALTER TABLE requests ADD COLUMN dp_lng double precision;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'dp_heading') THEN
    ALTER TABLE requests ADD COLUMN dp_heading double precision;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'dp_last_update') THEN
    ALTER TABLE requests ADD COLUMN dp_last_update timestamptz;
  END IF;
END $$;

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_delivery_partners_online ON delivery_partners(is_online);
CREATE INDEX IF NOT EXISTS idx_requests_status_accepted ON requests(status, accepted_dp_id);

-- Realtime publications
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'delivery_partners') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE delivery_partners;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'requests') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE requests;
  END IF;
END $$;

-- update_location RPC: updates DP GPS and denormalizes into active requests
CREATE OR REPLACE FUNCTION update_location(p_lat double precision, p_lng double precision)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_prev_lat double precision;
  v_prev_lng double precision;
  v_heading double precision := 0;
BEGIN
  SELECT current_lat, current_lng INTO v_prev_lat, v_prev_lng
  FROM delivery_partners WHERE user_id = v_user_id;

  IF v_prev_lat IS NOT NULL AND v_prev_lng IS NOT NULL THEN
    IF p_lat <> v_prev_lat OR p_lng <> v_prev_lng THEN
      v_heading := degrees(atan2(
        sin(radians(p_lng - v_prev_lng)) * cos(radians(p_lat)),
        cos(radians(v_prev_lat)) * sin(radians(p_lat)) -
        sin(radians(v_prev_lat)) * cos(radians(p_lat)) * cos(radians(p_lng - v_prev_lng))
      ));
      v_heading := (v_heading + 360) % 360;
    END IF;
  END IF;

  UPDATE delivery_partners
  SET current_lat = p_lat,
      current_lng = p_lng,
      heading = v_heading,
      last_location_at = now()
  WHERE user_id = v_user_id;

  UPDATE requests
  SET dp_lat = p_lat,
      dp_lng = p_lng,
      dp_heading = v_heading,
      dp_last_update = now()
  WHERE accepted_dp_id = v_user_id
    AND status IN ('accepted','confirmed','shopping','purchased','on_the_way','arrived');
END;
$$;

-- get_online_dps RPC: returns all online approved DPs with profile + active request info
CREATE OR REPLACE FUNCTION get_online_dps()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  phone text,
  photo_url text,
  vehicle_type text,
  current_lat double precision,
  current_lng double precision,
  heading double precision,
  speed_kmh double precision,
  battery_level int,
  rating_avg numeric,
  is_online boolean,
  last_location_at timestamptz,
  active_request_id uuid,
  active_request_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT
    dp.user_id,
    p.full_name,
    p.phone,
    p.photo_url,
    dp.vehicle_type,
    dp.current_lat,
    dp.current_lng,
    dp.heading,
    dp.speed_kmh,
    dp.battery_level,
    dp.rating_avg,
    dp.is_online,
    dp.last_location_at,
    r.id,
    r.status
  FROM delivery_partners dp
  JOIN profiles p ON p.id = dp.user_id
  LEFT JOIN LATERAL (
    SELECT id, status FROM requests
    WHERE accepted_dp_id = dp.user_id
      AND status IN ('accepted','confirmed','shopping','purchased','on_the_way','arrived')
    ORDER BY created_at DESC LIMIT 1
  ) r ON true
  WHERE dp.is_online = true
    AND dp.status = 'approved';
END;
$$;