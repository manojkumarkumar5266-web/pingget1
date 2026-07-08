
-- Create pincodes table linked to cities
CREATE TABLE IF NOT EXISTS pincodes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  city_id uuid REFERENCES cities(id) ON DELETE CASCADE,
  pincode text NOT NULL,
  area_name text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pincodes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "pincodes_select_all" ON pincodes;
  DROP POLICY IF EXISTS "pincodes_manage_admin" ON pincodes;
END $$;

CREATE POLICY "pincodes_select_all" ON pincodes FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "pincodes_manage_admin" ON pincodes FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Upsert Visakhapatnam city
INSERT INTO cities (name, is_active, service_paused, commission_pct)
VALUES ('Visakhapatnam', true, false, 10)
ON CONFLICT DO NOTHING;

-- Insert Visakhapatnam pincodes
DO $$
DECLARE
  viz_id uuid;
BEGIN
  SELECT id INTO viz_id FROM cities WHERE name = 'Visakhapatnam' LIMIT 1;
  IF viz_id IS NOT NULL THEN
    INSERT INTO pincodes (city_id, pincode, area_name, is_active) VALUES
      (viz_id, '530001', 'Visakhapatnam City Centre', true),
      (viz_id, '530002', 'Jagadamba Junction', true),
      (viz_id, '530003', 'Dabagardens', true),
      (viz_id, '530004', 'Gajuwaka', true),
      (viz_id, '530005', 'Pendurthi', true),
      (viz_id, '530006', 'Gajuwaka Industrial Area', true),
      (viz_id, '530007', 'Bheemunipatnam', true),
      (viz_id, '530008', 'Anakapalle Road', true),
      (viz_id, '530009', 'Kommadi', true),
      (viz_id, '530011', 'Dwaraka Nagar', true),
      (viz_id, '530012', 'MVP Colony', true),
      (viz_id, '530013', 'Seethammadhara', true),
      (viz_id, '530014', 'Madhurawada', true),
      (viz_id, '530016', 'Rushikonda', true),
      (viz_id, '530017', 'Yendada', true),
      (viz_id, '530018', 'Bheemili Beach', true),
      (viz_id, '530020', 'NAD Junction', true),
      (viz_id, '530022', 'Simhachalam', true),
      (viz_id, '530023', 'Vizag Steel Plant', true),
      (viz_id, '530024', 'Gajuwaka North', true),
      (viz_id, '530026', 'Pedagantyada', true),
      (viz_id, '530027', 'Gopalapatnam', true),
      (viz_id, '530028', 'Allipuram', true),
      (viz_id, '530029', 'Marripalem', true),
      (viz_id, '530032', 'Kancharapalem', true),
      (viz_id, '530040', 'Adavivaram', true),
      (viz_id, '530041', 'Sujatha Nagar', true),
      (viz_id, '530043', 'Akkayyapalem', true),
      (viz_id, '530044', 'Chinagadili', true),
      (viz_id, '530045', 'Tatichetlapalem', true),
      (viz_id, '530046', 'Asilmetta', true),
      (viz_id, '530047', 'Hanumanthawaka', true),
      (viz_id, '530048', 'Maddilapalem', true),
      (viz_id, '530051', 'Old Post Office', true),
      (viz_id, '530052', 'Industrial Estate', true)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
