-- Force DPs offline when unpaid commission from BEFORE today (Asia/Kolkata)
-- is still outstanding. Matching already requires is_online = true, so they
-- will not appear to customers until admin confirms payment.
-- Does not drop or recreate scan_nearby_dps / get_nearby_requests.

CREATE OR REPLACE FUNCTION public.offline_overdue_commission_dps()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer := 0;
BEGIN
  WITH paid AS (
    SELECT dp_user_id, COALESCE(SUM(amount), 0) AS paid
    FROM dp_commission_receipts
    WHERE status = 'confirmed'
    GROUP BY dp_user_id
  ),
  accrued AS (
    SELECT dp_id, COALESCE(SUM(commission_amount), 0) AS amt
    FROM orders
    WHERE status IS DISTINCT FROM 'cancelled'
      AND dp_id IS NOT NULL
      AND COALESCE(completed_at, created_at) < ((timezone('Asia/Kolkata', now()))::date)
    GROUP BY dp_id
  ),
  due AS (
    SELECT a.dp_id
    FROM accrued a
    LEFT JOIN paid p ON p.dp_user_id = a.dp_id
    WHERE a.amt > COALESCE(p.paid, 0)
  )
  UPDATE delivery_partners dp
  SET is_online = false
  FROM due
  WHERE dp.user_id = due.dp_id
    AND dp.is_online IS TRUE;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.offline_overdue_commission_dps() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.offline_overdue_commission_dps() TO service_role;
GRANT EXECUTE ON FUNCTION public.offline_overdue_commission_dps() TO authenticated;
