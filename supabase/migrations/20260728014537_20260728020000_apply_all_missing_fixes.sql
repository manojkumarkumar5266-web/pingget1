-- Fix 1: is_admin function with proper search_path
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Fix 2: profiles SELECT — allow chat participants to see each other's profiles
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  TO authenticated USING (
    auth.uid() = id
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM chat_rooms
      WHERE (chat_rooms.user_id = auth.uid() AND chat_rooms.dp_id = profiles.id)
         OR (chat_rooms.dp_id = auth.uid() AND chat_rooms.user_id = profiles.id)
    )
  );

-- Fix 3: notifications INSERT — allow any authenticated user to insert (DPs notify users)
DROP POLICY IF EXISTS "notifications_insert_own" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_any" ON notifications;
CREATE POLICY "notifications_insert_any" ON notifications FOR INSERT
  TO authenticated WITH CHECK (true);

-- Fix 4: requests UPDATE — allow updating pending requests (so DPs can accept)
DROP POLICY IF EXISTS "requests_update_own_or_dp" ON requests;
DROP POLICY IF EXISTS "requests_update_own_or_accepted_dp" ON requests;
CREATE POLICY "requests_update_own_or_accepted_dp" ON requests FOR UPDATE
  TO authenticated USING (
    user_id = auth.uid()
    OR accepted_dp_id = auth.uid()
    OR status = 'pending'
    OR public.is_admin()
  ) WITH CHECK (
    user_id = auth.uid()
    OR accepted_dp_id = auth.uid()
    OR public.is_admin()
  );

-- Fix 5: chat_rooms unique constraint (one room per request)
DO $$ BEGIN
  -- Remove duplicates first
  DELETE FROM chat_rooms
  WHERE id NOT IN (
    SELECT DISTINCT ON (request_id) id
    FROM chat_rooms
    ORDER BY request_id, created_at ASC
  );
  
  -- Add unique constraint if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_rooms_request_id_unique'
  ) THEN
    ALTER TABLE chat_rooms ADD CONSTRAINT chat_rooms_request_id_unique UNIQUE (request_id);
  END IF;
END $$;

-- Fix 6: cities SELECT — allow anon
DROP POLICY IF EXISTS "cities_select_all" ON cities;
CREATE POLICY "cities_select_all" ON cities FOR SELECT
  TO anon, authenticated USING (true);

-- Fix 7: delivery_partners — add admin policies
DROP POLICY IF EXISTS "dp_update_admin" ON delivery_partners;
CREATE POLICY "dp_update_admin" ON delivery_partners FOR UPDATE
  TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Fix 8: storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES 
  ('avatars', 'avatars', true, 5242880),
  ('media', 'media', true, 20971520)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
  DROP POLICY IF EXISTS "avatars_auth_insert" ON storage.objects;
  DROP POLICY IF EXISTS "avatars_auth_update" ON storage.objects;
  DROP POLICY IF EXISTS "media_public_read" ON storage.objects;
  DROP POLICY IF EXISTS "media_auth_insert" ON storage.objects;
END $$;

CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_auth_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "avatars_auth_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "media_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'media');
CREATE POLICY "media_auth_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'media');

-- Fix 9: aadhaar_url column
ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS aadhaar_url text;

-- Fix 10: app_settings default values
INSERT INTO app_settings (key, value) VALUES ('admin_upi_id', 'admin@upi') ON CONFLICT DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('admin_name', 'pingGET Admin') ON CONFLICT DO NOTHING;