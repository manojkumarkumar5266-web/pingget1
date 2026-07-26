-- Fix: the notify_admin_new_user() trigger inserts into admin_notifications,
-- but admin_notifications has RLS enabled with only admin SELECT/UPDATE policies.
-- No INSERT policy exists, so the trigger fails for non-admin users, which
-- rolls back the entire profile INSERT — causing signup to silently fail
-- and sign-in to bounce back to the login page.

-- 1) Add an INSERT policy so the trigger (running as the calling user) can insert.
--    The trigger only fires on profile inserts by the user themselves, so we scope
--    to authenticated users.
CREATE POLICY "authenticated_insert_admin_notifications"
  ON admin_notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 2) Make the trigger function SECURITY DEFINER with BYPASSRLS via the owner,
--    so it is not affected by RLS on admin_notifications regardless of caller.
--    Re-create as SECURITY DEFINER with an explicit search_path (already set).
CREATE OR REPLACE FUNCTION public.notify_admin_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.role = 'user' THEN
    INSERT INTO admin_notifications (type, title, body, related_id)
    VALUES ('new_user', 'New User Registered', NEW.full_name || ' just signed up', NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

-- 3) Ensure the trigger is attached (drop + recreate to be safe)
DROP TRIGGER IF EXISTS on_new_user_notify_admin ON public.profiles;
CREATE TRIGGER on_new_user_notify_admin
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_new_user();