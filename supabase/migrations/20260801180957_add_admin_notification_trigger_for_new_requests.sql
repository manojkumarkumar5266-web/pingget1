CREATE OR REPLACE FUNCTION public.notify_admins_new_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_notifications (type, title, body, related_id, is_read)
  VALUES (
    'new_request',
    'New Delivery Request',
    'A new delivery request has been created and is awaiting a partner.',
    NEW.id,
    false
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_request_insert_notify_admin ON public.requests;

CREATE TRIGGER on_request_insert_notify_admin
  AFTER INSERT ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_new_request();