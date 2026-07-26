/*
# Drop title column from requests table

1. Changes
- Drops the `title` column from the `requests` table.
- The `description` column already stores the full order description.
- The `photo_urls` array column (added in a prior migration) replaces the old single `photo_url` column.

2. Important notes
- This is a destructive column drop, but `title` has been superseded by `description` across the entire frontend. All new requests are created with `description` only.
- The old `photo_url` text column is retained for backward compatibility with any historical rows, but new inserts use `photo_urls` (text array).
*/

ALTER TABLE requests DROP COLUMN IF EXISTS title;
