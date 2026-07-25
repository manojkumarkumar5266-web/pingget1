ALTER TABLE requests ADD COLUMN IF NOT EXISTS declined_by uuid[] DEFAULT '{}';

CREATE OR REPLACE FUNCTION append_declined_by(row_id uuid, dp_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE requests
  SET declined_by = array_append(
    COALESCE(declined_by, '{}'::uuid[]),
    dp_id
  )
  WHERE id = row_id
  AND NOT (declined_by @> ARRAY[dp_id]);
END;
$$;

GRANT EXECUTE ON FUNCTION append_declined_by TO authenticated;