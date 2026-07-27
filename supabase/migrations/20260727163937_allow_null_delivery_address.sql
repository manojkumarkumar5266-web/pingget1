-- Allow null delivery_address — frontend sends null when user has no address set
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND table_schema = 'public' AND column_name = 'delivery_address'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE requests ALTER COLUMN delivery_address DROP NOT NULL;
    ALTER TABLE requests ALTER COLUMN delivery_address SET DEFAULT NULL;
  END IF;
END $$;