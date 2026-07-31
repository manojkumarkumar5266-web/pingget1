/*
# Add dp_ratings table for delivery partner star ratings
*/

CREATE TABLE IF NOT EXISTS dp_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dp_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  feedback text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE dp_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_dp_ratings" ON dp_ratings;
CREATE POLICY "select_dp_ratings" ON dp_ratings FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_dp_rating" ON dp_ratings;
CREATE POLICY "insert_own_dp_rating" ON dp_ratings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
