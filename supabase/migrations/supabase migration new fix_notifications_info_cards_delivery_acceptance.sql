-- =====================================================
-- PingGET
-- Fix Notifications + Info Cards + Delivery Acceptance
-- =====================================================

-- -----------------------------------------------------
-- 1. INFO CARDS
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.info_cards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text NOT NULL,
    image_url text,
    icon text DEFAULT '📦',
    bg_color text DEFAULT 'rgba(166,179,0,0.08)',
    sort_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.info_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "info_cards_select_all" ON public.info_cards;
CREATE POLICY "info_cards_select_all"
ON public.info_cards
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "info_cards_insert_admin" ON public.info_cards;
CREATE POLICY "info_cards_insert_admin"
ON public.info_cards
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "info_cards_update_admin" ON public.info_cards;
CREATE POLICY "info_cards_update_admin"
ON public.info_cards
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "info_cards_delete_admin" ON public.info_cards;
CREATE POLICY "info_cards_delete_admin"
ON public.info_cards
FOR DELETE
TO authenticated
USING (public.is_admin());

INSERT INTO public.info_cards
(title,description,icon,sort_order,bg_color)
VALUES
('List Your Items','Add items with quantities and notes.','📝',1,'rgba(166,179,0,0.08)'),
('Voice Your Order','Record your shopping request.','🎙️',2,'rgba(166,179,0,0.08)'),
('Snap a Photo','Upload shopping lists or prescriptions.','📸',3,'rgba(166,179,0,0.08)'),
('Track in Real Time','Watch your delivery partner live.','📍',4,'rgba(166,179,0,0.08)'),
('Special Offers','Latest PingGET offers.','🎁',5,'rgba(166,179,0,0.08)'),
('How PingGET Works','Request → Accept → Deliver.','🛵',6,'rgba(166,179,0,0.08)')
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------
-- 2. STORAGE UPDATE POLICY
-- -----------------------------------------------------

DROP POLICY IF EXISTS "media_auth_update"
ON storage.objects;

CREATE POLICY "media_auth_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id='media')
WITH CHECK (bucket_id='media');

-- -----------------------------------------------------
-- 3. DELIVERY ACCEPTANCE
-- -----------------------------------------------------

ALTER TABLE public.requests
ADD COLUMN IF NOT EXISTS delivery_accepted_at timestamptz;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_accepted_at timestamptz;

-- -----------------------------------------------------
-- 4. NOTIFICATION INSERT POLICY
-- Allows server/admin/system to create notifications
-- for other users.
-- -----------------------------------------------------

DROP POLICY IF EXISTS "notifications_insert_own"
ON public.notifications;

CREATE POLICY "notifications_insert_authenticated"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() IS NOT NULL
);