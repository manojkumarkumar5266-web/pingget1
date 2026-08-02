-- ============================================
-- PingGET - Info Cards + Delivery Acceptance
-- ============================================

-- ------------------------------------------------
-- INFO CARDS TABLE
-- ------------------------------------------------
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

-- ------------------------------------------------
-- RLS POLICIES
-- ------------------------------------------------

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

-- ------------------------------------------------
-- DEFAULT INFO CARDS
-- ------------------------------------------------

INSERT INTO public.info_cards
(
    title,
    description,
    icon,
    sort_order,
    bg_color
)
VALUES
(
    'List Your Items',
    'Add items with quantities, brand preferences and notes.',
    '📝',
    1,
    'rgba(166,179,0,0.08)'
),
(
    'Voice Your Order',
    'Record a voice note instead of typing your request.',
    '🎙️',
    2,
    'rgba(166,179,0,0.08)'
),
(
    'Snap a Photo',
    'Upload shopping lists, prescriptions or product photos.',
    '📸',
    3,
    'rgba(166,179,0,0.08)'
),
(
    'Track in Real Time',
    'Track your delivery partner live from pickup to delivery.',
    '📍',
    4,
    'rgba(166,179,0,0.08)'
),
(
    'Special Offers',
    'View offers and promotions from PingGET.',
    '🎁',
    5,
    'rgba(166,179,0,0.08)'
),
(
    'How PingGET Works',
    'Create a request, get matched with a nearby partner and track your delivery.',
    '🛵',
    6,
    'rgba(166,179,0,0.08)'
)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------
-- STORAGE POLICY
-- ------------------------------------------------

DROP POLICY IF EXISTS "media_auth_update" ON storage.objects;

CREATE POLICY "media_auth_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'media')
WITH CHECK (bucket_id = 'media');

-- ------------------------------------------------
-- DELIVERY ACCEPTANCE
-- ------------------------------------------------

ALTER TABLE public.requests
ADD COLUMN IF NOT EXISTS delivery_accepted_at timestamptz;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_accepted_at timestamptz;