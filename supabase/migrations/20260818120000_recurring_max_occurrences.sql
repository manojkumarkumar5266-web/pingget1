-- Recurring advance bookings: max number of occurrences (incl. the first booking)
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS recurring_max_occurrences integer;

COMMENT ON COLUMN requests.recurring_max_occurrences IS
  'Max occurrences for a recurring advance series (includes the first). Null = continue until hard cap (100).';
