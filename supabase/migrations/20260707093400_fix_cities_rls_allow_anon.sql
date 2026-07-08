DROP POLICY IF EXISTS "cities_select_all" ON cities;
CREATE POLICY "cities_select_all" ON cities FOR SELECT
  TO anon, authenticated USING (true);
