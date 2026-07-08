-- Remove duplicate chat rooms for the same request, keeping only the earliest one.
-- This is safe to run even if no duplicates exist.
DELETE FROM chat_rooms
WHERE id NOT IN (
  SELECT DISTINCT ON (request_id) id
  FROM chat_rooms
  ORDER BY request_id, created_at ASC
);

-- Prevent future duplicates: each request can only have one chat room.
ALTER TABLE chat_rooms ADD CONSTRAINT chat_rooms_request_id_unique UNIQUE (request_id);
