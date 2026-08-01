CREATE OR REPLACE FUNCTION public.update_dp_rating_avg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dp_user_id uuid;
  v_avg numeric;
  v_count integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_dp_user_id := OLD.rated_id;
  ELSE
    v_dp_user_id := NEW.rated_id;
  END IF;

  SELECT COALESCE(AVG(stars), 0), COUNT(*)
    INTO v_avg, v_count
  FROM public.ratings
  WHERE rated_id = v_dp_user_id;

  UPDATE public.delivery_partners
    SET rating_avg = ROUND(v_avg, 2),
        rating_count = v_count
    WHERE user_id = v_dp_user_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS on_rating_insert_update_dp ON public.ratings;
DROP TRIGGER IF EXISTS on_rating_update_dp ON public.ratings;
DROP TRIGGER IF EXISTS on_rating_delete_update_dp ON public.ratings;

CREATE TRIGGER on_rating_insert_update_dp
  AFTER INSERT ON public.ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_dp_rating_avg();

CREATE TRIGGER on_rating_update_dp
  AFTER UPDATE ON public.ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_dp_rating_avg();

CREATE TRIGGER on_rating_delete_update_dp
  AFTER DELETE ON public.ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_dp_rating_avg();