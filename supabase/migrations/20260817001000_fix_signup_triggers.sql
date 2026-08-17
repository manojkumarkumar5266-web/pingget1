-- Fix signup failures caused by admin_notifications triggers rolling back profile inserts.
-- Run this in Supabase SQL Editor if User/DP signup still returns Edge Function errors
-- after deploying the signup-user function.

-- 1) Allow pending/rejected profile statuses (DP signup uses pending)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('active', 'suspended', 'banned', 'pending', 'rejected'));

-- 2) Ensure email column exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);

-- 3) INSERT policy + SECURITY DEFINER notify trigger for new users
DROP POLICY IF EXISTS "authenticated_insert_admin_notifications" ON public.admin_notifications;
CREATE POLICY "authenticated_insert_admin_notifications"
  ON public.admin_notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.notify_admin_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.role = 'user' THEN
    INSERT INTO public.admin_notifications (type, title, body, related_id, is_read)
    VALUES ('new_user', 'New User Registered', NEW.full_name || ' just signed up', NEW.id, false);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block profile creation because of notification failure
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_new_user_notify_admin ON public.profiles;
CREATE TRIGGER on_new_user_notify_admin
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_new_user();

-- 4) DP application notify trigger (on delivery_partners)
CREATE OR REPLACE FUNCTION public.notify_admin_new_dp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.admin_notifications (type, title, body, related_id, is_read)
  VALUES ('new_dp', 'New DP Application', 'A new delivery partner applied for approval', NEW.user_id, false);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_new_dp_notify_admin ON public.delivery_partners;
CREATE TRIGGER on_new_dp_notify_admin
  AFTER INSERT ON public.delivery_partners
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_new_dp();

-- 5) Unique delivery_partners.user_id helps upserts during signup retries
CREATE UNIQUE INDEX IF NOT EXISTS delivery_partners_user_id_uidx
  ON public.delivery_partners (user_id);
