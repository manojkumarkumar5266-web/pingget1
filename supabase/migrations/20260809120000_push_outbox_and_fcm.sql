-- Push outbox + unique device tokens + ensure broadcast table
-- PASTE INTO SUPABASE SQL EDITOR IF MIGRATIONS ARE NOT AUTO-APPLIED

CREATE TABLE IF NOT EXISTS notification_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  image_url text,
  target_type text NOT NULL CHECK (target_type IN ('broadcast', 'all_users', 'all_dps', 'single')),
  target_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  recipient_count integer DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

ALTER TABLE notification_broadcasts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "broadcasts_admin_all" ON notification_broadcasts;
CREATE POLICY "broadcasts_admin_all" ON notification_broadcasts FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_notification_broadcasts_pending
  ON notification_broadcasts (scheduled_for)
  WHERE status = 'pending';

-- Unique device token for upserts
CREATE UNIQUE INDEX IF NOT EXISTS device_tokens_token_uidx ON device_tokens (token);

CREATE TABLE IF NOT EXISTS push_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  image_url text,
  notification_type text,
  related_id uuid,
  route text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped_no_fcm')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_push_outbox_pending ON push_outbox (created_at) WHERE status = 'pending';
ALTER TABLE push_outbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push_outbox_admin" ON push_outbox;
CREATE POLICY "push_outbox_admin" ON push_outbox FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE OR REPLACE FUNCTION enqueue_push_outbox()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO push_outbox (
    notification_id, user_id, title, body, image_url,
    notification_type, related_id, route, status
  ) VALUES (
    NEW.id,
    NEW.user_id,
    NEW.title,
    NEW.body,
    NEW.image_url,
    COALESCE(NEW.notification_type, NEW.type),
    NEW.related_id,
    NEW.route,
    'pending'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_enqueue_push ON notifications;
CREATE TRIGGER trg_notifications_enqueue_push
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION enqueue_push_outbox();
