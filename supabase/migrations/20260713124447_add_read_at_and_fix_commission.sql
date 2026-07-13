-- Add read_at column to messages for double tick (seen receipts)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at timestamptz;

-- Add declined_by column to requests if not exists
ALTER TABLE requests ADD COLUMN IF NOT EXISTS declined_by uuid[] DEFAULT '{}';

-- Create append_declined_by function if not exists
CREATE OR REPLACE FUNCTION append_declined_by(row_id uuid, dp_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE requests
  SET declined_by = array_append(COALESCE(declined_by, '{}'::uuid[]), dp_id)
  WHERE id = row_id AND NOT (declined_by @> ARRAY[dp_id]);
END;
$$;

GRANT EXECUTE ON FUNCTION append_declined_by TO authenticated;

-- Update the payment trigger to also fire on dp_commission_receipts confirmation
-- (not just commission_payments inserts)
CREATE OR REPLACE FUNCTION notify_admin_new_receipt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'submitted' THEN
    INSERT INTO admin_notifications (type, title, body, related_id)
    VALUES ('payment_receipt', 'New Payment Receipt', 'A delivery partner submitted a commission payment receipt', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_receipt_notify_admin ON dp_commission_receipts;
CREATE TRIGGER on_new_receipt_notify_admin
  AFTER INSERT ON dp_commission_receipts
  FOR EACH ROW EXECUTE FUNCTION notify_admin_new_receipt();

-- Also notify when receipt status changes (confirmed/rejected)
CREATE OR REPLACE FUNCTION notify_admin_receipt_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.status = 'submitted' AND NEW.status = 'confirmed' THEN
    INSERT INTO admin_notifications (type, title, body, related_id)
    VALUES ('receipt_confirmed', 'Receipt Confirmed', 'Commission payment receipt confirmed', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_receipt_update_notify_admin ON dp_commission_receipts;
CREATE TRIGGER on_receipt_update_notify_admin
  AFTER UPDATE ON dp_commission_receipts
  FOR EACH ROW EXECUTE FUNCTION notify_admin_receipt_update();

-- Insert into commission_payments when a receipt is confirmed
CREATE OR REPLACE FUNCTION insert_commission_payment_on_confirm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.status = 'submitted' AND NEW.status = 'confirmed' THEN
    INSERT INTO commission_payments (dp_user_id, amount, payment_method, transaction_id, status)
    VALUES (NEW.dp_user_id, NEW.amount, 'upi', NEW.upi_ref, 'confirmed')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_receipt_confirm_insert_payment ON dp_commission_receipts;
CREATE TRIGGER on_receipt_confirm_insert_payment
  AFTER UPDATE ON dp_commission_receipts
  FOR EACH ROW EXECUTE FUNCTION insert_commission_payment_on_confirm();
