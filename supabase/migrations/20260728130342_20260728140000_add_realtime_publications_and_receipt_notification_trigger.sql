-- Add all tables needed for realtime updates to the supabase_realtime publication
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'dp_commission_receipts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE dp_commission_receipts;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'orders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'requests') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE requests;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'profiles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'delivery_partners') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE delivery_partners;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'commission_payments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE commission_payments;
  END IF;
END $$;

-- Trigger: when a DP submits a commission receipt, insert an admin_notification
-- so admins see a red badge on the Payments nav item
CREATE OR REPLACE FUNCTION notify_admin_on_receipt_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'submitted' AND (OLD IS NULL OR OLD.status <> 'submitted') THEN
    INSERT INTO admin_notifications (type, title, body, related_id, is_read)
    VALUES (
      'commission_receipt',
      'New Commission Receipt',
      'A delivery partner has submitted a payment receipt for ' || NEW.amount || ' rupees. Review and confirm.',
      NEW.id,
      false
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_receipt_submitted_notify ON dp_commission_receipts;
CREATE TRIGGER trg_receipt_submitted_notify
  AFTER INSERT OR UPDATE OF status ON dp_commission_receipts
  FOR EACH ROW EXECUTE FUNCTION notify_admin_on_receipt_submitted();