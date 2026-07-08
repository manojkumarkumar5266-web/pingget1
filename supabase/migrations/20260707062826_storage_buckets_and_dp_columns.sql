-- Storage buckets for file uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES 
  ('avatars', 'avatars', true, 5242880),
  ('media', 'media', true, 20971520)
ON CONFLICT (id) DO NOTHING;

-- Storage object policies (drop first to avoid duplicates)
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

-- Add aadhaar_url column to delivery_partners for document uploads
ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS aadhaar_url text;
