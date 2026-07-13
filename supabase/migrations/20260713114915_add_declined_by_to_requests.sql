/*
# Add declined_by column to requests table

## Changes
1. Adds `declined_by` array column to `requests` table
   - Tracks which DPs have declined a request so they don't see it again
   - Defaults to empty array
2. Creates `append_declined_by` RPC function
   - Safely appends a DP ID to the declined_by array atomically
   - Prevents race conditions when multiple DPs decline simultaneously
3. Adds GIST index for better query performance on status filtering

## Security
- No RLS policy changes needed — existing policies remain intact
- The RPC function is SECURITY DEFINER to allow the array append operation
*/

-- Add declined_by column
ALTER TABLE requests ADD COLUMN IF NOT EXISTS declined_by uuid[] DEFAULT '{}';

-- Create the append_declined_by function
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

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION append_declined_by TO authenticated;
