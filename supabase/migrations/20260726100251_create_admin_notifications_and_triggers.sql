CREATE TABLE IF NOT EXISTS admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  title text NOT NULL,
  body text,
  related_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_notifications" ON admin_notifications;
CREATE POLICY "admin_select_notifications"
  ON admin_notifications FOR SELECT
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "admin_update_notifications" ON admin_notifications;
CREATE POLICY "admin_update_notifications"
  ON admin_notifications FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE OR REPLACE FUNCTION notify_admin_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.role = 'user' THEN
    INSERT INTO admin_notifications (type, title, body, related_id)
    VALUES ('new_user', 'New User Registered', NEW.full_name || ' just signed up', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_user_notify_admin ON profiles;
CREATE TRIGGER on_new_user_notify_admin
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION notify_admin_new_user();

CREATE OR REPLACE FUNCTION notify_admin_new_dp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    INSERT INTO admin_notifications (type, title, body, related_id)
    VALUES ('new_dp', 'New DP Application', 'A new delivery partner applied for approval', NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_dp_notify_admin ON delivery_partners;
CREATE TRIGGER on_new_dp_notify_admin
  AFTER INSERT ON delivery_partners
  FOR EACH ROW EXECUTE FUNCTION notify_admin_new_dp();

CREATE OR REPLACE FUNCTION notify_admin_new_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO admin_notifications (type, title, body, related_id)
  VALUES ('payment', 'New Commission Payment', 'Commission payment received', NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_payment_notify_admin ON commission_payments;
CREATE TRIGGER on_new_payment_notify_admin
  AFTER INSERT ON commission_payments
  FOR EACH ROW EXECUTE FUNCTION notify_admin_new_payment();