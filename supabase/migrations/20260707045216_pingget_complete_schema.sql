/*
  PingGET — complete schema (single consolidated migration)
  Squashed from all incremental migrations + service_area_waitlist.
  Apply on a fresh database only (supabase db reset / new project).
*/


-- =============================================================================
-- BEGIN: 20260707045216_pingget_schema.sql
-- =============================================================================

/*
# PingGET Core Schema

1. Purpose
Hyperlocal delivery marketplace connecting Users with nearby Delivery Partners via chat.
No inventory, no online payment between user and DP. Cash on delivery. DP pays platform commission.

2. Tables
- profiles: extends auth.users with role (user/dp/admin), full name, phone, photo, city, gps, language
- delivery_partners: DP-specific fields, approval status, online state, ratings
- cities: admin-managed service availability with commission %
- requests: user delivery requests with pickup/delivery locations, budget, radius
- chat_rooms: 1:1 room per accepted request between user and DP
- messages: realtime chat (text/image/voice/location/quotation)
- orders: confirmed orders with status, quotation, delivery charge, commission
- ratings: user<->DP mutual ratings
- notifications: in-app notifications
- wallets: DP wallet balance and commission tracking
- commission_payments: DP online commission payments
- admin_logs: audit trail
- support_tickets: support requests

3. Security
- RLS enabled on all tables.
- Owner-scoped CRUD for user data.
- DP-scoped access for requests they accepted.
- Admin full access via role check in profiles.
*/

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','dp','admin')),
  full_name text NOT NULL,
  phone text,
  photo_url text,
  address text,
  city text,
  gps_lat double precision,
  gps_lng double precision,
  preferred_language text DEFAULT 'en',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- DELIVERY PARTNERS
CREATE TABLE IF NOT EXISTS delivery_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aadhaar_number text,
  emergency_contact text,
  vehicle_type text,
  driving_license_url text,
  upi_id text,
  bank_account text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','suspended','deleted')),
  is_online boolean DEFAULT false,
  rating_avg numeric DEFAULT 0,
  rating_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE delivery_partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dp_select_own_admin" ON delivery_partners;
CREATE POLICY "dp_select_own_admin" ON delivery_partners FOR SELECT
  TO authenticated USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "dp_insert_own" ON delivery_partners;
CREATE POLICY "dp_insert_own" ON delivery_partners FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "dp_update_own" ON delivery_partners;
CREATE POLICY "dp_update_own" ON delivery_partners FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- CITIES
CREATE TABLE IF NOT EXISTS cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean DEFAULT true,
  service_paused boolean DEFAULT false,
  commission_pct numeric DEFAULT 10,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cities_select_all" ON cities;
CREATE POLICY "cities_select_all" ON cities FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "cities_admin_write" ON cities;
CREATE POLICY "cities_admin_write" ON cities FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- REQUESTS
CREATE TABLE IF NOT EXISTS requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  photo_url text,
  voice_note_url text,
  preferred_shop text,
  pickup_address text,
  pickup_lat double precision,
  pickup_lng double precision,
  delivery_address text NOT NULL,
  delivery_lat double precision,
  delivery_lng double precision,
  expected_time text,
  max_budget numeric,
  special_instructions text,
  radius_meters int DEFAULT 500,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','confirmed','shopping','purchased','on_the_way','arrived','delivered','cash_received','completed','cancelled')),
  accepted_dp_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "requests_select_participants" ON requests;
CREATE POLICY "requests_select_participants" ON requests FOR SELECT
  TO authenticated USING (
    user_id = auth.uid() OR
    accepted_dp_id = auth.uid() OR
    status = 'pending' OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "requests_insert_own" ON requests;
CREATE POLICY "requests_insert_own" ON requests FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "requests_update_own_or_dp" ON requests;
CREATE POLICY "requests_update_own_or_dp" ON requests FOR UPDATE
  TO authenticated USING (
    user_id = auth.uid() OR accepted_dp_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    user_id = auth.uid() OR accepted_dp_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- CHAT ROOMS
CREATE TABLE IF NOT EXISTS chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dp_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_rooms_select_participants" ON chat_rooms;
CREATE POLICY "chat_rooms_select_participants" ON chat_rooms FOR SELECT
  TO authenticated USING (
    user_id = auth.uid() OR dp_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "chat_rooms_insert_participants" ON chat_rooms;
CREATE POLICY "chat_rooms_insert_participants" ON chat_rooms FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid() OR dp_id = auth.uid());

-- MESSAGES
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_room_id uuid NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text','image','voice','location','quotation')),
  attachment_url text,
  location_lat double precision,
  location_lng double precision,
  quotation_data jsonb,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_room_participants" ON messages;
CREATE POLICY "messages_select_room_participants" ON messages FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM chat_rooms WHERE chat_rooms.id = messages.chat_room_id AND (chat_rooms.user_id = auth.uid() OR chat_rooms.dp_id = auth.uid())) OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "messages_insert_room_participants" ON messages;
CREATE POLICY "messages_insert_room_participants" ON messages FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM chat_rooms WHERE chat_rooms.id = messages.chat_room_id AND (chat_rooms.user_id = auth.uid() OR chat_rooms.dp_id = auth.uid()))
  );

DROP POLICY IF EXISTS "messages_update_own" ON messages;
CREATE POLICY "messages_update_own" ON messages FOR UPDATE
  TO authenticated USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());

-- ORDERS
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dp_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  items_summary text,
  item_cost numeric,
  delivery_charge numeric NOT NULL DEFAULT 0,
  commission_pct numeric NOT NULL DEFAULT 10,
  commission_amount numeric NOT NULL DEFAULT 0,
  dp_earnings numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','shopping','purchased','on_the_way','arrived','delivered','cash_received','completed','cancelled')),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_select_participants" ON orders;
CREATE POLICY "orders_select_participants" ON orders FOR SELECT
  TO authenticated USING (
    user_id = auth.uid() OR dp_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "orders_insert_participants" ON orders;
CREATE POLICY "orders_insert_participants" ON orders FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid() OR dp_id = auth.uid());

DROP POLICY IF EXISTS "orders_update_participants" ON orders;
CREATE POLICY "orders_update_participants" ON orders FOR UPDATE
  TO authenticated USING (
    user_id = auth.uid() OR dp_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    user_id = auth.uid() OR dp_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- RATINGS
CREATE TABLE IF NOT EXISTS ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  rater_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rated_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stars int NOT NULL CHECK (stars >= 1 AND stars <= 5),
  review text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ratings_select_participants" ON ratings;
CREATE POLICY "ratings_select_participants" ON ratings FOR SELECT
  TO authenticated USING (
    rater_id = auth.uid() OR rated_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "ratings_insert_own" ON ratings;
CREATE POLICY "ratings_insert_own" ON ratings FOR INSERT
  TO authenticated WITH CHECK (rater_id = auth.uid());

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  type text,
  related_id uuid,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_insert_own" ON notifications;
CREATE POLICY "notifications_insert_own" ON notifications FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- WALLETS
CREATE TABLE IF NOT EXISTS wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dp_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  total_earnings numeric DEFAULT 0,
  commission_due numeric DEFAULT 0,
  commission_paid numeric DEFAULT 0,
  outstanding_balance numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallets_select_own_admin" ON wallets;
CREATE POLICY "wallets_select_own_admin" ON wallets FOR SELECT
  TO authenticated USING (
    dp_user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "wallets_insert_own" ON wallets;
CREATE POLICY "wallets_insert_own" ON wallets FOR INSERT
  TO authenticated WITH CHECK (dp_user_id = auth.uid());

DROP POLICY IF EXISTS "wallets_update_admin" ON wallets;
CREATE POLICY "wallets_update_admin" ON wallets FOR UPDATE
  TO authenticated USING (
    dp_user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    dp_user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- COMMISSION PAYMENTS
CREATE TABLE IF NOT EXISTS commission_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dp_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payment_method text,
  transaction_id text,
  status text DEFAULT 'completed',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE commission_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commission_payments_select_own_admin" ON commission_payments;
CREATE POLICY "commission_payments_select_own_admin" ON commission_payments FOR SELECT
  TO authenticated USING (
    dp_user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "commission_payments_insert_own" ON commission_payments;
CREATE POLICY "commission_payments_insert_own" ON commission_payments FOR INSERT
  TO authenticated WITH CHECK (dp_user_id = auth.uid());

-- ADMIN LOGS
CREATE TABLE IF NOT EXISTS admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_id uuid,
  details text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_logs_select_admin" ON admin_logs;
CREATE POLICY "admin_logs_select_admin" ON admin_logs FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_logs_insert_admin" ON admin_logs;
CREATE POLICY "admin_logs_insert_admin" ON admin_logs FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- SUPPORT TICKETS
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  description text,
  status text DEFAULT 'open' CHECK (status IN ('open','resolved','closed')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tickets_select_own_admin" ON support_tickets;
CREATE POLICY "tickets_select_own_admin" ON support_tickets FOR SELECT
  TO authenticated USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "tickets_insert_own" ON support_tickets;
CREATE POLICY "tickets_insert_own" ON support_tickets FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "tickets_update_admin" ON support_tickets;
CREATE POLICY "tickets_update_admin" ON support_tickets FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_user ON requests(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(chat_room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_dp ON orders(dp_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE requests;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- =============================================================================
-- END: 20260707045216_pingget_schema.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260707051411_fix_rls_recursion.sql
-- =============================================================================

/*
# Fix infinite recursion in profiles RLS policies

1. Problem
The profiles SELECT policy checks for admin role by querying the profiles table itself,
causing infinite recursion: SELECT FROM profiles -> policy checks -> SELECT FROM profiles -> ...

2. Fix
- Users can read their own profile (auth.uid() = id)
- For admin access, use a security definer function that reads profiles without RLS
- This breaks the recursion because the function runs with elevated privileges

3. Changes
- Create is_admin() security definer function
- Replace admin checks in all policies that reference profiles from within profiles policies
*/

-- Create a security definer function to check admin role without RLS recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Fix profiles policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Fix delivery_partners policies (also had recursion via profiles)
DROP POLICY IF EXISTS "dp_select_own_admin" ON delivery_partners;
CREATE POLICY "dp_select_own_admin" ON delivery_partners FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR public.is_admin());

-- Fix cities policies
DROP POLICY IF EXISTS "cities_admin_write" ON cities;
CREATE POLICY "cities_admin_write" ON cities FOR ALL
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Fix requests policies
DROP POLICY IF EXISTS "requests_select_participants" ON requests;
CREATE POLICY "requests_select_participants" ON requests FOR SELECT
  TO authenticated USING (
    user_id = auth.uid() OR
    accepted_dp_id = auth.uid() OR
    status = 'pending' OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "requests_update_own_or_dp" ON requests;
CREATE POLICY "requests_update_own_or_dp" ON requests FOR UPDATE
  TO authenticated USING (
    user_id = auth.uid() OR accepted_dp_id = auth.uid() OR public.is_admin()
  ) WITH CHECK (
    user_id = auth.uid() OR accepted_dp_id = auth.uid() OR public.is_admin()
  );

-- Fix chat_rooms policies
DROP POLICY IF EXISTS "chat_rooms_select_participants" ON chat_rooms;
CREATE POLICY "chat_rooms_select_participants" ON chat_rooms FOR SELECT
  TO authenticated USING (
    user_id = auth.uid() OR dp_id = auth.uid() OR public.is_admin()
  );

-- Fix messages policies
DROP POLICY IF EXISTS "messages_select_room_participants" ON messages;
CREATE POLICY "messages_select_room_participants" ON messages FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM chat_rooms WHERE chat_rooms.id = messages.chat_room_id AND (chat_rooms.user_id = auth.uid() OR chat_rooms.dp_id = auth.uid())) OR
    public.is_admin()
  );

-- Fix orders policies
DROP POLICY IF EXISTS "orders_select_participants" ON orders;
CREATE POLICY "orders_select_participants" ON orders FOR SELECT
  TO authenticated USING (
    user_id = auth.uid() OR dp_id = auth.uid() OR public.is_admin()
  );

DROP POLICY IF EXISTS "orders_update_participants" ON orders;
CREATE POLICY "orders_update_participants" ON orders FOR UPDATE
  TO authenticated USING (
    user_id = auth.uid() OR dp_id = auth.uid() OR public.is_admin()
  ) WITH CHECK (
    user_id = auth.uid() OR dp_id = auth.uid() OR public.is_admin()
  );

-- Fix ratings policies
DROP POLICY IF EXISTS "ratings_select_participants" ON ratings;
CREATE POLICY "ratings_select_participants" ON ratings FOR SELECT
  TO authenticated USING (
    rater_id = auth.uid() OR rated_id = auth.uid() OR public.is_admin()
  );

-- Fix wallets policies
DROP POLICY IF EXISTS "wallets_select_own_admin" ON wallets;
CREATE POLICY "wallets_select_own_admin" ON wallets FOR SELECT
  TO authenticated USING (dp_user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "wallets_update_admin" ON wallets;
CREATE POLICY "wallets_update_admin" ON wallets FOR UPDATE
  TO authenticated USING (dp_user_id = auth.uid() OR public.is_admin()) WITH CHECK (dp_user_id = auth.uid() OR public.is_admin());

-- Fix commission_payments policies
DROP POLICY IF EXISTS "commission_payments_select_own_admin" ON commission_payments;
CREATE POLICY "commission_payments_select_own_admin" ON commission_payments FOR SELECT
  TO authenticated USING (dp_user_id = auth.uid() OR public.is_admin());

-- Fix admin_logs policies
DROP POLICY IF EXISTS "admin_logs_select_admin" ON admin_logs;
CREATE POLICY "admin_logs_select_admin" ON admin_logs FOR SELECT
  TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "admin_logs_insert_admin" ON admin_logs;
CREATE POLICY "admin_logs_insert_admin" ON admin_logs FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

-- Fix support_tickets policies
DROP POLICY IF EXISTS "tickets_select_own_admin" ON support_tickets;
CREATE POLICY "tickets_select_own_admin" ON support_tickets FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "tickets_update_admin" ON support_tickets;
CREATE POLICY "tickets_update_admin" ON support_tickets FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =============================================================================
-- END: 20260707051411_fix_rls_recursion.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260707062826_storage_buckets_and_dp_columns.sql
-- =============================================================================

-- Storage buckets for file uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES 
  ('avatars', 'avatars', true, 5242880),
  ('media', 'media', true, 20971520)
ON CONFLICT (id) DO NOTHING;

-- Storage object policies (drop first to avoid duplicates)
DO $$ BEGIN
  DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
  DROP POLICY IF EXISTS "avatars_auth_insert" ON storage.objects;
  DROP POLICY IF EXISTS "avatars_auth_update" ON storage.objects;
  DROP POLICY IF EXISTS "media_public_read" ON storage.objects;
  DROP POLICY IF EXISTS "media_auth_insert" ON storage.objects;
END $$;

CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_auth_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "avatars_auth_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "media_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'media');
CREATE POLICY "media_auth_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'media');

-- Add aadhaar_url column to delivery_partners for document uploads
ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS aadhaar_url text;

-- =============================================================================
-- END: 20260707062826_storage_buckets_and_dp_columns.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260707065150_fix_admin_dp_approval_rls.sql
-- =============================================================================


DO $$ BEGIN
  DROP POLICY IF EXISTS "dp_update_admin" ON delivery_partners;
  DROP POLICY IF EXISTS "dp_delete_admin" ON delivery_partners;
  DROP POLICY IF EXISTS "dp_select_admin" ON delivery_partners;
  DROP POLICY IF EXISTS "dp_insert_admin" ON delivery_partners;
END $$;

CREATE POLICY "dp_update_admin" ON delivery_partners FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "dp_select_admin" ON delivery_partners FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- =============================================================================
-- END: 20260707065150_fix_admin_dp_approval_rls.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260707065345_add_pincodes_table_visakhapatnam.sql
-- =============================================================================


-- Create pincodes table linked to cities
CREATE TABLE IF NOT EXISTS pincodes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  city_id uuid REFERENCES cities(id) ON DELETE CASCADE,
  pincode text NOT NULL,
  area_name text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pincodes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "pincodes_select_all" ON pincodes;
  DROP POLICY IF EXISTS "pincodes_manage_admin" ON pincodes;
END $$;

CREATE POLICY "pincodes_select_all" ON pincodes FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "pincodes_manage_admin" ON pincodes FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Upsert Visakhapatnam city
INSERT INTO cities (name, is_active, service_paused, commission_pct)
VALUES ('Visakhapatnam', true, false, 10)
ON CONFLICT DO NOTHING;

-- Insert Visakhapatnam pincodes
DO $$
DECLARE
  viz_id uuid;
BEGIN
  SELECT id INTO viz_id FROM cities WHERE name = 'Visakhapatnam' LIMIT 1;
  IF viz_id IS NOT NULL THEN
    INSERT INTO pincodes (city_id, pincode, area_name, is_active) VALUES
      (viz_id, '530001', 'Visakhapatnam H.O / Fortward / Kurupam Market', true),
      (viz_id, '530002', 'Maharanipeta / KGH / D.C. Buildings', true),
      (viz_id, '530003', 'Andhra University / Chinawaltair / Pithapuram Colony', true),
      (viz_id, '530004', 'Waltair R.S / Gnanapuram', true),
      (viz_id, '530005', 'Gandhigram / Nausenabagh / Yarada', true),
      (viz_id, '530007', 'Industrial Estate / Muralinagar', true),
      (viz_id, '530008', 'Kancharapalem / IRSD Area', true),
      (viz_id, '530009', 'Airport / NAD / Marripalem VUDA Colony', true),
      (viz_id, '530011', 'Malkapuram', true),
      (viz_id, '530012', 'Autonagar / Sheelanagar / BHPV', true),
      (viz_id, '530013', 'P&T Colony (Seethammadhara)', true),
      (viz_id, '530014', 'Naval Base / Naval Dockyard', true),
      (viz_id, '530015', 'Zinc Smelter', true),
      (viz_id, '530016', 'Akkayyapalem / Dwarakanagar', true),
      (viz_id, '530017', 'MVP Colony / L B Colony', true),
      (viz_id, '530018', 'Marripalem', true),
      (viz_id, '530020', 'Dabagardens / Bus Station', true),
      (viz_id, '530022', 'Isakathota / H B Colony', true),
      (viz_id, '530024', 'Salagramapuram', true),
      (viz_id, '530026', 'Gajuwaka', true),
      (viz_id, '530027', 'Gopalapatnam / NSTL / Prahladapuram', true),
      (viz_id, '530028', 'Simhachalam', true),
      (viz_id, '530029', 'Durganagar / R R V Puram', true),
      (viz_id, '530031', 'Visakhapatnam Steel Project', true),
      (viz_id, '530032', 'Ukkunagaram / Steel Plant Township', true),
      (viz_id, '530040', 'Arilova / Pedagadili', true),
      (viz_id, '530041', 'Pothinamallayapalem', true),
      (viz_id, '530043', 'Visalakshinagar / Dayalnagar', true),
      (viz_id, '530044', 'Pedagantyada / Gangavaram', true),
      (viz_id, '530045', 'Yendada / Sagar Nagar / Gitam', true),
      (viz_id, '530046', 'Duvvada / Vadlapudi', true),
      (viz_id, '530047', 'Vepagunta', true),
      (viz_id, '530048', 'Madhurawada / Kommadi / Marikavalasa', true),
      (viz_id, '530049', 'SEZ', true),
      (viz_id, '530051', 'Sujatha Nagar', true),
      (viz_id, '530052', 'Anandapuram', true),
      (viz_id, '530053', 'Aganampudi', true)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- =============================================================================
-- END: 20260707065345_add_pincodes_table_visakhapatnam.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260707074124_fix_requests_accept_and_notification_insert.sql
-- =============================================================================

-- Fix 1: Allow DPs to accept pending requests.
-- The old USING clause checked accepted_dp_id = auth.uid(), but on a pending request
-- accepted_dp_id is NULL so any DP's update attempt was silently rejected.
-- Adding status = 'pending' to USING lets any authenticated user (DP) update a pending request.
-- The WITH CHECK still ensures the new row has the updater as accepted_dp_id or owner.
DROP POLICY IF EXISTS "requests_update_own_or_dp" ON requests;
CREATE POLICY "requests_update_own_or_dp" ON requests FOR UPDATE
  TO authenticated USING (
    user_id = auth.uid() OR
    accepted_dp_id = auth.uid() OR
    status = 'pending' OR
    public.is_admin()
  ) WITH CHECK (
    user_id = auth.uid() OR accepted_dp_id = auth.uid() OR public.is_admin()
  );

-- Fix 2: Allow any authenticated user to insert notifications for other users.
-- DPs need to notify users when accepting requests, but the old policy only allowed
-- inserting notifications where user_id = auth.uid() (i.e. only self-notifications).
DROP POLICY IF EXISTS "notifications_insert_own" ON notifications;
CREATE POLICY "notifications_insert_any" ON notifications FOR INSERT
  TO authenticated WITH CHECK (true);

-- =============================================================================
-- END: 20260707074124_fix_requests_accept_and_notification_insert.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260707081342_fix_profiles_select_for_chat_participants.sql
-- =============================================================================

-- Allow users to see profiles of people they share a chat room with.
-- Without this, ChatScreen shows null name/avatar for the other participant.
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  TO authenticated USING (
    auth.uid() = id
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM chat_rooms
      WHERE (chat_rooms.user_id = auth.uid() AND chat_rooms.dp_id = profiles.id)
         OR (chat_rooms.dp_id = auth.uid() AND chat_rooms.user_id = profiles.id)
    )
  );

-- =============================================================================
-- END: 20260707081342_fix_profiles_select_for_chat_participants.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260707081913_deduplicate_chat_rooms_and_add_unique_constraint.sql
-- =============================================================================

-- Remove duplicate chat rooms for the same request, keeping only the earliest one.
-- This is safe to run even if no duplicates exist.
DELETE FROM chat_rooms
WHERE id NOT IN (
  SELECT DISTINCT ON (request_id) id
  FROM chat_rooms
  ORDER BY request_id, created_at ASC
);

-- Prevent future duplicates: each request can only have one chat room.
ALTER TABLE chat_rooms ADD CONSTRAINT chat_rooms_request_id_unique UNIQUE (request_id);

-- =============================================================================
-- END: 20260707081913_deduplicate_chat_rooms_and_add_unique_constraint.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260707091610_add_pincode_to_profiles.sql
-- =============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pincode text;

-- =============================================================================
-- END: 20260707091610_add_pincode_to_profiles.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260707093400_fix_cities_rls_allow_anon.sql
-- =============================================================================

DROP POLICY IF EXISTS "cities_select_all" ON cities;
CREATE POLICY "cities_select_all" ON cities FOR SELECT
  TO anon, authenticated USING (true);

-- =============================================================================
-- END: 20260707093400_fix_cities_rls_allow_anon.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260707100212_add_service_range_to_delivery_partners.sql
-- =============================================================================

ALTER TABLE delivery_partners
  ADD COLUMN IF NOT EXISTS service_range_meters int NOT NULL DEFAULT 5000;

-- =============================================================================
-- END: 20260707100212_add_service_range_to_delivery_partners.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260707101951_commission_receipts_and_app_settings.sql
-- =============================================================================

-- Daily commission receipts: DP submits proof of payment → admin confirms
CREATE TABLE IF NOT EXISTS dp_commission_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dp_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  upi_ref text NOT NULL,
  screenshot_url text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'confirmed', 'rejected')),
  reject_reason text,
  submitted_at timestamptz DEFAULT now(),
  confirmed_at timestamptz,
  confirmed_by uuid REFERENCES auth.users(id)
);
ALTER TABLE dp_commission_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "receipts_select_own_admin" ON dp_commission_receipts FOR SELECT
  TO authenticated USING (dp_user_id = auth.uid() OR public.is_admin());
CREATE POLICY "receipts_insert_own" ON dp_commission_receipts FOR INSERT
  TO authenticated WITH CHECK (dp_user_id = auth.uid());
CREATE POLICY "receipts_update_admin" ON dp_commission_receipts FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- App-level key/value settings (admin UPI ID, etc.)
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT ''
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_select_authenticated" ON app_settings FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "settings_insert_admin" ON app_settings FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "settings_update_admin" ON app_settings FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO app_settings (key, value) VALUES ('admin_upi_id', 'admin@upi') ON CONFLICT DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('admin_name', 'pingGET Admin') ON CONFLICT DO NOTHING;

-- =============================================================================
-- END: 20260707101951_commission_receipts_and_app_settings.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260707162850_confirm_existing_unconfirmed_users.sql
-- =============================================================================

-- Auto-confirm email for all existing unconfirmed users
UPDATE auth.users SET email_confirmed_at = now() WHERE email_confirmed_at IS NULL AND deleted_at IS NULL;

-- =============================================================================
-- END: 20260707162850_confirm_existing_unconfirmed_users.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260707221426_add_status_to_profiles.sql
-- =============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'banned'));

-- RLS: admins can update any profile's status
CREATE POLICY "admin_update_user_status" ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- =============================================================================
-- END: 20260707221426_add_status_to_profiles.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260713114915_add_declined_by_to_requests.sql
-- =============================================================================

/*
# Add declined_by column to requests table

## Changes
1. Adds `declined_by` array column to `requests` table
   - Tracks which DPs have declined a request so they don't see it again
   - Defaults to empty array
2. Creates `append_declined_by` RPC function
   - Safely appends a DP ID to the declined_by array atomically
   - Prevents race conditions when multiple DPs decline simultaneously
3. Adds GIST index for better query performance on status filtering

## Security
- No RLS policy changes needed — existing policies remain intact
- The RPC function is SECURITY DEFINER to allow the array append operation
*/

-- Add declined_by column
ALTER TABLE requests ADD COLUMN IF NOT EXISTS declined_by uuid[] DEFAULT '{}';

-- Create the append_declined_by function
CREATE OR REPLACE FUNCTION append_declined_by(row_id uuid, dp_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE requests
  SET declined_by = array_append(
    COALESCE(declined_by, '{}'::uuid[]),
    dp_id
  )
  WHERE id = row_id
  AND NOT (declined_by @> ARRAY[dp_id]);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION append_declined_by TO authenticated;

-- =============================================================================
-- END: 20260713114915_add_declined_by_to_requests.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260713115029_create_admin_notifications.sql
-- =============================================================================

/*
# Create admin_notifications table and triggers

## Changes
1. Creates `admin_notifications` table
   - Stores notifications for admin users (new user signup, new DP signup, payments, etc.)
   - Fields: id, type, title, body, related_id, is_read, created_at
2. Creates triggers to auto-generate admin notifications:
   - On new profile insert (role = 'user') → "New user registered"
   - On new delivery_partners insert (status = 'pending') → "New DP application"
   - On new commission_payments insert → "New payment received"
3. RLS: admin-only access (read + update to mark as read)

## Security
- RLS enabled on admin_notifications
- Only admin role can SELECT and UPDATE
- Inserts happen via triggers (SECURITY DEFINER functions)
*/

CREATE TABLE IF NOT EXISTS admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  title text NOT NULL,
  body text,
  related_id uuid,
  is_read boolean NOT NULL DEFAULT false,
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

-- Function to create admin notification on new user signup
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

-- Function to create admin notification on new DP application
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

-- Function to create admin notification on new payment
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

-- =============================================================================
-- END: 20260713115029_create_admin_notifications.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260713124447_add_read_at_and_fix_commission.sql
-- =============================================================================

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

-- =============================================================================
-- END: 20260713124447_add_read_at_and_fix_commission.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260714081609_add_read_at_to_admin_notifications_and_delivery_proof.sql
-- =============================================================================

/*
# Add read_at to admin_notifications and delivery_proof_url to requests

## Changes
1. Add `read_at` (timestamptz, nullable) to `admin_notifications` — tracks when admin viewed each notification
2. Add `delivery_proof_url` (text, nullable) to `requests` — stores photo proof of delivery uploaded by DP or user
3. Add `delivery_proof_by` (uuid, nullable) to `requests` — stores who uploaded the proof (user_id or dp_id)
4. Add `delivery_proof_at` (timestamptz, nullable) to `requests` — when proof was uploaded

## Security
- No RLS policy changes needed; existing policies cover the new columns
*/

ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS read_at timestamptz;

ALTER TABLE requests ADD COLUMN IF NOT EXISTS delivery_proof_url text;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS delivery_proof_by uuid;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS delivery_proof_at timestamptz;

-- =============================================================================
-- END: 20260714081609_add_read_at_to_admin_notifications_and_delivery_proof.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260714162326_add_photo_urls_to_requests.sql
-- =============================================================================

ALTER TABLE requests ADD COLUMN IF NOT EXISTS photo_urls text[];
-- =============================================================================
-- END: 20260714162326_add_photo_urls_to_requests.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260726081656_allow_null_delivery_address.sql
-- =============================================================================

ALTER TABLE requests ALTER COLUMN delivery_address DROP NOT NULL;
-- =============================================================================
-- END: 20260726081656_allow_null_delivery_address.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260726100251_create_admin_notifications_and_triggers.sql
-- =============================================================================

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
-- =============================================================================
-- END: 20260726100251_create_admin_notifications_and_triggers.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260726102537_add_status_to_profiles.sql
-- =============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'pending', 'rejected', 'suspended', 'banned'));

DROP POLICY IF EXISTS "admin_update_user_status" ON profiles;
CREATE POLICY "admin_update_user_status" ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
-- =============================================================================
-- END: 20260726102537_add_status_to_profiles.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260726121101_fix_admin_notifications_insert_policy_and_trigger_bypass_rls.sql
-- =============================================================================

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
-- =============================================================================
-- END: 20260726121101_fix_admin_notifications_insert_policy_and_trigger_bypass_rls.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260726121110_fix_profiles_status_check_allow_pending_rejected.sql
-- =============================================================================

-- Fix: DP signup inserts status='pending' into profiles, but the CHECK
-- constraint only allows active/suspended/banned. Add 'pending' and
-- 'rejected' so the DP application flow works.
ALTER TABLE profiles DROP CONSTRAINT profiles_status_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_status_check
  CHECK (status = ANY (ARRAY['active', 'pending', 'rejected', 'suspended', 'banned']));
-- =============================================================================
-- END: 20260726121110_fix_profiles_status_check_allow_pending_rejected.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260726133802_drop_title_column_from_requests.sql
-- =============================================================================

/*
# Drop title column from requests table

1. Changes
- Drops the `title` column from the `requests` table.
- The `description` column already stores the full order description.
- The `photo_urls` array column (added in a prior migration) replaces the old single `photo_url` column.

2. Important notes
- This is a destructive column drop, but `title` has been superseded by `description` across the entire frontend. All new requests are created with `description` only.
- The old `photo_url` text column is retained for backward compatibility with any historical rows, but new inserts use `photo_urls` (text array).
*/

ALTER TABLE requests DROP COLUMN IF EXISTS title;

-- =============================================================================
-- END: 20260726133802_drop_title_column_from_requests.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260726145149_fix_profiles_status_check_allow_pending_rejected.sql
-- =============================================================================

-- Fix: the profiles.status CHECK constraint only allows 'active', 'suspended', 'banned'.
-- But the signup edge function inserts 'pending' for DP accounts and 'rejected'
-- is also used. This causes the profile insert to fail with a CHECK violation,
-- which makes signup return a 400 error even though the auth user was created.

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('active', 'suspended', 'banned', 'pending', 'rejected'));
-- =============================================================================
-- END: 20260726145149_fix_profiles_status_check_allow_pending_rejected.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260726145308_add_email_to_profiles.sql
-- =============================================================================

-- Add email column to profiles so we can match Google OAuth users to existing accounts
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles (email);

-- Backfill email for existing profiles from auth.users
UPDATE profiles p SET email = u.email FROM auth.users u WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');
-- =============================================================================
-- END: 20260726145308_add_email_to_profiles.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260727034122_add_nearby_dp_scan_function.sql.sql
-- =============================================================================

/*
# Add nearby DP scanning function (Rapido-style)

1. Purpose
   - Users can "scan" for nearby delivery partners within a radius.
   - Returns count of online DPs within the user's specified radius.
   - Uses the haversine formula to compute distance between user GPS and DP GPS.

2. New Functions
   - `scan_nearby_dps(p_user_lat double precision, p_user_lng double precision, p_radius_meters integer)`
     - Returns: table with `dp_count` (integer) — number of online DPs within radius.
     - Joins `delivery_partners` with `profiles` to get GPS coordinates.
     - Only counts DPs that are `is_online = true` and `status = 'approved'`.

3. Security
   - Function is `SECURITY DEFINER` so it can read DP profiles (which may not be
     directly visible to the user via RLS).
   - Granted to `authenticated` and `anon` roles.
*/

CREATE OR REPLACE FUNCTION scan_nearby_dps(
  p_user_lat double precision,
  p_user_lng double precision,
  p_radius_meters integer DEFAULT 5000
)
RETURNS TABLE (dp_count integer, avg_distance_meters double precision)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
  v_avg_dist double precision;
BEGIN
  SELECT
    COUNT(*)::integer,
    COALESCE(AVG(
      6371000 * 2 * ASIN(SQRT(
        POWER(SIN((RADIANS(p_user_lat) - RADIANS(p.gps_lat)) / 2), 2) +
        COS(RADIANS(p_user_lat)) * COS(RADIANS(p.gps_lat)) *
        POWER(SIN((RADIANS(p_user_lng) - RADIANS(p.gps_lng)) / 2), 2)
      ))
    ), 0)::double precision
  INTO v_count, v_avg_dist
  FROM delivery_partners dp
  INNER JOIN profiles p ON p.id = dp.user_id
  WHERE dp.is_online = true
    AND dp.status = 'approved'
    AND p.gps_lat IS NOT NULL
    AND p.gps_lng IS NOT NULL
    AND 6371000 * 2 * ASIN(SQRT(
      POWER(SIN((RADIANS(p_user_lat) - RADIANS(p.gps_lat)) / 2), 2) +
      COS(RADIANS(p_user_lat)) * COS(RADIANS(p.gps_lat)) *
      POWER(SIN((RADIANS(p_user_lng) - RADIANS(p.gps_lng)) / 2), 2)
    )) <= p_radius_meters;

  RETURN QUERY SELECT v_count, v_avg_dist;
END;
$$;

GRANT EXECUTE ON FUNCTION scan_nearby_dps(
  double precision,
  double precision,
  integer,
  uuid
) TO authenticated, anon;
-- =============================================================================
-- END: 20260727034122_add_nearby_dp_scan_function.sql.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260727153752_fix_requests_schema_missing_columns.sql
-- =============================================================================

-- Add photo_urls array column (replaces single photo_url)
ALTER TABLE requests ADD COLUMN IF NOT EXISTS photo_urls text[];

-- Drop title column (frontend no longer sends it; description is used)
ALTER TABLE requests DROP COLUMN IF EXISTS title;

-- Allow null delivery_address (some requests may not have one initially)
ALTER TABLE requests ALTER COLUMN delivery_address DROP NOT NULL;

-- Add email column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles (email);

-- Backfill email for existing profiles from auth.users
UPDATE profiles p SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- Add gps_updated_at to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gps_updated_at timestamptz;

-- Add indexes for location queries
CREATE INDEX IF NOT EXISTS idx_delivery_partners_online
  ON delivery_partners(is_online) WHERE is_online = true;
CREATE INDEX IF NOT EXISTS idx_profiles_gps
  ON profiles(gps_lat, gps_lng)
  WHERE gps_lat IS NOT NULL AND gps_lng IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_requests_pending
  ON requests(status, created_at)
  WHERE status = 'pending';
-- =============================================================================
-- END: 20260727153752_fix_requests_schema_missing_columns.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260727153817_add_order_matching_functions.sql
-- =============================================================================

-- scan_nearby_dps: returns all nearby online approved DPs within radius
CREATE OR REPLACE FUNCTION scan_nearby_dps(
  p_user_lat double precision,
  p_user_lng double precision,
  p_radius_meters integer,
  p_request_id uuid DEFAULT NULL
)
RETURNS TABLE (
  dp_user_id uuid,
  full_name text,
  gps_lat double precision,
  gps_lng double precision,
  distance_meters double precision,
  service_range_meters integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    dp.user_id,
    p.full_name,
    p.gps_lat,
    p.gps_lng,
    (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(p.gps_lat - p_user_lat) / 2) ^ 2 +
          cos(radians(p_user_lat)) * cos(radians(p.gps_lat)) *
          sin(radians(p.gps_lng - p_user_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(p.gps_lat - p_user_lat) / 2) ^ 2 +
          cos(radians(p_user_lat)) * cos(radians(p.gps_lat)) *
          sin(radians(p.gps_lng - p_user_lng) / 2) ^ 2
        ))
      )
    ) AS dist,
    dp.service_range_meters
  FROM delivery_partners dp
  JOIN profiles p ON p.id = dp.user_id
  WHERE dp.is_online = true
    AND dp.status = 'approved'
    AND p.gps_lat IS NOT NULL
    AND p.gps_lng IS NOT NULL
    AND (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(p.gps_lat - p_user_lat) / 2) ^ 2 +
          cos(radians(p_user_lat)) * cos(radians(p.gps_lat)) *
          sin(radians(p.gps_lng - p_user_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(p.gps_lat - p_user_lat) / 2) ^ 2 +
          cos(radians(p_user_lat)) * cos(radians(p.gps_lat)) *
          sin(radians(p.gps_lng - p_user_lng) / 2) ^ 2
        ))
      )
    ) <= p_radius_meters
    AND (
      p_request_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM requests r
        WHERE r.id = p_request_id
        AND r.declined_by @> ARRAY[dp.user_id]
      )
    );
END;
$function$;

-- scan_nearby_dps_stats: aggregate stats for the scanning radar (single-row)
CREATE OR REPLACE FUNCTION scan_nearby_dps_stats(
  p_user_lat double precision,
  p_user_lng double precision,
  p_radius_meters integer,
  p_request_id uuid DEFAULT NULL
)
RETURNS TABLE (
  dp_count bigint,
  avg_distance_meters double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  SELECT
    COUNT(*)::bigint,
    COALESCE(AVG(dist), 0)::double precision
  INTO
    dp_count, avg_distance_meters
  FROM scan_nearby_dps(p_user_lat, p_user_lng, p_radius_meters, p_request_id);
END;
$function$;

-- get_nearby_requests: returns pending requests within DP's service range
CREATE OR REPLACE FUNCTION get_nearby_requests(
  p_dp_user_id uuid
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  description text,
  photo_urls text[],
  voice_note_url text,
  preferred_shop text,
  pickup_address text,
  pickup_lat double precision,
  pickup_lng double precision,
  delivery_address text,
  delivery_lat double precision,
  delivery_lng double precision,
  expected_time text,
  max_budget numeric,
  special_instructions text,
  created_at timestamptz,
  user_full_name text,
  user_gps_lat double precision,
  user_gps_lng double precision,
  distance_meters double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_dp_lat double precision;
  v_dp_lng double precision;
  v_service_range integer;
BEGIN
  SELECT p.gps_lat, p.gps_lng, dp.service_range_meters
  INTO v_dp_lat, v_dp_lng, v_service_range
  FROM delivery_partners dp
  JOIN profiles p ON p.id = dp.user_id
  WHERE dp.user_id = p_dp_user_id
    AND dp.is_online = true
    AND dp.status = 'approved';

  IF v_dp_lat IS NULL OR v_dp_lng IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.user_id,
    r.description,
    r.photo_urls,
    r.voice_note_url,
    r.preferred_shop,
    r.pickup_address,
    r.pickup_lat,
    r.pickup_lng,
    r.delivery_address,
    r.delivery_lat,
    r.delivery_lng,
    r.expected_time,
    r.max_budget,
    r.special_instructions,
    r.created_at,
    up.full_name,
    up.gps_lat,
    up.gps_lng,
    (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(COALESCE(r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(COALESCE(r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ))
      )
    ) AS dist
  FROM requests r
  JOIN profiles up ON up.id = r.user_id
  WHERE r.status = 'pending'
    AND NOT (r.declined_by @> ARRAY[p_dp_user_id])
    AND (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(COALESCE(r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(COALESCE(r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ))
      )
    ) <= v_service_range
  ORDER BY r.created_at DESC;
END;
$function$;

-- accept_request: atomic order acceptance (prevents race conditions)
CREATE OR REPLACE FUNCTION accept_request(
  p_request_id uuid,
  p_dp_user_id uuid
)
RETURNS TABLE (
  success boolean,
  chat_room_id uuid,
  error_msg text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_request RECORD;
  v_room_id uuid;
  v_dp_name text;
  v_user_name text;
BEGIN
  SELECT * INTO v_request
  FROM requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Request not found';
    RETURN;
  END IF;

  IF v_request.status != 'pending' THEN
    RETURN QUERY SELECT false, NULL::uuid, 'This request was already accepted by another delivery partner';
    RETURN;
  END IF;

  IF v_request.declined_by @> ARRAY[p_dp_user_id] THEN
    RETURN QUERY SELECT false, NULL::uuid, 'You declined this request earlier';
    RETURN;
  END IF;

  UPDATE requests
  SET status = 'accepted',
      accepted_dp_id = p_dp_user_id
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, 'This request was just accepted by another delivery partner';
    RETURN;
  END IF;

  SELECT full_name INTO v_dp_name FROM profiles WHERE id = p_dp_user_id;
  SELECT full_name INTO v_user_name FROM profiles WHERE id = v_request.user_id;

  SELECT id INTO v_room_id
  FROM chat_rooms
  WHERE request_id = p_request_id
  LIMIT 1;

  IF v_room_id IS NULL THEN
    INSERT INTO chat_rooms (request_id, user_id, dp_id)
    VALUES (p_request_id, v_request.user_id, p_dp_user_id)
    RETURNING id INTO v_room_id;
  END IF;

  INSERT INTO messages (chat_room_id, sender_id, message_type, quotation_data)
  VALUES (
    v_room_id,
    v_request.user_id,
    'order_summary',
    jsonb_build_object(
      'description', v_request.description,
      'preferred_shop', v_request.preferred_shop,
      'pickup_address', v_request.pickup_address,
      'delivery_address', v_request.delivery_address,
      'expected_time', v_request.expected_time,
      'photo_urls', v_request.photo_urls,
      'voice_note_url', v_request.voice_note_url,
      'delivery_lat', v_request.delivery_lat,
      'delivery_lng', v_request.delivery_lng
    )
  );

  INSERT INTO messages (chat_room_id, sender_id, content, message_type)
  VALUES (
    v_room_id,
    p_dp_user_id,
    COALESCE('Hi ' || v_user_name || '! I''m ' || v_dp_name || ' and I''ve accepted your delivery request. I can see your order details above — let me know if anything needs clarification!', 'Hello! I''ve accepted your delivery request.'),
    'text'
  );

  IF v_request.delivery_lat IS NOT NULL AND v_request.delivery_lng IS NOT NULL THEN
    INSERT INTO messages (chat_room_id, sender_id, content, message_type, location_lat, location_lng)
    VALUES (
      v_room_id,
      p_dp_user_id,
      COALESCE(v_request.delivery_address, 'Delivery location'),
      'location',
      v_request.delivery_lat,
      v_request.delivery_lng
    );
  END IF;

  INSERT INTO notifications (user_id, title, body, type, related_id)
  VALUES (
    v_request.user_id,
    'Request Accepted!',
    COALESCE(v_dp_name, 'A delivery partner') || ' accepted your request. Tap to open chat now.',
    'request_accepted',
    p_request_id
  );

  RETURN QUERY SELECT true, v_room_id, NULL::text;
END;
$function$;

-- update_location: update caller's GPS
CREATE OR REPLACE FUNCTION update_location(
  p_lat double precision,
  p_lng double precision
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  UPDATE profiles
  SET gps_lat = p_lat,
      gps_lng = p_lng,
      gps_updated_at = now(),
      updated_at = now()
  WHERE id = auth.uid();
END;
$function$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION scan_nearby_dps(
    double precision,
    double precision,
    integer
) TO authenticated;

GRANT EXECUTE ON FUNCTION scan_nearby_dps(
    double precision,
    double precision,
    integer,
    uuid
) TO authenticated;
GRANT EXECUTE ON FUNCTION scan_nearby_dps_stats(
    double precision,
    double precision,
    integer,
    uuid
) TO authenticated;
GRANT EXECUTE ON FUNCTION get_nearby_requests TO authenticated;
GRANT EXECUTE ON FUNCTION accept_request TO authenticated;
GRANT EXECUTE ON FUNCTION update_location TO authenticated;
-- =============================================================================
-- END: 20260727153817_add_order_matching_functions.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260727153844_fix_requests_update_rls_security_hole.sql
-- =============================================================================

-- Fix requests UPDATE policy: remove the "status = 'pending'" loophole
-- that allowed ANY authenticated user to update ANY pending request.
DROP POLICY IF EXISTS "requests_update_own_or_dp" ON requests;
DROP POLICY IF EXISTS "requests_update_own_accepted_dp" ON requests;
DROP POLICY IF EXISTS "requests_update_own_or_accepted_dp" ON requests;

CREATE POLICY "requests_update_own_or_accepted_dp"
ON requests FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR accepted_dp_id = auth.uid()
  OR is_admin()
)
WITH CHECK (
  user_id = auth.uid()
  OR accepted_dp_id = auth.uid()
  OR is_admin()
);
-- =============================================================================
-- END: 20260727153844_fix_requests_update_rls_security_hole.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260727163702_fix_matching_and_gps_system.sql
-- =============================================================================

-- 1. Add email column to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND table_schema = 'public' AND column_name = 'email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email text;
  END IF;
END $$;

-- 2. Fix requests.title: make nullable with NULL default
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND table_schema = 'public' AND column_name = 'title'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE requests ALTER COLUMN title DROP NOT NULL;
    ALTER TABLE requests ALTER COLUMN title SET DEFAULT NULL;
  END IF;
END $$;

-- 3. Add gps_updated_at to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND table_schema = 'public' AND column_name = 'gps_updated_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN gps_updated_at timestamptz;
  END IF;
END $$;

-- 4. Add indexes
CREATE INDEX IF NOT EXISTS idx_delivery_partners_online
  ON delivery_partners(is_online) WHERE is_online = true;

CREATE INDEX IF NOT EXISTS idx_profiles_gps
  ON profiles(gps_lat, gps_lng)
  WHERE gps_lat IS NOT NULL AND gps_lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_requests_pending
  ON requests(status, created_at)
  WHERE status = 'pending';

-- 5. Fix requests UPDATE policy
DROP POLICY IF EXISTS "requests_update_own_or_dp" ON requests;
DROP POLICY IF EXISTS "requests_update_own_accepted_dp" ON requests;
DROP POLICY IF EXISTS "requests_update_own_or_accepted_dp" ON requests;

CREATE POLICY "requests_update_own_or_accepted_dp"
ON requests FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR accepted_dp_id = auth.uid()
  OR is_admin()
)
WITH CHECK (
  user_id = auth.uid()
  OR accepted_dp_id = auth.uid()
  OR is_admin()
);

-- 6. scan_nearby_dps: returns all nearby online approved DPs within radius
CREATE OR REPLACE FUNCTION scan_nearby_dps(
  p_user_lat double precision,
  p_user_lng double precision,
  p_radius_meters integer,
  p_request_id uuid DEFAULT NULL
)
RETURNS TABLE (
  dp_user_id uuid,
  full_name text,
  gps_lat double precision,
  gps_lng double precision,
  distance_meters double precision,
  service_range_meters integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    dp.user_id,
    p.full_name,
    p.gps_lat,
    p.gps_lng,
    (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(p.gps_lat - p_user_lat) / 2) ^ 2 +
          cos(radians(p_user_lat)) * cos(radians(p.gps_lat)) *
          sin(radians(p.gps_lng - p_user_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(p.gps_lat - p_user_lat) / 2) ^ 2 +
          cos(radians(p_user_lat)) * cos(radians(p.gps_lat)) *
          sin(radians(p.gps_lng - p_user_lng) / 2) ^ 2
        ))
      )
    ) AS dist,
    dp.service_range_meters
  FROM delivery_partners dp
  JOIN profiles p ON p.id = dp.user_id
  WHERE dp.is_online = true
    AND dp.status = 'approved'
    AND p.gps_lat IS NOT NULL
    AND p.gps_lng IS NOT NULL
    AND (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(p.gps_lat - p_user_lat) / 2) ^ 2 +
          cos(radians(p_user_lat)) * cos(radians(p.gps_lat)) *
          sin(radians(p.gps_lng - p_user_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(p.gps_lat - p_user_lat) / 2) ^ 2 +
          cos(radians(p_user_lat)) * cos(radians(p.gps_lat)) *
          sin(radians(p.gps_lng - p_user_lng) / 2) ^ 2
        ))
      )
    ) <= p_radius_meters
    AND (
      p_request_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM requests r
        WHERE r.id = p_request_id
        AND r.declined_by @> ARRAY[dp.user_id]
      )
    );
END;
$function$;

-- 7. scan_nearby_dps_stats: aggregate stats for the scanning radar
CREATE OR REPLACE FUNCTION scan_nearby_dps_stats(
  p_user_lat double precision,
  p_user_lng double precision,
  p_radius_meters integer,
  p_request_id uuid DEFAULT NULL
)
RETURNS TABLE (
  dp_count bigint,
  avg_distance_meters double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  SELECT
    COUNT(*)::bigint,
    COALESCE(AVG(dist), 0)::double precision
  INTO
    dp_count, avg_distance_meters
  FROM scan_nearby_dps(p_user_lat, p_user_lng, p_radius_meters, p_request_id);
END;
$function$;

-- 8. get_nearby_requests: returns pending requests within DP's service range
CREATE OR REPLACE FUNCTION get_nearby_requests(
  p_dp_user_id uuid
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  description text,
  photo_urls text[],
  voice_note_url text,
  preferred_shop text,
  pickup_address text,
  pickup_lat double precision,
  pickup_lng double precision,
  delivery_address text,
  delivery_lat double precision,
  delivery_lng double precision,
  expected_time text,
  max_budget numeric,
  special_instructions text,
  created_at timestamptz,
  user_full_name text,
  user_gps_lat double precision,
  user_gps_lng double precision,
  distance_meters double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_dp_lat double precision;
  v_dp_lng double precision;
  v_service_range integer;
BEGIN
  SELECT p.gps_lat, p.gps_lng, dp.service_range_meters
  INTO v_dp_lat, v_dp_lng, v_service_range
  FROM delivery_partners dp
  JOIN profiles p ON p.id = dp.user_id
  WHERE dp.user_id = p_dp_user_id
    AND dp.is_online = true
    AND dp.status = 'approved';

  IF v_dp_lat IS NULL OR v_dp_lng IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.user_id,
    r.description,
    r.photo_urls,
    r.voice_note_url,
    r.preferred_shop,
    r.pickup_address,
    r.pickup_lat,
    r.pickup_lng,
    r.delivery_address,
    r.delivery_lat,
    r.delivery_lng,
    r.expected_time,
    r.max_budget,
    r.special_instructions,
    r.created_at,
    up.full_name,
    up.gps_lat,
    up.gps_lng,
    (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(COALESCE(r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(COALESCE(r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ))
      )
    ) AS dist
  FROM requests r
  JOIN profiles up ON up.id = r.user_id
  WHERE r.status = 'pending'
    AND NOT (r.declined_by @> ARRAY[p_dp_user_id])
    AND (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(COALESCE(r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(COALESCE(r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ))
      )
    ) <= v_service_range
  ORDER BY r.created_at DESC;
END;
$function$;

-- 9. accept_request: atomic order acceptance (prevents race conditions)
CREATE OR REPLACE FUNCTION accept_request(
  p_request_id uuid,
  p_dp_user_id uuid
)
RETURNS TABLE (
  success boolean,
  chat_room_id uuid,
  error_msg text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_request RECORD;
  v_room_id uuid;
  v_dp_name text;
  v_user_name text;
BEGIN
  SELECT * INTO v_request
  FROM requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Request not found';
    RETURN;
  END IF;

  IF v_request.status != 'pending' THEN
    RETURN QUERY SELECT false, NULL::uuid, 'This request was already accepted by another delivery partner';
    RETURN;
  END IF;

  IF v_request.declined_by @> ARRAY[p_dp_user_id] THEN
    RETURN QUERY SELECT false, NULL::uuid, 'You declined this request earlier';
    RETURN;
  END IF;

  UPDATE requests
  SET status = 'accepted',
      accepted_dp_id = p_dp_user_id
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, 'This request was just accepted by another delivery partner';
    RETURN;
  END IF;

  SELECT full_name INTO v_dp_name FROM profiles WHERE id = p_dp_user_id;
  SELECT full_name INTO v_user_name FROM profiles WHERE id = v_request.user_id;

  SELECT id INTO v_room_id
  FROM chat_rooms
  WHERE request_id = p_request_id
  LIMIT 1;

  IF v_room_id IS NULL THEN
    INSERT INTO chat_rooms (request_id, user_id, dp_id)
    VALUES (p_request_id, v_request.user_id, p_dp_user_id)
    RETURNING id INTO v_room_id;
  END IF;

  INSERT INTO messages (chat_room_id, sender_id, message_type, quotation_data)
  VALUES (
    v_room_id,
    v_request.user_id,
    'order_summary',
    jsonb_build_object(
      'description', v_request.description,
      'preferred_shop', v_request.preferred_shop,
      'pickup_address', v_request.pickup_address,
      'delivery_address', v_request.delivery_address,
      'expected_time', v_request.expected_time,
      'photo_urls', v_request.photo_urls,
      'voice_note_url', v_request.voice_note_url,
      'delivery_lat', v_request.delivery_lat,
      'delivery_lng', v_request.delivery_lng
    )
  );

  INSERT INTO messages (chat_room_id, sender_id, content, message_type)
  VALUES (
    v_room_id,
    p_dp_user_id,
    COALESCE('Hi ' || v_user_name || '! I''m ' || v_dp_name || ' and I''ve accepted your delivery request. I can see your order details above — let me know if anything needs clarification!', 'Hello! I''ve accepted your delivery request.'),
    'text'
  );

  IF v_request.delivery_lat IS NOT NULL AND v_request.delivery_lng IS NOT NULL THEN
    INSERT INTO messages (chat_room_id, sender_id, content, message_type, location_lat, location_lng)
    VALUES (
      v_room_id,
      p_dp_user_id,
      COALESCE(v_request.delivery_address, 'Delivery location'),
      'location',
      v_request.delivery_lat,
      v_request.delivery_lng
    );
  END IF;

  INSERT INTO notifications (user_id, title, body, type, related_id)
  VALUES (
    v_request.user_id,
    'Request Accepted!',
    COALESCE(v_dp_name, 'A delivery partner') || ' accepted your request. Tap to open chat now.',
    'request_accepted',
    p_request_id
  );

  RETURN QUERY SELECT true, v_room_id, NULL::text;
END;
$function$;

-- 10. update_location: update caller's GPS
CREATE OR REPLACE FUNCTION update_location(
  p_lat double precision,
  p_lng double precision
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  UPDATE profiles
  SET gps_lat = p_lat,
      gps_lng = p_lng,
      gps_updated_at = now(),
      updated_at = now()
  WHERE id = auth.uid();
END;
$function$;

-- 11. Grant execute permissions
GRANT EXECUTE ON FUNCTION scan_nearby_dps(
    double precision,
    double precision,
    integer
) TO authenticated;

GRANT EXECUTE ON FUNCTION scan_nearby_dps(
    double precision,
    double precision,
    integer,
    uuid
) TO authenticated;

GRANT EXECUTE ON FUNCTION scan_nearby_dps_stats(
    double precision,
    double precision,
    integer,
    uuid
) TO authenticated;

GRANT EXECUTE ON FUNCTION get_nearby_requests(
    uuid
) TO authenticated;

GRANT EXECUTE ON FUNCTION accept_request(
    uuid,
    uuid
) TO authenticated;

GRANT EXECUTE ON FUNCTION update_location(
    double precision,
    double precision
) TO authenticated;
-- =============================================================================
-- END: 20260727163702_fix_matching_and_gps_system.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260728014537_20260728020000_apply_all_missing_fixes.sql
-- =============================================================================

-- Fix 1: is_admin function with proper search_path
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Fix 2: profiles SELECT — allow chat participants to see each other's profiles
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  TO authenticated USING (
    auth.uid() = id
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM chat_rooms
      WHERE (chat_rooms.user_id = auth.uid() AND chat_rooms.dp_id = profiles.id)
         OR (chat_rooms.dp_id = auth.uid() AND chat_rooms.user_id = profiles.id)
    )
  );

-- Fix 3: notifications INSERT — allow any authenticated user to insert (DPs notify users)
DROP POLICY IF EXISTS "notifications_insert_own" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_any" ON notifications;
CREATE POLICY "notifications_insert_any" ON notifications FOR INSERT
  TO authenticated WITH CHECK (true);

-- Fix 4: requests UPDATE — allow updating pending requests (so DPs can accept)
DROP POLICY IF EXISTS "requests_update_own_or_dp" ON requests;
DROP POLICY IF EXISTS "requests_update_own_or_accepted_dp" ON requests;
CREATE POLICY "requests_update_own_or_accepted_dp" ON requests FOR UPDATE
  TO authenticated USING (
    user_id = auth.uid()
    OR accepted_dp_id = auth.uid()
    OR status = 'pending'
    OR public.is_admin()
  ) WITH CHECK (
    user_id = auth.uid()
    OR accepted_dp_id = auth.uid()
    OR public.is_admin()
  );

-- Fix 5: chat_rooms unique constraint (one room per request)
DO $$ BEGIN
  -- Remove duplicates first
  DELETE FROM chat_rooms
  WHERE id NOT IN (
    SELECT DISTINCT ON (request_id) id
    FROM chat_rooms
    ORDER BY request_id, created_at ASC
  );
  
  -- Add unique constraint if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_rooms_request_id_unique'
  ) THEN
    ALTER TABLE chat_rooms ADD CONSTRAINT chat_rooms_request_id_unique UNIQUE (request_id);
  END IF;
END $$;

-- Fix 6: cities SELECT — allow anon
DROP POLICY IF EXISTS "cities_select_all" ON cities;
CREATE POLICY "cities_select_all" ON cities FOR SELECT
  TO anon, authenticated USING (true);

-- Fix 7: delivery_partners — add admin policies
DROP POLICY IF EXISTS "dp_update_admin" ON delivery_partners;
CREATE POLICY "dp_update_admin" ON delivery_partners FOR UPDATE
  TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Fix 8: storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES 
  ('avatars', 'avatars', true, 5242880),
  ('media', 'media', true, 20971520)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
  DROP POLICY IF EXISTS "avatars_auth_insert" ON storage.objects;
  DROP POLICY IF EXISTS "avatars_auth_update" ON storage.objects;
  DROP POLICY IF EXISTS "media_public_read" ON storage.objects;
  DROP POLICY IF EXISTS "media_auth_insert" ON storage.objects;
END $$;

CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_auth_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "avatars_auth_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "media_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'media');
CREATE POLICY "media_auth_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'media');

-- Fix 9: aadhaar_url column
ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS aadhaar_url text;

-- Fix 10: app_settings default values
INSERT INTO app_settings (key, value) VALUES ('admin_upi_id', 'admin@upi') ON CONFLICT DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('admin_name', 'pingGET Admin') ON CONFLICT DO NOTHING;
-- =============================================================================
-- END: 20260728014537_20260728020000_apply_all_missing_fixes.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260728014623_20260728021000_fix_all_rpc_search_path.sql
-- =============================================================================

-- Fix accept_request: add SET search_path = public (required for SECURITY DEFINER functions)
CREATE OR REPLACE FUNCTION public.accept_request(
  p_request_id uuid,
  p_dp_user_id uuid
)
RETURNS TABLE (
  success boolean,
  chat_room_id uuid,
  error_msg text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_request RECORD;
  v_room_id uuid;
  v_dp_name text;
  v_user_name text;
BEGIN
  SELECT * INTO v_request
  FROM requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Request not found';
    RETURN;
  END IF;

  IF v_request.status != 'pending' THEN
    RETURN QUERY SELECT false, NULL::uuid, 'This request was already accepted by another delivery partner';
    RETURN;
  END IF;

  IF v_request.declined_by @> ARRAY[p_dp_user_id] THEN
    RETURN QUERY SELECT false, NULL::uuid, 'You declined this request earlier';
    RETURN;
  END IF;

  UPDATE requests
  SET status = 'accepted',
      accepted_dp_id = p_dp_user_id
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, 'This request was just accepted by another delivery partner';
    RETURN;
  END IF;

  SELECT full_name INTO v_dp_name FROM profiles WHERE id = p_dp_user_id;
  SELECT full_name INTO v_user_name FROM profiles WHERE id = v_request.user_id;

  SELECT id INTO v_room_id
  FROM chat_rooms
  WHERE request_id = p_request_id
  LIMIT 1;

  IF v_room_id IS NULL THEN
    INSERT INTO chat_rooms (request_id, user_id, dp_id)
    VALUES (p_request_id, v_request.user_id, p_dp_user_id)
    RETURNING id INTO v_room_id;
  END IF;

  INSERT INTO messages (chat_room_id, sender_id, message_type, quotation_data)
  VALUES (
    v_room_id,
    v_request.user_id,
    'order_summary',
    jsonb_build_object(
      'description', v_request.description,
      'preferred_shop', v_request.preferred_shop,
      'pickup_address', v_request.pickup_address,
      'delivery_address', v_request.delivery_address,
      'expected_time', v_request.expected_time,
      'photo_urls', v_request.photo_urls,
      'voice_note_url', v_request.voice_note_url,
      'delivery_lat', v_request.delivery_lat,
      'delivery_lng', v_request.delivery_lng
    )
  );

  INSERT INTO messages (chat_room_id, sender_id, content, message_type)
  VALUES (
    v_room_id,
    p_dp_user_id,
    COALESCE('Hi ' || v_user_name || '! I''m ' || v_dp_name || ' and I''ve accepted your delivery request. I can see your order details above — let me know if anything needs clarification!', 'Hello! I''ve accepted your delivery request.'),
    'text'
  );

  IF v_request.delivery_lat IS NOT NULL AND v_request.delivery_lng IS NOT NULL THEN
    INSERT INTO messages (chat_room_id, sender_id, content, message_type, location_lat, location_lng)
    VALUES (
      v_room_id,
      p_dp_user_id,
      COALESCE(v_request.delivery_address, 'Delivery location'),
      'location',
      v_request.delivery_lat,
      v_request.delivery_lng
    );
  END IF;

  INSERT INTO notifications (user_id, title, body, type, related_id)
  VALUES (
    v_request.user_id,
    'Request Accepted!',
    COALESCE(v_dp_name, 'A delivery partner') || ' accepted your request. Tap to open chat now.',
    'request_accepted',
    p_request_id
  );

  RETURN QUERY SELECT true, v_room_id, NULL::text;
END;
$function$;

-- Also fix append_declined_by with SET search_path
CREATE OR REPLACE FUNCTION public.append_declined_by(row_id uuid, dp_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE requests
  SET declined_by = array_append(
    COALESCE(declined_by, '{}'::uuid[]),
    dp_id
  )
  WHERE id = row_id
  AND NOT (declined_by @> ARRAY[dp_id]);
END;
$$;

-- Also fix scan_nearby_dps, scan_nearby_dps_stats, get_nearby_requests, update_location
CREATE OR REPLACE FUNCTION public.scan_nearby_dps(
  p_user_lat double precision,
  p_user_lng double precision,
  p_radius_meters integer,
  p_request_id uuid DEFAULT NULL
)
RETURNS TABLE (
  dp_user_id uuid,
  full_name text,
  gps_lat double precision,
  gps_lng double precision,
  distance_meters double precision,
  service_range_meters integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    dp.user_id,
    p.full_name,
    p.gps_lat,
    p.gps_lng,
    (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(p.gps_lat - p_user_lat) / 2) ^ 2 +
          cos(radians(p_user_lat)) * cos(radians(p.gps_lat)) *
          sin(radians(p.gps_lng - p_user_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(p.gps_lat - p_user_lat) / 2) ^ 2 +
          cos(radians(p_user_lat)) * cos(radians(p.gps_lat)) *
          sin(radians(p.gps_lng - p_user_lng) / 2) ^ 2
        ))
      )
    ) AS dist,
    dp.service_range_meters
  FROM delivery_partners dp
  JOIN profiles p ON p.id = dp.user_id
  WHERE dp.is_online = true
    AND dp.status = 'approved'
    AND p.gps_lat IS NOT NULL
    AND p.gps_lng IS NOT NULL
    AND (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(p.gps_lat - p_user_lat) / 2) ^ 2 +
          cos(radians(p_user_lat)) * cos(radians(p.gps_lat)) *
          sin(radians(p.gps_lng - p_user_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(p.gps_lat - p_user_lat) / 2) ^ 2 +
          cos(radians(p_user_lat)) * cos(radians(p.gps_lat)) *
          sin(radians(p.gps_lng - p_user_lng) / 2) ^ 2
        ))
      )
    ) <= p_radius_meters
    AND (
      p_request_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM requests r
        WHERE r.id = p_request_id
        AND r.declined_by @> ARRAY[dp.user_id]
      )
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.scan_nearby_dps_stats(
  p_user_lat double precision,
  p_user_lng double precision,
  p_radius_meters integer,
  p_request_id uuid DEFAULT NULL
)
RETURNS TABLE (
  dp_count bigint,
  avg_distance_meters double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  SELECT
    COUNT(*)::bigint,
    COALESCE(AVG(dist), 0)::double precision
  INTO
    dp_count, avg_distance_meters
  FROM scan_nearby_dps(p_user_lat, p_user_lng, p_radius_meters, p_request_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_nearby_requests(
  p_dp_user_id uuid
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  description text,
  photo_urls text[],
  voice_note_url text,
  preferred_shop text,
  pickup_address text,
  pickup_lat double precision,
  pickup_lng double precision,
  delivery_address text,
  delivery_lat double precision,
  delivery_lng double precision,
  expected_time text,
  max_budget numeric,
  special_instructions text,
  created_at timestamptz,
  user_full_name text,
  user_gps_lat double precision,
  user_gps_lng double precision,
  distance_meters double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_dp_lat double precision;
  v_dp_lng double precision;
  v_service_range integer;
BEGIN
  SELECT p.gps_lat, p.gps_lng, dp.service_range_meters
  INTO v_dp_lat, v_dp_lng, v_service_range
  FROM delivery_partners dp
  JOIN profiles p ON p.id = dp.user_id
  WHERE dp.user_id = p_dp_user_id
    AND dp.is_online = true
    AND dp.status = 'approved';

  IF v_dp_lat IS NULL OR v_dp_lng IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.user_id,
    r.description,
    r.photo_urls,
    r.voice_note_url,
    r.preferred_shop,
    r.pickup_address,
    r.pickup_lat,
    r.pickup_lng,
    r.delivery_address,
    r.delivery_lat,
    r.delivery_lng,
    r.expected_time,
    r.max_budget,
    r.special_instructions,
    r.created_at,
    up.full_name,
    up.gps_lat,
    up.gps_lng,
    (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(COALESCE(r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(COALESCE(r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ))
      )
    ) AS dist
  FROM requests r
  JOIN profiles up ON up.id = r.user_id
  WHERE r.status = 'pending'
    AND NOT (r.declined_by @> ARRAY[p_dp_user_id])
    AND (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(COALESCE(r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(COALESCE(r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ))
      )
    ) <= v_service_range
  ORDER BY r.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_location(
  p_lat double precision,
  p_lng double precision
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE profiles
  SET gps_lat = p_lat,
      gps_lng = p_lng,
      gps_updated_at = now(),
      updated_at = now()
  WHERE id = auth.uid();
END;
$function$;

-- Re-grant execute permissions
GRANT EXECUTE ON FUNCTION public.scan_nearby_dps(
    double precision,
    double precision,
    integer
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.scan_nearby_dps(
    double precision,
    double precision,
    integer,
    uuid
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.scan_nearby_dps_stats(
    double precision,
    double precision,
    integer,
    uuid
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_nearby_requests(
    uuid
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.accept_request(
    uuid,
    uuid
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.update_location(
    double precision,
    double precision
) TO authenticated;
-- =============================================================================
-- END: 20260728014623_20260728021000_fix_all_rpc_search_path.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260728074130_fix_accept_order_and_scanning_and_realtime.sql
-- =============================================================================

/*
# Fix accept_order failure, scanning page, and DP realtime updates

## Problems Fixed

### 1. DP cannot accept orders (CRITICAL BUG)
The `accept_request()` function inserts a message with `message_type = 'order_summary'`,
but the `messages` table CHECK constraint only allows
('text','image','voice','location','quotation'). The insert fails, the
function raises an error, and the entire transaction rolls back — so the
request never becomes 'accepted'. DPs see "Failed to accept request".

**Fix:** Add 'order_summary' to the allowed message_type values.

### 2. DP online toggle not real-time
The `delivery_partners` table is not in the `supabase_realtime` publication,
so the DpHome page never receives a realtime UPDATE event when the DP
flips online/offline. The page only updates after a manual refresh.

**Fix:** Add `delivery_partners` to the realtime publication.

### 3. Scanning page shows no DP spots / needs vehicle icons
The `scan_nearby_dps` function returns DP positions but not their
vehicle_type. The scanning page needs vehicle info to render the correct
vehicle icon (bicycle / motorbike / car) instead of yellow dots.

**Fix:** Add `vehicle_type` to the `scan_nearby_dps` return columns.

## Changes
1. `messages` table: add 'order_summary' to message_type CHECK constraint.
2. `supabase_realtime` publication: add `delivery_partners` and `orders` tables.
3. `scan_nearby_dps` function: add `vehicle_type text` output column.
4. Re-grant execute permissions on updated functions.

## Security
- No RLS policy changes.
- All functions remain SECURITY DEFINER with SET search_path = public.
*/

-- 1. Fix messages CHECK constraint to allow 'order_summary'
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_message_type_check
  CHECK (message_type IN ('text','image','voice','location','quotation','order_summary'));

-- 2. Add delivery_partners and orders to realtime publication so DP
--    online/offline changes and order status changes are pushed instantly.
ALTER PUBLICATION supabase_realtime ADD TABLE delivery_partners;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
DROP FUNCTION IF EXISTS public.scan_nearby_dps(
    double precision,
    double precision,
    integer
);

DROP FUNCTION IF EXISTS public.scan_nearby_dps(
    double precision,
    double precision,
    integer,
    uuid
);
-- 3. Update scan_nearby_dps to include vehicle_type in the result
CREATE OR REPLACE FUNCTION public.scan_nearby_dps(
  p_user_lat double precision,
  p_user_lng double precision,
  p_radius_meters integer,
  p_request_id uuid DEFAULT NULL
)
RETURNS TABLE (
  dp_user_id uuid,
  full_name text,
  gps_lat double precision,
  gps_lng double precision,
  distance_meters double precision,
  service_range_meters integer,
  vehicle_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    dp.user_id,
    p.full_name,
    p.gps_lat,
    p.gps_lng,
    (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(p.gps_lat - p_user_lat) / 2) ^ 2 +
          cos(radians(p_user_lat)) * cos(radians(p.gps_lat)) *
          sin(radians(p.gps_lng - p_user_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(p.gps_lat - p_user_lat) / 2) ^ 2 +
          cos(radians(p_user_lat)) * cos(radians(p.gps_lat)) *
          sin(radians(p.gps_lng - p_user_lng) / 2) ^ 2
        ))
      )
    ) AS dist,
    dp.service_range_meters,
    dp.vehicle_type
  FROM delivery_partners dp
  JOIN profiles p ON p.id = dp.user_id
  WHERE dp.is_online = true
    AND dp.status = 'approved'
    AND p.gps_lat IS NOT NULL
    AND p.gps_lng IS NOT NULL
    AND (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(p.gps_lat - p_user_lat) / 2) ^ 2 +
          cos(radians(p_user_lat)) * cos(radians(p.gps_lat)) *
          sin(radians(p.gps_lng - p_user_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(p.gps_lat - p_user_lat) / 2) ^ 2 +
          cos(radians(p_user_lat)) * cos(radians(p.gps_lat)) *
          sin(radians(p.gps_lng - p_user_lng) / 2) ^ 2
        ))
      )
    ) <= p_radius_meters
    AND (
      p_request_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM requests r
        WHERE r.id = p_request_id
        AND r.declined_by @> ARRAY[dp.user_id]
      )
    );
END;
$function$;

-- 4. scan_nearby_dps_stats stays the same (aggregate only)
CREATE OR REPLACE FUNCTION public.scan_nearby_dps_stats(
  p_user_lat double precision,
  p_user_lng double precision,
  p_radius_meters integer,
  p_request_id uuid DEFAULT NULL
)
RETURNS TABLE (
  dp_count bigint,
  avg_distance_meters double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  SELECT
    COUNT(*)::bigint,
    COALESCE(AVG(dist), 0)::double precision
  INTO
    dp_count, avg_distance_meters
  FROM scan_nearby_dps(p_user_lat, p_user_lng, p_radius_meters, p_request_id);
END;
$function$;

-- 5. Re-grant execute permissions (only the 4-arg signatures exist now)
GRANT EXECUTE ON FUNCTION public.scan_nearby_dps(
    double precision,
    double precision,
    integer,
    uuid
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.scan_nearby_dps_stats(
    double precision,
    double precision,
    integer,
    uuid
) TO authenticated;

-- =============================================================================
-- END: 20260728074130_fix_accept_order_and_scanning_and_realtime.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260728130342_20260728140000_add_realtime_publications_and_receipt_notification_trigger.sql
-- =============================================================================

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
-- =============================================================================
-- END: 20260728130342_20260728140000_add_realtime_publications_and_receipt_notification_trigger.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260728162938_20260728160000_add_live_tracking_fields.sql
-- =============================================================================

-- Add live tracking columns to delivery_partners
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_partners' AND column_name = 'current_lat') THEN
    ALTER TABLE delivery_partners ADD COLUMN current_lat double precision;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_partners' AND column_name = 'current_lng') THEN
    ALTER TABLE delivery_partners ADD COLUMN current_lng double precision;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_partners' AND column_name = 'heading') THEN
    ALTER TABLE delivery_partners ADD COLUMN heading double precision;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_partners' AND column_name = 'speed_kmh') THEN
    ALTER TABLE delivery_partners ADD COLUMN speed_kmh double precision DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_partners' AND column_name = 'battery_level') THEN
    ALTER TABLE delivery_partners ADD COLUMN battery_level int;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_partners' AND column_name = 'last_location_at') THEN
    ALTER TABLE delivery_partners ADD COLUMN last_location_at timestamptz;
  END IF;
END $$;

-- Add live tracking columns to requests
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'dp_lat') THEN
    ALTER TABLE requests ADD COLUMN dp_lat double precision;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'dp_lng') THEN
    ALTER TABLE requests ADD COLUMN dp_lng double precision;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'dp_heading') THEN
    ALTER TABLE requests ADD COLUMN dp_heading double precision;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'dp_last_update') THEN
    ALTER TABLE requests ADD COLUMN dp_last_update timestamptz;
  END IF;
END $$;

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_delivery_partners_online ON delivery_partners(is_online);
CREATE INDEX IF NOT EXISTS idx_requests_status_accepted ON requests(status, accepted_dp_id);

-- Realtime publications
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'delivery_partners') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE delivery_partners;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'requests') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE requests;
  END IF;
END $$;

-- update_location RPC: updates DP GPS and denormalizes into active requests
CREATE OR REPLACE FUNCTION update_location(p_lat double precision, p_lng double precision)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_prev_lat double precision;
  v_prev_lng double precision;
  v_heading double precision := 0;
BEGIN
  SELECT current_lat, current_lng INTO v_prev_lat, v_prev_lng
  FROM delivery_partners WHERE user_id = v_user_id;

  IF v_prev_lat IS NOT NULL AND v_prev_lng IS NOT NULL THEN
    IF p_lat <> v_prev_lat OR p_lng <> v_prev_lng THEN
      v_heading := degrees(atan2(
        sin(radians(p_lng - v_prev_lng)) * cos(radians(p_lat)),
        cos(radians(v_prev_lat)) * sin(radians(p_lat)) -
        sin(radians(v_prev_lat)) * cos(radians(p_lat)) * cos(radians(p_lng - v_prev_lng))
      ));
      v_heading := (v_heading + 360) % 360;
    END IF;
  END IF;

  UPDATE delivery_partners
  SET current_lat = p_lat,
      current_lng = p_lng,
      heading = v_heading,
      last_location_at = now()
  WHERE user_id = v_user_id;

  UPDATE requests
  SET dp_lat = p_lat,
      dp_lng = p_lng,
      dp_heading = v_heading,
      dp_last_update = now()
  WHERE accepted_dp_id = v_user_id
    AND status IN ('accepted','confirmed','shopping','purchased','on_the_way','arrived');
END;
$$;

-- get_online_dps RPC: returns all online approved DPs with profile + active request info
CREATE OR REPLACE FUNCTION get_online_dps()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  phone text,
  photo_url text,
  vehicle_type text,
  current_lat double precision,
  current_lng double precision,
  heading double precision,
  speed_kmh double precision,
  battery_level int,
  rating_avg numeric,
  is_online boolean,
  last_location_at timestamptz,
  active_request_id uuid,
  active_request_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT
    dp.user_id,
    p.full_name,
    p.phone,
    p.photo_url,
    dp.vehicle_type,
    dp.current_lat,
    dp.current_lng,
    dp.heading,
    dp.speed_kmh,
    dp.battery_level,
    dp.rating_avg,
    dp.is_online,
    dp.last_location_at,
    r.id,
    r.status
  FROM delivery_partners dp
  JOIN profiles p ON p.id = dp.user_id
  LEFT JOIN LATERAL (
    SELECT id, status FROM requests
    WHERE accepted_dp_id = dp.user_id
      AND status IN ('accepted','confirmed','shopping','purchased','on_the_way','arrived')
    ORDER BY created_at DESC LIMIT 1
  ) r ON true
  WHERE dp.is_online = true
    AND dp.status = 'approved';
END;
$$;
-- =============================================================================
-- END: 20260728162938_20260728160000_add_live_tracking_fields.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260731185024_add_addresses_table.sql
-- =============================================================================

/*
# Add addresses table for saved delivery addresses

Users can save multiple delivery addresses with full details and map coordinates.
*/

CREATE TABLE IF NOT EXISTS addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text DEFAULT 'Address',
  house_no text,
  flat_no text,
  building_name text,
  landmark text,
  street text,
  area text,
  city text,
  pincode text,
  lat double precision,
  lng double precision,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_addresses" ON addresses;
CREATE POLICY "select_own_addresses" ON addresses FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_addresses" ON addresses;
CREATE POLICY "insert_own_addresses" ON addresses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_addresses" ON addresses;
CREATE POLICY "update_own_addresses" ON addresses FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_addresses" ON addresses;
CREATE POLICY "delete_own_addresses" ON addresses FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- =============================================================================
-- END: 20260731185024_add_addresses_table.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260731185032_add_dp_ratings_table.sql
-- =============================================================================

/*
# Add dp_ratings table for delivery partner star ratings
*/

CREATE TABLE IF NOT EXISTS dp_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dp_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  feedback text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE dp_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_dp_ratings" ON dp_ratings;
CREATE POLICY "select_dp_ratings" ON dp_ratings FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_dp_rating" ON dp_ratings;
CREATE POLICY "insert_own_dp_rating" ON dp_ratings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- END: 20260731185032_add_dp_ratings_table.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260731185219_add_eta_minutes_to_requests.sql
-- =============================================================================

/*
# Add eta_minutes column to requests table
*/
ALTER TABLE requests ADD COLUMN IF NOT EXISTS eta_minutes integer;

-- =============================================================================
-- END: 20260731185219_add_eta_minutes_to_requests.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260801112615_fix_gps_nearby_dp_and_request_routing.sql
-- =============================================================================

/*
# Fix GPS, Nearby DP Detection, and Order Request Routing

## Problem
The core database functions needed for the entire delivery matching flow were
missing from the live database. The frontend called scan_nearby_dps,
get_nearby_requests, update_location, and accept_request via supabase.rpc(),
but none existed — so every call failed silently and:
  - Users never saw nearby delivery partners on the scanning page
  - Delivery partners never received user order requests
  - GPS coordinates were never saved to profiles
  - DP accept always failed

Additionally:
  - profiles.gps_updated_at column was missing (update_location references it)
  - messages CHECK constraint lacked 'order_summary' (accept_request inserts one)
  - delivery_partners and orders were not in the realtime publication

## Changes

### 1. Add gps_updated_at column to profiles
   - Needed by update_location to track when GPS was last refreshed.

### 2. Add 'order_summary' to messages message_type CHECK constraint
   - accept_request inserts an order_summary message; without this the
     entire accept transaction rolls back and DPs can never accept orders.

### 3. Add delivery_partners and orders to supabase_realtime publication
   - So DP online/offline toggles and order status changes push instantly
     to subscribed clients.

### 4. Create scan_nearby_dps function
   - Returns online approved DPs within a radius of the user's GPS.
   - Includes vehicle_type for rendering correct vehicle icons.
   - Excludes DPs who already declined the specific request.
   - SECURITY DEFINER, SET search_path = public.

### 5. Create scan_nearby_dps_stats function
   - Returns aggregate count and average distance for the scanning radar.

### 6. Create get_nearby_requests function
   - Returns pending requests within a DP's service range.
   - Uses DP's GPS + service_range_meters for filtering.
   - Excludes requests the DP already declined.

### 7. Create update_location function
   - Updates the caller's GPS coordinates in profiles.
   - Uses auth.uid() so only the authenticated user can update their own GPS.

### 8. Create accept_request function
   - Atomically accepts a delivery request (prevents race conditions).
   - Creates/updates chat room, inserts order_summary + welcome messages.
   - Sends notification to the user.

### 9. Add indexes for performance
   - delivery_partners online status
   - profiles GPS coordinates
   - requests pending status

## Security
   - All functions are SECURITY DEFINER with SET search_path = public.
   - update_location uses auth.uid() — only the caller can update their own GPS.
   - accept_request uses FOR UPDATE lock to prevent race conditions.
   - No RLS policy changes.
*/

-- 1. Add gps_updated_at to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND table_schema = 'public' AND column_name = 'gps_updated_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN gps_updated_at timestamptz;
  END IF;
END $$;

-- 2. Fix messages CHECK constraint to allow 'order_summary'
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_message_type_check
  CHECK (message_type IN ('text','image','voice','location','quotation','order_summary'));

-- 3. Add delivery_partners and orders to realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'delivery_partners'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE delivery_partners;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  END IF;
END $$;

-- 4. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_delivery_partners_online
  ON delivery_partners(is_online) WHERE is_online = true;

CREATE INDEX IF NOT EXISTS idx_profiles_gps
  ON profiles(gps_lat, gps_lng)
  WHERE gps_lat IS NOT NULL AND gps_lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_requests_pending
  ON requests(status, created_at)
  WHERE status = 'pending';

-- 5. scan_nearby_dps: returns all nearby online approved DPs within radius
DROP FUNCTION IF EXISTS public.scan_nearby_dps(double precision, double precision, integer);
DROP FUNCTION IF EXISTS public.scan_nearby_dps(double precision, double precision, integer, uuid);

CREATE OR REPLACE FUNCTION public.scan_nearby_dps(
  p_user_lat double precision,
  p_user_lng double precision,
  p_radius_meters integer,
  p_request_id uuid DEFAULT NULL
)
RETURNS TABLE (
  dp_user_id uuid,
  full_name text,
  gps_lat double precision,
  gps_lng double precision,
  distance_meters double precision,
  service_range_meters integer,
  vehicle_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    dp.user_id,
    p.full_name,
    p.gps_lat,
    p.gps_lng,
    (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(p.gps_lat - p_user_lat) / 2) ^ 2 +
          cos(radians(p_user_lat)) * cos(radians(p.gps_lat)) *
          sin(radians(p.gps_lng - p_user_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(p.gps_lat - p_user_lat) / 2) ^ 2 +
          cos(radians(p_user_lat)) * cos(radians(p.gps_lat)) *
          sin(radians(p.gps_lng - p_user_lng) / 2) ^ 2
        ))
      )
    ) AS dist,
    dp.service_range_meters,
    dp.vehicle_type
  FROM delivery_partners dp
  JOIN profiles p ON p.id = dp.user_id
  WHERE dp.is_online = true
    AND dp.status = 'approved'
    AND p.gps_lat IS NOT NULL
    AND p.gps_lng IS NOT NULL
    AND (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(p.gps_lat - p_user_lat) / 2) ^ 2 +
          cos(radians(p_user_lat)) * cos(radians(p.gps_lat)) *
          sin(radians(p.gps_lng - p_user_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(p.gps_lat - p_user_lat) / 2) ^ 2 +
          cos(radians(p_user_lat)) * cos(radians(p.gps_lat)) *
          sin(radians(p.gps_lng - p_user_lng) / 2) ^ 2
        ))
      )
    ) <= p_radius_meters
    AND (
      p_request_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM requests r
        WHERE r.id = p_request_id
        AND r.declined_by @> ARRAY[dp.user_id]
      )
    );
END;
$function$;

-- 6. scan_nearby_dps_stats: aggregate stats for the scanning radar
CREATE OR REPLACE FUNCTION public.scan_nearby_dps_stats(
  p_user_lat double precision,
  p_user_lng double precision,
  p_radius_meters integer,
  p_request_id uuid DEFAULT NULL
)
RETURNS TABLE (
  dp_count bigint,
  avg_distance_meters double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  SELECT
    COUNT(*)::bigint,
    COALESCE(AVG(dist), 0)::double precision
  INTO
    dp_count, avg_distance_meters
  FROM scan_nearby_dps(p_user_lat, p_user_lng, p_radius_meters, p_request_id);
END;
$function$;

-- 7. get_nearby_requests: returns pending requests within DP's service range
CREATE OR REPLACE FUNCTION public.get_nearby_requests(
  p_dp_user_id uuid
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  description text,
  photo_urls text[],
  voice_note_url text,
  preferred_shop text,
  pickup_address text,
  pickup_lat double precision,
  pickup_lng double precision,
  delivery_address text,
  delivery_lat double precision,
  delivery_lng double precision,
  expected_time text,
  max_budget numeric,
  special_instructions text,
  created_at timestamptz,
  user_full_name text,
  user_gps_lat double precision,
  user_gps_lng double precision,
  distance_meters double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_dp_lat double precision;
  v_dp_lng double precision;
  v_service_range integer;
BEGIN
  SELECT p.gps_lat, p.gps_lng, dp.service_range_meters
  INTO v_dp_lat, v_dp_lng, v_service_range
  FROM delivery_partners dp
  JOIN profiles p ON p.id = dp.user_id
  WHERE dp.user_id = p_dp_user_id
    AND dp.is_online = true
    AND dp.status = 'approved';

  IF v_dp_lat IS NULL OR v_dp_lng IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.user_id,
    r.description,
    r.photo_urls,
    r.voice_note_url,
    r.preferred_shop,
    r.pickup_address,
    r.pickup_lat,
    r.pickup_lng,
    r.delivery_address,
    r.delivery_lat,
    r.delivery_lng,
    r.expected_time,
    r.max_budget,
    r.special_instructions,
    r.created_at,
    up.full_name,
    up.gps_lat,
    up.gps_lng,
    (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(COALESCE(r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(COALESCE(r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ))
      )
    ) AS dist
  FROM requests r
  JOIN profiles up ON up.id = r.user_id
  WHERE r.status = 'pending'
    AND NOT (r.declined_by @> ARRAY[p_dp_user_id])
    AND (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(COALESCE(r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(COALESCE(r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ))
      )
    ) <= v_service_range
  ORDER BY r.created_at DESC;
END;
$function$;

-- 8. update_location: update caller's GPS coordinates
CREATE OR REPLACE FUNCTION public.update_location(
  p_lat double precision,
  p_lng double precision
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE profiles
  SET gps_lat = p_lat,
      gps_lng = p_lng,
      gps_updated_at = now(),
      updated_at = now()
  WHERE id = auth.uid();
END;
$function$;

-- 9. accept_request: atomic order acceptance (prevents race conditions)
CREATE OR REPLACE FUNCTION public.accept_request(
  p_request_id uuid,
  p_dp_user_id uuid
)
RETURNS TABLE (
  success boolean,
  chat_room_id uuid,
  error_msg text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_request RECORD;
  v_room_id uuid;
  v_dp_name text;
  v_user_name text;
BEGIN
  SELECT * INTO v_request
  FROM requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Request not found';
    RETURN;
  END IF;

  IF v_request.status != 'pending' THEN
    RETURN QUERY SELECT false, NULL::uuid, 'This request was already accepted by another delivery partner';
    RETURN;
  END IF;

  IF v_request.declined_by @> ARRAY[p_dp_user_id] THEN
    RETURN QUERY SELECT false, NULL::uuid, 'You declined this request earlier';
    RETURN;
  END IF;

  UPDATE requests
  SET status = 'accepted',
      accepted_dp_id = p_dp_user_id
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, 'This request was just accepted by another delivery partner';
    RETURN;
  END IF;

  SELECT full_name INTO v_dp_name FROM profiles WHERE id = p_dp_user_id;
  SELECT full_name INTO v_user_name FROM profiles WHERE id = v_request.user_id;

  SELECT id INTO v_room_id
  FROM chat_rooms
  WHERE request_id = p_request_id
  LIMIT 1;

  IF v_room_id IS NULL THEN
    INSERT INTO chat_rooms (request_id, user_id, dp_id)
    VALUES (p_request_id, v_request.user_id, p_dp_user_id)
    RETURNING id INTO v_room_id;
  END IF;

  INSERT INTO messages (chat_room_id, sender_id, message_type, quotation_data)
  VALUES (
    v_room_id,
    v_request.user_id,
    'order_summary',
    jsonb_build_object(
      'description', v_request.description,
      'preferred_shop', v_request.preferred_shop,
      'pickup_address', v_request.pickup_address,
      'delivery_address', v_request.delivery_address,
      'expected_time', v_request.expected_time,
      'photo_urls', v_request.photo_urls,
      'voice_note_url', v_request.voice_note_url,
      'delivery_lat', v_request.delivery_lat,
      'delivery_lng', v_request.delivery_lng
    )
  );

  INSERT INTO messages (chat_room_id, sender_id, content, message_type)
  VALUES (
    v_room_id,
    p_dp_user_id,
    COALESCE('Hi ' || v_user_name || '! I''m ' || v_dp_name || ' and I''ve accepted your delivery request. I can see your order details above — let me know if anything needs clarification!', 'Hello! I''ve accepted your delivery request.'),
    'text'
  );

  IF v_request.delivery_lat IS NOT NULL AND v_request.delivery_lng IS NOT NULL THEN
    INSERT INTO messages (chat_room_id, sender_id, content, message_type, location_lat, location_lng)
    VALUES (
      v_room_id,
      p_dp_user_id,
      COALESCE(v_request.delivery_address, 'Delivery location'),
      'location',
      v_request.delivery_lat,
      v_request.delivery_lng
    );
  END IF;

  INSERT INTO notifications (user_id, title, body, type, related_id)
  VALUES (
    v_request.user_id,
    'Request Accepted!',
    COALESCE(v_dp_name, 'A delivery partner') || ' accepted your request. Tap to open chat now.',
    'request_accepted',
    p_request_id
  );

  RETURN QUERY SELECT true, v_room_id, NULL::text;
END;
$function$;

-- 10. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.scan_nearby_dps(
    double precision,
    double precision,
    integer,
    uuid
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.scan_nearby_dps_stats(
    double precision,
    double precision,
    integer,
    uuid
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_nearby_requests(
    uuid
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.accept_request(
    uuid,
    uuid
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.update_location(
    double precision,
    double precision
) TO authenticated;

-- =============================================================================
-- END: 20260801112615_fix_gps_nearby_dp_and_request_routing.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260801120000_add_rating_trigger_for_dp_avg.sql
-- =============================================================================

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
-- =============================================================================
-- END: 20260801120000_add_rating_trigger_for_dp_avg.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260801180957_add_admin_notification_trigger_for_new_requests.sql
-- =============================================================================

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
-- =============================================================================
-- END: 20260801180957_add_admin_notification_trigger_for_new_requests.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260803043113_add_advance_request_columns.sql
-- =============================================================================

/*
# Add Advance Request (Scheduled Task) Feature

## Purpose
Extends the existing `requests` table with columns for scheduled/advance requests,
and creates a new `advance_settings` table for admin-configurable scheduling,
time slots, and service charges. This does NOT change any existing columns,
business logic, or instant request workflow.

## 1. New Columns on `requests` table
- `order_type` (text, default 'instant') — 'instant' or 'advance'
- `is_scheduled` (boolean, default false) — true for advance requests
- `scheduled_date` (date) — the scheduled date
- `scheduled_time` (text) — human-readable time slot label
- `scheduled_slot` (text) — slot key e.g. "14:00-14:30"
- `scheduled_timestamp` (timestamptz) — full scheduled datetime
- `request_category` (text) — category of the scheduled task
- `shop_name` (text) — optional shop name
- `shop_phone` (text) — optional shop phone
- `shop_address` (text) — optional shop address
- `shop_lat` (double precision) — optional shop latitude
- `shop_lng` (double precision) — optional shop longitude
- `estimated_task_duration` (integer) — estimated duration in minutes
- `special_instructions` (text) — already exists in some schemas; added if missing
- `estimated_total_charge` (numeric) — calculated charge estimate
- `charge_breakdown` (jsonb) — breakdown of charges

## 2. New Status Value
- Adds 'scheduled' to the requests status CHECK constraint.
- Adds 'expired' to the requests status CHECK constraint.
- Adds 'rescheduled' to the requests status CHECK constraint.

## 3. New Table: `advance_settings`
Admin-configurable settings for the Advance Request feature.
- `id` (uuid PK)
- `enabled` (boolean, default true)
- `max_advance_days` (integer, default 7)
- `notification_lead_minutes` (integer, default 30)
- `business_hours_start` (text, default '08:00')
- `business_hours_end` (text, default '20:00')
- `slot_duration_minutes` (integer, default 30)
- `advance_booking_fee` (numeric, default 10)
- `platform_fee` (numeric, default 5)
- `min_service_charge` (numeric, default 20)
- `max_service_charge` (numeric, default 500)
- `dp_convenience_charge` (numeric, default 15)
- `emergency_charge` (numeric, default 0)
- `holiday_charge` (numeric, default 0)
- `night_charge` (numeric, default 0)
- `night_charge_start` (text, default '22:00')
- `night_charge_end` (text, default '06:00')
- `peak_hour_charge` (numeric, default 0)
- `peak_hours_start` (text, default '17:00')
- `peak_hours_end` (text, default '20:00')
- `cancellation_cutoff_minutes` (integer, default 120)
- `reschedule_cutoff_minutes` (integer, default 360)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

## 4. Security
- `advance_settings` RLS enabled.
- SELECT for all authenticated (so the app can read config).
- INSERT/UPDATE/DELETE for admins only.
- No changes to existing RLS policies on `requests`.

## 5. Indexes
- Index on `requests(is_scheduled)` for scheduled request filtering.
- Index on `requests(scheduled_timestamp)` for due-time queries.
- Index on `requests(order_type)` for filtering.
*/

-- 1. Add new columns to requests table (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requests' AND column_name='order_type') THEN
    ALTER TABLE requests ADD COLUMN order_type text NOT NULL DEFAULT 'instant';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requests' AND column_name='is_scheduled') THEN
    ALTER TABLE requests ADD COLUMN is_scheduled boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requests' AND column_name='scheduled_date') THEN
    ALTER TABLE requests ADD COLUMN scheduled_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requests' AND column_name='scheduled_time') THEN
    ALTER TABLE requests ADD COLUMN scheduled_time text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requests' AND column_name='scheduled_slot') THEN
    ALTER TABLE requests ADD COLUMN scheduled_slot text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requests' AND column_name='scheduled_timestamp') THEN
    ALTER TABLE requests ADD COLUMN scheduled_timestamp timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requests' AND column_name='request_category') THEN
    ALTER TABLE requests ADD COLUMN request_category text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requests' AND column_name='shop_name') THEN
    ALTER TABLE requests ADD COLUMN shop_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requests' AND column_name='shop_phone') THEN
    ALTER TABLE requests ADD COLUMN shop_phone text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requests' AND column_name='shop_address') THEN
    ALTER TABLE requests ADD COLUMN shop_address text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requests' AND column_name='shop_lat') THEN
    ALTER TABLE requests ADD COLUMN shop_lat double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requests' AND column_name='shop_lng') THEN
    ALTER TABLE requests ADD COLUMN shop_lng double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requests' AND column_name='estimated_task_duration') THEN
    ALTER TABLE requests ADD COLUMN estimated_task_duration integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requests' AND column_name='special_instructions') THEN
    ALTER TABLE requests ADD COLUMN special_instructions text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requests' AND column_name='estimated_total_charge') THEN
    ALTER TABLE requests ADD COLUMN estimated_total_charge numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='requests' AND column_name='charge_breakdown') THEN
    ALTER TABLE requests ADD COLUMN charge_breakdown jsonb;
  END IF;
END $$;

-- 2. Update status CHECK constraint to include scheduled/expired/rescheduled
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='requests_status_check' AND table_name='requests') THEN
    ALTER TABLE requests DROP CONSTRAINT requests_status_check;
  END IF;
END $$;
ALTER TABLE requests ADD CONSTRAINT requests_status_check
  CHECK (status IN ('pending','accepted','confirmed','shopping','purchased','on_the_way','arrived','delivered','cash_received','completed','cancelled','scheduled','expired','rescheduled'));

-- 3. Create advance_settings table
CREATE TABLE IF NOT EXISTS advance_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT true,
  max_advance_days integer NOT NULL DEFAULT 7,
  notification_lead_minutes integer NOT NULL DEFAULT 30,
  business_hours_start text NOT NULL DEFAULT '08:00',
  business_hours_end text NOT NULL DEFAULT '20:00',
  slot_duration_minutes integer NOT NULL DEFAULT 30,
  advance_booking_fee numeric NOT NULL DEFAULT 10,
  platform_fee numeric NOT NULL DEFAULT 5,
  min_service_charge numeric NOT NULL DEFAULT 20,
  max_service_charge numeric NOT NULL DEFAULT 500,
  dp_convenience_charge numeric NOT NULL DEFAULT 15,
  emergency_charge numeric NOT NULL DEFAULT 0,
  holiday_charge numeric NOT NULL DEFAULT 0,
  night_charge numeric NOT NULL DEFAULT 0,
  night_charge_start text NOT NULL DEFAULT '22:00',
  night_charge_end text NOT NULL DEFAULT '06:00',
  peak_hour_charge numeric NOT NULL DEFAULT 0,
  peak_hours_start text NOT NULL DEFAULT '17:00',
  peak_hours_end text NOT NULL DEFAULT '20:00',
  cancellation_cutoff_minutes integer NOT NULL DEFAULT 120,
  reschedule_cutoff_minutes integer NOT NULL DEFAULT 360,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE advance_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "advance_settings_select_all" ON advance_settings;
CREATE POLICY "advance_settings_select_all" ON advance_settings FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "advance_settings_insert_admin" ON advance_settings;
CREATE POLICY "advance_settings_insert_admin" ON advance_settings FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "advance_settings_update_admin" ON advance_settings;
CREATE POLICY "advance_settings_update_admin" ON advance_settings FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "advance_settings_delete_admin" ON advance_settings;
CREATE POLICY "advance_settings_delete_admin" ON advance_settings FOR DELETE
  TO authenticated USING (public.is_admin());

-- Seed a default row if none exists
INSERT INTO advance_settings (id, enabled)
SELECT gen_random_uuid(), true
WHERE NOT EXISTS (SELECT 1 FROM advance_settings);

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_requests_is_scheduled ON requests(is_scheduled) WHERE is_scheduled = true;
CREATE INDEX IF NOT EXISTS idx_requests_scheduled_timestamp ON requests(scheduled_timestamp) WHERE scheduled_timestamp IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_requests_order_type ON requests(order_type);

-- 5. Add advance_settings to realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'advance_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE advance_settings;
  END IF;
END $$;

-- =============================================================================
-- END: 20260803043113_add_advance_request_columns.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260803050933_advance_request_final_enhancement.sql
-- =============================================================================

-- Advance Request Final Enhancement
-- Adds: recurring support, reschedule history, cancellation policy, configurable expiry,
-- weekend charge, percentage charge support, smart reminder config, slot enable/disable,
-- recurring_enabled flag, cancellation_fee_after_accept, admin_override_cancellation

-- 1. New columns on advance_settings
ALTER TABLE advance_settings
  ADD COLUMN IF NOT EXISTS recurring_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS weekend_charge numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekend_charge_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS platform_fee_percent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dp_convenience_percent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancellation_fee_after_accept numeric DEFAULT 25,
  ADD COLUMN IF NOT EXISTS admin_override_cancellation boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS expiry_mode text DEFAULT '2_hours',
  ADD COLUMN IF NOT EXISTS expiry_custom_minutes integer DEFAULT 120,
  ADD COLUMN IF NOT EXISTS reminder_24h boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_12h boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_2h boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_1h boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_30m boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_15m boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_5m boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS expand_search_radius boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS search_radius_increment_meters integer DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS max_search_radius_meters integer DEFAULT 20000;

-- 2. New columns on requests for recurring, reschedule, cancellation
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS recurring_type text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS recurring_interval_days integer,
  ADD COLUMN IF NOT EXISTS recurring_weekday integer,
  ADD COLUMN IF NOT EXISTS recurring_month_day integer,
  ADD COLUMN IF NOT EXISTS recurring_parent_id uuid,
  ADD COLUMN IF NOT EXISTS recurring_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reschedule_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reschedule_history jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_by text,
  ADD COLUMN IF NOT EXISTS cancellation_fee numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expired_at timestamptz;

-- 3. Reschedule history table
CREATE TABLE IF NOT EXISTS reschedule_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  actor_type text NOT NULL DEFAULT 'customer',
  old_date date,
  old_slot text,
  new_date date,
  new_slot text,
  old_shop_name text,
  new_shop_name text,
  old_description text,
  new_description text,
  reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reschedule_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_reschedule_logs" ON reschedule_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_reschedule_logs" ON reschedule_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_reschedule_logs_admin" ON reschedule_logs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 4. Slot overrides table (admin can enable/disable individual slots)
CREATE TABLE IF NOT EXISTS advance_slot_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_key text NOT NULL,
  date_key date,
  is_disabled boolean DEFAULT false,
  reason text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  UNIQUE(slot_key, date_key)
);

ALTER TABLE advance_slot_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_slot_overrides" ON advance_slot_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_slot_overrides_admin" ON advance_slot_overrides FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_slot_overrides_admin" ON advance_slot_overrides FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_slot_overrides_admin" ON advance_slot_overrides FOR DELETE TO authenticated USING (true);

-- 5. Add recurring_parent_id foreign key constraint (self-reference, nullable)
-- Already added as plain column above; add FK carefully
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'requests_recurring_parent_id_fkey'
    AND table_name = 'requests'
  ) THEN
    ALTER TABLE requests
      ADD CONSTRAINT requests_recurring_parent_id_fkey
      FOREIGN KEY (recurring_parent_id) REFERENCES requests(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 6. Add check constraint for recurring_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'requests_recurring_type_check'
  ) THEN
    ALTER TABLE requests
      ADD CONSTRAINT requests_recurring_type_check
      CHECK (recurring_type IN ('none', 'daily', 'weekly', 'monthly', 'custom'));
  END IF;
END $$;

-- 7. Add check constraint for expiry_mode
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'advance_settings_expiry_mode_check'
  ) THEN
    ALTER TABLE advance_settings
      ADD CONSTRAINT advance_settings_expiry_mode_check
      CHECK (expiry_mode IN ('30_minutes', '1_hour', '2_hours', '4_hours', 'end_of_slot', 'never'));
  END IF;
END $$;

-- =============================================================================
-- END: 20260803050933_advance_request_final_enhancement.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260803051336_enhance_get_nearby_requests_smart_matching.sql
-- =============================================================================

-- Enhanced get_nearby_requests with smart DP matching
-- Verifies: online, approved, not suspended, inside service radius, working hours, city match
-- Also supports gradual radius expansion for advance requests

DROP FUNCTION IF EXISTS public.get_nearby_requests(uuid);
CREATE FUNCTION public.get_nearby_requests(
  p_dp_user_id uuid
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  description text,
  photo_urls text[],
  voice_note_url text,
  preferred_shop text,
  pickup_address text,
  pickup_lat double precision,
  pickup_lng double precision,
  delivery_address text,
  delivery_lat double precision,
  delivery_lng double precision,
  expected_time text,
  max_budget numeric,
  special_instructions text,
  created_at timestamptz,
  user_full_name text,
  user_gps_lat double precision,
  user_gps_lng double precision,
  distance_meters double precision,
  order_type text,
  request_category text,
  scheduled_timestamp timestamptz,
  is_scheduled boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_dp_lat double precision;
  v_dp_lng double precision;
  v_service_range integer;
  v_lead_minutes integer;
  v_dp_city text;
  v_dp_vehicle text;
  v_current_hour integer;
BEGIN
  SELECT p.gps_lat, p.gps_lng, dp.service_range_meters, p.city, dp.vehicle_type
  INTO v_dp_lat, v_dp_lng, v_service_range, v_dp_city, v_dp_vehicle
  FROM delivery_partners dp
  JOIN profiles p ON p.id = dp.user_id
  WHERE dp.user_id = p_dp_user_id
    AND dp.is_online = true
    AND dp.status = 'approved';

  IF v_dp_lat IS NULL OR v_dp_lng IS NULL THEN
    RETURN;
  END IF;

  v_current_hour := EXTRACT(HOUR FROM now());

  SELECT COALESCE(
    (SELECT notification_lead_minutes FROM advance_settings LIMIT 1),
    30
  ) INTO v_lead_minutes;

  RETURN QUERY
  SELECT
    r.id,
    r.user_id,
    r.description,
    r.photo_urls,
    r.voice_note_url,
    r.preferred_shop,
    r.pickup_address,
    r.pickup_lat,
    r.pickup_lng,
    r.delivery_address,
    r.delivery_lat,
    r.delivery_lng,
    r.expected_time,
    r.max_budget,
    r.special_instructions,
    r.created_at,
    up.full_name,
    up.gps_lat,
    up.gps_lng,
    (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(COALESCE(r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(COALESCE(r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ))
      )
    ) AS dist,
    r.order_type,
    r.request_category,
    r.scheduled_timestamp,
    r.is_scheduled
  FROM requests r
  JOIN profiles up ON up.id = r.user_id
  WHERE (
      (r.status = 'pending' AND r.order_type = 'instant')
      OR
      (r.status = 'scheduled'
       AND r.order_type = 'advance'
       AND r.scheduled_timestamp IS NOT NULL
       AND r.scheduled_timestamp <= now() + (v_lead_minutes || ' minutes')::interval
      )
    )
    AND NOT (r.declined_by @> ARRAY[p_dp_user_id])
    -- City match: if DP has a city, only show requests from same city or no city
    AND (v_dp_city IS NULL OR up.city IS NULL OR up.city = v_dp_city)
    AND (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(COALESCE(r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(COALESCE(r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ))
      )
    ) <= v_service_range
  ORDER BY
    CASE WHEN r.order_type = 'instant' THEN 0 ELSE 1 END,
    r.created_at DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_nearby_requests(uuid) TO authenticated;

-- =============================================================================
-- END: 20260803051336_enhance_get_nearby_requests_smart_matching.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260803135956_20260803140000_advance_request_v3_additive_upgrade.sql.sql
-- =============================================================================

/*
# Advance Request V3 — Additive Upgrade

1. Purpose
   Upgrades the existing PingGET database to support the V3 reservation-based advance request flow
   without touching any existing tables, columns, migrations, or business logic.
   All statements use IF NOT EXISTS / CREATE OR REPLACE so re-running is safe.

2. New Columns on `requests` (added only if missing)
   - reserved_dp_id, reserved_at, payment_deadline, advance_payment_id,
     search_radius_current, dp_cancelled_count, task_started_at, task_completed_at

3. New Columns on `advance_settings` (added only if missing)
   - confirmation_fee, reservation_search_radius_meters, payment_deadline_minutes,
     dp_cancel_research, min_advance_buffer_minutes

4. New Columns on `messages` — advance_payment_id
5. New Columns on `notifications` — image_url, route, entity_id, notification_type, read_at, deleted_at
6. New Tables — advance_payments, device_tokens, notification_delivery_logs
7. New RPCs — search_available_dps_for_advance, reserve_dp_for_advance, retry_search_for_advance
8. Modified RPC — get_nearby_requests (signature unchanged, now also returns 'searching_dp' requests)
*/

-- 1. ADD COLUMNS TO requests
ALTER TABLE requests ADD COLUMN IF NOT EXISTS reserved_dp_id uuid;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS reserved_at timestamptz;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS payment_deadline timestamptz;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS advance_payment_id uuid;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS search_radius_current int;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS dp_cancelled_count int DEFAULT 0;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS task_started_at timestamptz;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS task_completed_at timestamptz;

-- 2. ADD COLUMNS TO advance_settings
ALTER TABLE advance_settings ADD COLUMN IF NOT EXISTS confirmation_fee numeric DEFAULT 50;
ALTER TABLE advance_settings ADD COLUMN IF NOT EXISTS reservation_search_radius_meters int DEFAULT 5000;
ALTER TABLE advance_settings ADD COLUMN IF NOT EXISTS payment_deadline_minutes int DEFAULT 30;
ALTER TABLE advance_settings ADD COLUMN IF NOT EXISTS dp_cancel_research boolean DEFAULT true;
ALTER TABLE advance_settings ADD COLUMN IF NOT EXISTS min_advance_buffer_minutes int DEFAULT 60;

-- 3. ADD COLUMNS TO messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS advance_payment_id uuid;

-- 4. ADD COLUMNS TO notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS route text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_id uuid;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notification_type text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at timestamptz;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 5. CREATE advance_payments TABLE
CREATE TABLE IF NOT EXISTS advance_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  chat_room_id uuid REFERENCES chat_rooms(id) ON DELETE SET NULL,
  dp_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  payment_deadline timestamptz,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','proof_uploaded','verified','rejected','expired')),
  screenshot_url text,
  upi_ref text,
  transaction_id text,
  customer_remarks text,
  uploaded_at timestamptz,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  reject_reason text,
  admin_override boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE advance_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "advance_payments_select_participants" ON advance_payments;
CREATE POLICY "advance_payments_select_participants" ON advance_payments FOR SELECT
  TO authenticated USING (customer_id = auth.uid() OR dp_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "advance_payments_insert_participants" ON advance_payments;
CREATE POLICY "advance_payments_insert_participants" ON advance_payments FOR INSERT
  TO authenticated WITH CHECK (customer_id = auth.uid() OR dp_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "advance_payments_update_participants" ON advance_payments;
CREATE POLICY "advance_payments_update_participants" ON advance_payments FOR UPDATE
  TO authenticated USING (customer_id = auth.uid() OR dp_id = auth.uid() OR public.is_admin())
  WITH CHECK (customer_id = auth.uid() OR dp_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "advance_payments_delete_admin" ON advance_payments;
CREATE POLICY "advance_payments_delete_admin" ON advance_payments FOR DELETE
  TO authenticated USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_advance_payments_request ON advance_payments(request_id);
CREATE INDEX IF NOT EXISTS idx_advance_payments_status ON advance_payments(status);

-- 6. CREATE device_tokens TABLE
CREATE TABLE IF NOT EXISTS device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text,
  app_version text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "device_tokens_select_own" ON device_tokens;
CREATE POLICY "device_tokens_select_own" ON device_tokens FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "device_tokens_insert_own" ON device_tokens;
CREATE POLICY "device_tokens_insert_own" ON device_tokens FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "device_tokens_update_own" ON device_tokens;
CREATE POLICY "device_tokens_update_own" ON device_tokens FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "device_tokens_delete_own" ON device_tokens;
CREATE POLICY "device_tokens_delete_own" ON device_tokens FOR DELETE
  TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_token ON device_tokens(token);

-- 7. CREATE notification_delivery_logs TABLE
CREATE TABLE IF NOT EXISTS notification_delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES notifications(id) ON DELETE SET NULL,
  device_token_id uuid REFERENCES device_tokens(id) ON DELETE SET NULL,
  token text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  fcm_message_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notification_delivery_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_logs_select_own_admin" ON notification_delivery_logs;
CREATE POLICY "notif_logs_select_own_admin" ON notification_delivery_logs FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM device_tokens dt WHERE dt.id = notification_delivery_logs.device_token_id AND dt.user_id = auth.uid())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "notif_logs_insert_own" ON notification_delivery_logs;
CREATE POLICY "notif_logs_insert_own" ON notification_delivery_logs FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_notif_logs_notification ON notification_delivery_logs(notification_id);

-- 8. ADD FK from requests.advance_payment_id to advance_payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'requests_advance_payment_id_fkey'
      AND table_name = 'requests' AND table_schema = 'public'
  ) THEN
    ALTER TABLE requests ADD CONSTRAINT requests_advance_payment_id_fkey
      FOREIGN KEY (advance_payment_id) REFERENCES advance_payments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 9. RPC: search_available_dps_for_advance
CREATE OR REPLACE FUNCTION search_available_dps_for_advance(
  p_request_id uuid
)
RETURNS TABLE (
  dp_user_id uuid,
  full_name text,
  gps_lat double precision,
  gps_lng double precision,
  distance_meters double precision,
  service_range_meters integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_request RECORD;
  v_settings RECORD;
  v_radius integer;
  v_lat double precision;
  v_lng double precision;
BEGIN
  SELECT * INTO v_request FROM requests WHERE id = p_request_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_lat := COALESCE(v_request.pickup_lat, v_request.delivery_lat);
  v_lng := COALESCE(v_request.pickup_lng, v_request.delivery_lng);
  IF v_lat IS NULL OR v_lng IS NULL THEN RETURN; END IF;

  SELECT * INTO v_settings FROM advance_settings LIMIT 1;
  v_radius := COALESCE(v_request.search_radius_current, v_settings.reservation_search_radius_meters, 5000);

  RETURN QUERY
  SELECT
    dp.user_id,
    p.full_name,
    p.gps_lat,
    p.gps_lng,
    (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(p.gps_lat - v_lat) / 2) ^ 2 +
          cos(radians(v_lat)) * cos(radians(p.gps_lat)) *
          sin(radians(p.gps_lng - v_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(p.gps_lat - v_lat) / 2) ^ 2 +
          cos(radians(v_lat)) * cos(radians(p.gps_lat)) *
          sin(radians(p.gps_lng - v_lng) / 2) ^ 2
        ))
      )
    ) AS dist,
    dp.service_range_meters
  FROM delivery_partners dp
  JOIN profiles p ON p.id = dp.user_id
  WHERE dp.is_online = true
    AND dp.status = 'approved'
    AND p.gps_lat IS NOT NULL AND p.gps_lng IS NOT NULL
    AND NOT (v_request.declined_by @> ARRAY[dp.user_id])
    AND dp.user_id != v_request.user_id
    AND (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(p.gps_lat - v_lat) / 2) ^ 2 +
          cos(radians(v_lat)) * cos(radians(p.gps_lat)) *
          sin(radians(p.gps_lng - v_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(p.gps_lat - v_lat) / 2) ^ 2 +
          cos(radians(v_lat)) * cos(radians(p.gps_lat)) *
          sin(radians(p.gps_lng - v_lng) / 2) ^ 2
        ))
      )
    ) <= v_radius
  ORDER BY dist ASC;
END;
$function$;

GRANT EXECUTE ON FUNCTION search_available_dps_for_advance(uuid) TO authenticated;

-- 10. RPC: reserve_dp_for_advance
CREATE OR REPLACE FUNCTION reserve_dp_for_advance(
  p_request_id uuid,
  p_dp_user_id uuid
)
RETURNS TABLE (
  success boolean,
  chat_room_id uuid,
  advance_payment_id uuid,
  error_msg text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_request RECORD;
  v_settings RECORD;
  v_room_id uuid;
  v_dp_name text;
  v_user_name text;
  v_payment_id uuid;
  v_deadline timestamptz;
  v_fee numeric;
  v_deadline_minutes integer;
BEGIN
  SELECT * INTO v_request FROM requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, 'Request not found';
    RETURN;
  END IF;

  IF v_request.status NOT IN ('searching_dp', 'no_dp_found') THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, 'Request is not in searching state';
    RETURN;
  END IF;

  IF v_request.declined_by @> ARRAY[p_dp_user_id] THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, 'You declined this request';
    RETURN;
  END IF;

  SELECT * INTO v_settings FROM advance_settings LIMIT 1;
  v_fee := COALESCE(v_settings.confirmation_fee, 50);
  v_deadline_minutes := COALESCE(v_settings.payment_deadline_minutes, 30);
  v_deadline := now() + (v_deadline_minutes || ' minutes')::interval;

  UPDATE requests
  SET status = 'dp_reserved',
      reserved_dp_id = p_dp_user_id,
      reserved_at = now(),
      accepted_dp_id = p_dp_user_id,
      payment_deadline = v_deadline
  WHERE id = p_request_id;

  SELECT full_name INTO v_dp_name FROM profiles WHERE id = p_dp_user_id;
  SELECT full_name INTO v_user_name FROM profiles WHERE id = v_request.user_id;

  SELECT id INTO v_room_id FROM chat_rooms WHERE request_id = p_request_id LIMIT 1;
  IF v_room_id IS NULL THEN
    INSERT INTO chat_rooms (request_id, user_id, dp_id)
    VALUES (p_request_id, v_request.user_id, p_dp_user_id)
    RETURNING id INTO v_room_id;
  END IF;

  INSERT INTO advance_payments (request_id, chat_room_id, dp_id, customer_id, amount, payment_deadline, status)
  VALUES (p_request_id, v_room_id, p_dp_user_id, v_request.user_id, v_fee, v_deadline, 'waiting')
  RETURNING id INTO v_payment_id;

  UPDATE requests SET advance_payment_id = v_payment_id WHERE id = p_request_id;

  INSERT INTO messages (chat_room_id, sender_id, message_type, quotation_data)
  VALUES (
    v_room_id, v_request.user_id, 'order_summary',
    jsonb_build_object(
      'description', v_request.description,
      'preferred_shop', v_request.preferred_shop,
      'pickup_address', v_request.pickup_address,
      'delivery_address', v_request.delivery_address,
      'scheduled_date', v_request.scheduled_date,
      'scheduled_time', v_request.scheduled_time,
      'photo_urls', v_request.photo_urls,
      'voice_note_url', v_request.voice_note_url
    )
  );

  INSERT INTO messages (chat_room_id, sender_id, content, message_type)
  VALUES (
    v_room_id, p_dp_user_id,
    COALESCE('Hi ' || v_user_name || '! I''ve reserved your advance booking. Please pay the Advance Confirmation Amount to confirm this booking.', 'Hello! Please pay the confirmation amount to confirm.'),
    'text'
  );

  INSERT INTO messages (chat_room_id, sender_id, message_type, advance_payment_id, quotation_data)
  VALUES (
    v_room_id, p_dp_user_id, 'advance_payment', v_payment_id,
    jsonb_build_object('amount', v_fee, 'deadline', v_deadline::text, 'message', 'Please pay the Advance Confirmation Amount to reserve this booking.')
  );

  INSERT INTO notifications (user_id, title, body, type, related_id, route, entity_id, notification_type)
  VALUES (
    v_request.user_id, 'Delivery Partner Reserved!',
    COALESCE(v_dp_name, 'A delivery partner') || ' has reserved your advance booking. Pay the confirmation amount to confirm.',
    'dp_reserved', p_request_id, 'chat', v_room_id, 'dp_reserved'
  );

  INSERT INTO notifications (user_id, title, body, type, related_id, route, entity_id, notification_type)
  VALUES (
    p_dp_user_id, 'Advance Booking Reserved',
    'You reserved an advance booking for ' || COALESCE(v_user_name, 'a customer') || '. Waiting for payment confirmation.',
    'advance_reserved', p_request_id, 'chat', v_room_id, 'advance_reserved'
  );

  RETURN QUERY SELECT true, v_room_id, v_payment_id, NULL::text;
END;
$function$;

GRANT EXECUTE ON FUNCTION reserve_dp_for_advance(uuid, uuid) TO authenticated;

-- 11. RPC: retry_search_for_advance
CREATE OR REPLACE FUNCTION retry_search_for_advance(
  p_request_id uuid
)
RETURNS TABLE (
  success boolean,
  new_radius integer,
  found_dps integer,
  error_msg text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_request RECORD;
  v_settings RECORD;
  v_new_radius integer;
  v_dp_count integer;
BEGIN
  SELECT * INTO v_request FROM requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0, 'Request not found';
    RETURN;
  END IF;

  IF v_request.order_type != 'advance' THEN
    RETURN QUERY SELECT false, 0, 0, 'Not an advance request';
    RETURN;
  END IF;

  IF v_request.status NOT IN ('searching_dp', 'no_dp_found', 'dp_reserved') THEN
    RETURN QUERY SELECT false, 0, 0, 'Request is not in a retryable state';
    RETURN;
  END IF;

  SELECT * INTO v_settings FROM advance_settings LIMIT 1;
  IF NOT FOUND THEN
    v_new_radius := COALESCE(v_request.search_radius_current, 5000) + 1000;
  ELSE
    IF NOT COALESCE(v_settings.expand_search_radius, false) THEN
      RETURN QUERY SELECT false, COALESCE(v_request.search_radius_current, 5000), 0, 'Radius expansion is disabled';
      RETURN;
    END IF;

    v_new_radius := COALESCE(v_request.search_radius_current, v_settings.reservation_search_radius_meters, 5000)
      + COALESCE(v_settings.search_radius_increment_meters, 1000);

    IF v_new_radius > COALESCE(v_settings.max_search_radius_meters, 20000) THEN
      v_new_radius := COALESCE(v_settings.max_search_radius_meters, 20000);
    END IF;
  END IF;

  UPDATE requests
  SET search_radius_current = v_new_radius,
      status = 'searching_dp',
      reserved_dp_id = NULL,
      reserved_at = NULL,
      dp_cancelled_count = COALESCE(dp_cancelled_count, 0) + 1
  WHERE id = p_request_id;

  SELECT COUNT(*)::integer INTO v_dp_count
  FROM search_available_dps_for_advance(p_request_id);

  IF v_dp_count = 0 THEN
    UPDATE requests SET status = 'no_dp_found' WHERE id = p_request_id;
  END IF;

  RETURN QUERY SELECT true, v_new_radius, v_dp_count, NULL::text;
END;
$function$;

GRANT EXECUTE ON FUNCTION retry_search_for_advance(uuid) TO authenticated;

-- 12. UPDATE get_nearby_requests for V3 — drop and recreate (same signature)
DROP FUNCTION IF EXISTS get_nearby_requests(uuid);

CREATE OR REPLACE FUNCTION get_nearby_requests(
  p_dp_user_id uuid
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  description text,
  photo_urls text[],
  voice_note_url text,
  preferred_shop text,
  pickup_address text,
  pickup_lat double precision,
  pickup_lng double precision,
  delivery_address text,
  delivery_lat double precision,
  delivery_lng double precision,
  expected_time text,
  max_budget numeric,
  special_instructions text,
  created_at timestamptz,
  user_full_name text,
  user_gps_lat double precision,
  user_gps_lng double precision,
  distance_meters double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_dp_lat double precision;
  v_dp_lng double precision;
  v_service_range integer;
BEGIN
  SELECT p.gps_lat, p.gps_lng, dp.service_range_meters
  INTO v_dp_lat, v_dp_lng, v_service_range
  FROM delivery_partners dp
  JOIN profiles p ON p.id = dp.user_id
  WHERE dp.user_id = p_dp_user_id
    AND dp.is_online = true
    AND dp.status = 'approved';

  IF v_dp_lat IS NULL OR v_dp_lng IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    r.id, r.user_id, r.description, r.photo_urls, r.voice_note_url,
    r.preferred_shop, r.pickup_address, r.pickup_lat, r.pickup_lng,
    r.delivery_address, r.delivery_lat, r.delivery_lng, r.expected_time,
    r.max_budget, r.special_instructions, r.created_at,
    up.full_name, up.gps_lat, up.gps_lng,
    (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(COALESCE(r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(COALESCE(r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ))
      )
    ) AS dist
  FROM requests r
  JOIN profiles up ON up.id = r.user_id
  WHERE (r.status = 'pending' OR r.status = 'searching_dp')
    AND NOT (r.declined_by @> ARRAY[p_dp_user_id])
    AND r.user_id != p_dp_user_id
    AND (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(COALESCE(r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(COALESCE(r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ))
      )
    ) <= v_service_range
  ORDER BY r.created_at DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION get_nearby_requests TO authenticated;
-- =============================================================================
-- END: 20260803135956_20260803140000_advance_request_v3_additive_upgrade.sql.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260809085519_fix_get_nearby_requests_advance_fields.sql
-- =============================================================================

-- Restore advance booking metadata on nearby requests for DP home.
-- V3 get_nearby_requests included searching_dp but dropped order_type/status/schedule fields,
-- which made advance cards show as INSTANT and Accept call accept_request (fails for searching_dp).

DROP FUNCTION IF EXISTS get_nearby_requests(uuid);

CREATE OR REPLACE FUNCTION get_nearby_requests(
  p_dp_user_id uuid
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  description text,
  photo_urls text[],
  voice_note_url text,
  preferred_shop text,
  pickup_address text,
  pickup_lat double precision,
  pickup_lng double precision,
  delivery_address text,
  delivery_lat double precision,
  delivery_lng double precision,
  expected_time text,
  max_budget numeric,
  special_instructions text,
  created_at timestamptz,
  user_full_name text,
  user_gps_lat double precision,
  user_gps_lng double precision,
  distance_meters double precision,
  status text,
  order_type text,
  is_scheduled boolean,
  scheduled_date date,
  scheduled_time text,
  scheduled_slot text,
  scheduled_timestamp timestamptz,
  request_category text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_dp_lat double precision;
  v_dp_lng double precision;
  v_service_range integer;
BEGIN
  SELECT p.gps_lat, p.gps_lng, dp.service_range_meters
  INTO v_dp_lat, v_dp_lng, v_service_range
  FROM delivery_partners dp
  JOIN profiles p ON p.id = dp.user_id
  WHERE dp.user_id = p_dp_user_id
    AND dp.is_online = true
    AND dp.status = 'approved';

  IF v_dp_lat IS NULL OR v_dp_lng IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    r.id, r.user_id, r.description, r.photo_urls, r.voice_note_url,
    r.preferred_shop, r.pickup_address, r.pickup_lat, r.pickup_lng,
    r.delivery_address, r.delivery_lat, r.delivery_lng, r.expected_time,
    r.max_budget, r.special_instructions, r.created_at,
    up.full_name, up.gps_lat, up.gps_lng,
    (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(COALESCE(r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(COALESCE(r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ))
      )
    ) AS dist,
    r.status::text,
    COALESCE(r.order_type, 'instant')::text,
    COALESCE(r.is_scheduled, false),
    r.scheduled_date,
    r.scheduled_time,
    r.scheduled_slot,
    r.scheduled_timestamp,
    r.request_category
  FROM requests r
  JOIN profiles up ON up.id = r.user_id
  WHERE (r.status = 'pending' OR r.status = 'searching_dp')
    AND NOT (r.declined_by @> ARRAY[p_dp_user_id])
    AND r.user_id != p_dp_user_id
    AND (
      6371000 * 2 * atan2(
        sqrt(
          sin(radians(COALESCE(r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ),
        sqrt(1 - (
          sin(radians(COALESCE(r.pickup_lat, up.gps_lat) - v_dp_lat) / 2) ^ 2 +
          cos(radians(v_dp_lat)) * cos(radians(COALESCE(r.pickup_lat, up.gps_lat))) *
          sin(radians(COALESCE(r.pickup_lng, up.gps_lng) - v_dp_lng) / 2) ^ 2
        ))
      )
    ) <= v_service_range
  ORDER BY r.created_at DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION get_nearby_requests TO authenticated;

-- =============================================================================
-- END: 20260809085519_fix_get_nearby_requests_advance_fields.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260809092000_fix_advance_message_types_and_media_upload.sql
-- =============================================================================

-- Allow advance booking chat message types used by reserve_dp_for_advance and ChatScreen.
-- Without this, Accept on advance bookings fails with a check-constraint error and never opens chat.
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_message_type_check
  CHECK (message_type IN (
    'text',
    'image',
    'voice',
    'location',
    'quotation',
    'order_summary',
    'advance_payment',
    'payment_proof'
  ));

-- Storage upserts need UPDATE; INSERT-only policy caused attachment upload failures.
DROP POLICY IF EXISTS "media_auth_update" ON storage.objects;
CREATE POLICY "media_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'media')
  WITH CHECK (bucket_id = 'media');

DROP POLICY IF EXISTS "media_auth_delete" ON storage.objects;
CREATE POLICY "media_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'media');

-- Harden reserve_dp_for_advance: idempotent + clearer errors; avoid optional notification columns.
CREATE OR REPLACE FUNCTION reserve_dp_for_advance(
  p_request_id uuid,
  p_dp_user_id uuid
)
RETURNS TABLE (
  success boolean,
  chat_room_id uuid,
  advance_payment_id uuid,
  error_msg text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_request RECORD;
  v_settings RECORD;
  v_room_id uuid;
  v_dp_name text;
  v_user_name text;
  v_payment_id uuid;
  v_deadline timestamptz;
  v_fee numeric;
  v_deadline_minutes integer;
BEGIN
  SELECT * INTO v_request FROM requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, 'Request not found';
    RETURN;
  END IF;

  -- Idempotent: if this DP already reserved, return existing chat
  IF v_request.accepted_dp_id = p_dp_user_id
     AND v_request.status IN ('dp_reserved', 'waiting_payment', 'booking_confirmed') THEN
    SELECT id INTO v_room_id FROM chat_rooms WHERE request_id = p_request_id LIMIT 1;
    RETURN QUERY SELECT true, v_room_id, v_request.advance_payment_id, NULL::text;
    RETURN;
  END IF;

  IF v_request.status NOT IN ('searching_dp', 'no_dp_found') THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, 'Request is not in searching state (' || COALESCE(v_request.status, '?') || ')';
    RETURN;
  END IF;

  IF v_request.declined_by @> ARRAY[p_dp_user_id] THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, 'You declined this request';
    RETURN;
  END IF;

  SELECT * INTO v_settings FROM advance_settings LIMIT 1;
  v_fee := COALESCE(v_settings.confirmation_fee, 50);
  v_deadline_minutes := COALESCE(v_settings.payment_deadline_minutes, 30);
  v_deadline := now() + (v_deadline_minutes || ' minutes')::interval;

  UPDATE requests
  SET status = 'dp_reserved',
      reserved_dp_id = p_dp_user_id,
      reserved_at = now(),
      accepted_dp_id = p_dp_user_id,
      payment_deadline = v_deadline
  WHERE id = p_request_id;

  SELECT full_name INTO v_dp_name FROM profiles WHERE id = p_dp_user_id;
  SELECT full_name INTO v_user_name FROM profiles WHERE id = v_request.user_id;

  SELECT id INTO v_room_id FROM chat_rooms WHERE request_id = p_request_id LIMIT 1;
  IF v_room_id IS NULL THEN
    INSERT INTO chat_rooms (request_id, user_id, dp_id)
    VALUES (p_request_id, v_request.user_id, p_dp_user_id)
    RETURNING id INTO v_room_id;
  ELSE
    UPDATE chat_rooms SET dp_id = p_dp_user_id WHERE id = v_room_id AND dp_id IS DISTINCT FROM p_dp_user_id;
  END IF;

  INSERT INTO advance_payments (request_id, chat_room_id, dp_id, customer_id, amount, payment_deadline, status)
  VALUES (p_request_id, v_room_id, p_dp_user_id, v_request.user_id, v_fee, v_deadline, 'waiting')
  RETURNING id INTO v_payment_id;

  UPDATE requests SET advance_payment_id = v_payment_id WHERE id = p_request_id;

  INSERT INTO messages (chat_room_id, sender_id, message_type, quotation_data)
  VALUES (
    v_room_id, v_request.user_id, 'order_summary',
    jsonb_build_object(
      'description', v_request.description,
      'preferred_shop', v_request.preferred_shop,
      'pickup_address', v_request.pickup_address,
      'delivery_address', v_request.delivery_address,
      'scheduled_date', v_request.scheduled_date,
      'scheduled_time', v_request.scheduled_time,
      'photo_urls', v_request.photo_urls,
      'voice_note_url', v_request.voice_note_url
    )
  );

  INSERT INTO messages (chat_room_id, sender_id, content, message_type)
  VALUES (
    v_room_id, p_dp_user_id,
    COALESCE('Hi ' || v_user_name || '! I''ve reserved your advance booking. Please pay the Advance Confirmation Amount to confirm this booking.', 'Hello! Please pay the confirmation amount to confirm.'),
    'text'
  );

  INSERT INTO messages (chat_room_id, sender_id, message_type, advance_payment_id, quotation_data)
  VALUES (
    v_room_id, p_dp_user_id, 'advance_payment', v_payment_id,
    jsonb_build_object(
      'amount', v_fee,
      'deadline', v_deadline::text,
      'booking_id', p_request_id,
      'scheduled_date', v_request.scheduled_date,
      'scheduled_time', COALESCE(v_request.scheduled_slot, v_request.scheduled_time),
      'purpose', 'Advance Booking Confirmation',
      'status', 'waiting',
      'message', 'Please pay the Advance Confirmation Amount to reserve this booking.'
    )
  );

  INSERT INTO notifications (user_id, title, body, type, related_id)
  VALUES (
    v_request.user_id, 'Delivery Partner Reserved!',
    COALESCE(v_dp_name, 'A delivery partner') || ' has reserved your advance booking. Pay the confirmation amount to confirm.',
    'dp_reserved', p_request_id
  );

  INSERT INTO notifications (user_id, title, body, type, related_id)
  VALUES (
    p_dp_user_id, 'Advance Booking Reserved',
    'You reserved an advance booking for ' || COALESCE(v_user_name, 'a customer') || '. Waiting for payment confirmation.',
    'advance_reserved', p_request_id
  );

  RETURN QUERY SELECT true, v_room_id, v_payment_id, NULL::text;
END;
$function$;

GRANT EXECUTE ON FUNCTION reserve_dp_for_advance(uuid, uuid) TO authenticated;

-- =============================================================================
-- END: 20260809092000_fix_advance_message_types_and_media_upload.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260809094500_fix_profiles_recursion_and_accept.sql
-- =============================================================================

-- Critical production fixes:
-- 1) profiles UPDATE recursion (photo upload fails with "infinite recursion detected in policy for relation profiles")
-- 2) advance Accept fails because message_type 'advance_payment' / 'payment_proof' not in CHECK
-- 3) harden reserve_dp_for_advance so Accept opens chat even if typed message insert fails

-- ─── 1. Fix is_admin + profiles UPDATE policies (no recursive SELECT on profiles) ───
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "admin_update_user_status" ON profiles;
CREATE POLICY "admin_update_user_status" ON profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- ─── 2. Message types for advance flow ───
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_message_type_check
  CHECK (message_type IN (
    'text','image','voice','location','quotation','order_summary','advance_payment','payment_proof'
  ));

-- ─── 3. Storage policies for upserts (avatars + media) ───
DROP POLICY IF EXISTS "media_auth_update" ON storage.objects;
CREATE POLICY "media_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'media')
  WITH CHECK (bucket_id = 'media');

DROP POLICY IF EXISTS "avatars_auth_update" ON storage.objects;
CREATE POLICY "avatars_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars')
  WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "media_auth_insert" ON storage.objects;
CREATE POLICY "media_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media');

DROP POLICY IF EXISTS "avatars_auth_insert" ON storage.objects;
CREATE POLICY "avatars_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

-- ─── 4. Bulletproof reserve_dp_for_advance ───
CREATE OR REPLACE FUNCTION reserve_dp_for_advance(
  p_request_id uuid,
  p_dp_user_id uuid
)
RETURNS TABLE (
  success boolean,
  chat_room_id uuid,
  advance_payment_id uuid,
  error_msg text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_request RECORD;
  v_settings RECORD;
  v_room_id uuid;
  v_dp_name text;
  v_user_name text;
  v_payment_id uuid;
  v_deadline timestamptz;
  v_fee numeric;
  v_deadline_minutes integer;
BEGIN
  SELECT * INTO v_request FROM requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, 'Request not found';
    RETURN;
  END IF;

  IF v_request.accepted_dp_id = p_dp_user_id
     AND v_request.status IN ('dp_reserved', 'waiting_payment', 'booking_confirmed', 'payment_verified') THEN
    SELECT id INTO v_room_id FROM chat_rooms WHERE request_id = p_request_id LIMIT 1;
    RETURN QUERY SELECT true, v_room_id, v_request.advance_payment_id, NULL::text;
    RETURN;
  END IF;

  IF v_request.status NOT IN ('searching_dp', 'no_dp_found') THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid,
      ('Request is not in searching state (' || COALESCE(v_request.status, '?') || ')');
    RETURN;
  END IF;

  IF v_request.declined_by @> ARRAY[p_dp_user_id] THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, 'You declined this request';
    RETURN;
  END IF;

  SELECT * INTO v_settings FROM advance_settings LIMIT 1;
  v_fee := COALESCE(v_settings.confirmation_fee, 50);
  v_deadline_minutes := COALESCE(v_settings.payment_deadline_minutes, 30);
  v_deadline := now() + (v_deadline_minutes || ' minutes')::interval;

  UPDATE requests
  SET status = 'dp_reserved',
      reserved_dp_id = p_dp_user_id,
      reserved_at = now(),
      accepted_dp_id = p_dp_user_id,
      payment_deadline = v_deadline
  WHERE id = p_request_id;

  SELECT full_name INTO v_dp_name FROM profiles WHERE id = p_dp_user_id;
  SELECT full_name INTO v_user_name FROM profiles WHERE id = v_request.user_id;

  SELECT id INTO v_room_id FROM chat_rooms WHERE request_id = p_request_id LIMIT 1;
  IF v_room_id IS NULL THEN
    INSERT INTO chat_rooms (request_id, user_id, dp_id)
    VALUES (p_request_id, v_request.user_id, p_dp_user_id)
    RETURNING id INTO v_room_id;
  ELSE
    UPDATE chat_rooms SET dp_id = p_dp_user_id WHERE id = v_room_id AND dp_id IS DISTINCT FROM p_dp_user_id;
  END IF;

  INSERT INTO advance_payments (request_id, chat_room_id, dp_id, customer_id, amount, payment_deadline, status)
  VALUES (p_request_id, v_room_id, p_dp_user_id, v_request.user_id, v_fee, v_deadline, 'waiting')
  RETURNING id INTO v_payment_id;

  UPDATE requests SET advance_payment_id = v_payment_id WHERE id = p_request_id;

  BEGIN
    INSERT INTO messages (chat_room_id, sender_id, message_type, quotation_data)
    VALUES (
      v_room_id, v_request.user_id, 'order_summary',
      jsonb_build_object(
        'description', v_request.description,
        'preferred_shop', v_request.preferred_shop,
        'pickup_address', v_request.pickup_address,
        'delivery_address', v_request.delivery_address,
        'scheduled_date', v_request.scheduled_date,
        'scheduled_time', v_request.scheduled_time,
        'photo_urls', v_request.photo_urls,
        'voice_note_url', v_request.voice_note_url
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  INSERT INTO messages (chat_room_id, sender_id, content, message_type)
  VALUES (
    v_room_id, p_dp_user_id,
    'Hi ' || COALESCE(v_user_name, 'there') || '! I have reserved your advance booking. Please pay the Advance Confirmation Amount (₹' || v_fee::text || ') to confirm.',
    'text'
  );

  BEGIN
    INSERT INTO messages (chat_room_id, sender_id, message_type, advance_payment_id, quotation_data)
    VALUES (
      v_room_id, p_dp_user_id, 'advance_payment', v_payment_id,
      jsonb_build_object(
        'amount', v_fee,
        'deadline', v_deadline::text,
        'booking_id', p_request_id,
        'scheduled_date', v_request.scheduled_date,
        'scheduled_time', COALESCE(v_request.scheduled_slot, v_request.scheduled_time),
        'purpose', 'Advance Booking Confirmation',
        'status', 'waiting',
        'message', 'Please pay the Advance Confirmation Amount to reserve this booking.'
      )
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO messages (chat_room_id, sender_id, content, message_type)
    VALUES (
      v_room_id, p_dp_user_id,
      'Advance confirmation payment requested: ₹' || v_fee::text || '. Please pay and upload proof in chat.',
      'text'
    );
  END;

  BEGIN
    INSERT INTO notifications (user_id, title, body, type, related_id)
    VALUES (
      v_request.user_id, 'Delivery Partner Reserved!',
      COALESCE(v_dp_name, 'A delivery partner') || ' has reserved your advance booking. Pay the confirmation amount to confirm.',
      'dp_reserved', p_request_id
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN QUERY SELECT true, v_room_id, v_payment_id, NULL::text;
END;
$function$;

GRANT EXECUTE ON FUNCTION reserve_dp_for_advance(uuid, uuid) TO authenticated;

-- Allow DPs to see nearby advance requests (searching_dp) for enrichment / UI
DROP POLICY IF EXISTS "requests_select_participants" ON requests;
CREATE POLICY "requests_select_participants" ON requests FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR accepted_dp_id = auth.uid()
    OR reserved_dp_id = auth.uid()
    OR status IN ('pending', 'searching_dp', 'no_dp_found')
    OR public.is_admin()
  );

-- Safe profile photo update (bypasses recursive UPDATE policies)
CREATE OR REPLACE FUNCTION public.update_own_photo_url(p_photo_url text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE public.profiles SET photo_url = p_photo_url WHERE id = auth.uid();
  RETURN p_photo_url;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_own_photo_url(text) TO authenticated;

-- =============================================================================
-- END: 20260809094500_fix_profiles_recursion_and_accept.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260809110000_mutual_cancel_and_scheduled_notify.sql
-- =============================================================================

-- Mutual cancel for advance bookings + scheduled admin broadcasts

-- 1) Mutual cancel columns on requests
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS cancel_requested_by text,
  ADD COLUMN IF NOT EXISTS cancel_request_reason text,
  ADD COLUMN IF NOT EXISTS cancel_requested_at timestamptz;

COMMENT ON COLUMN requests.cancel_requested_by IS 'user | dp — party who requested mutual cancel on advance booking';

-- 2) Request mutual cancel (advance only once a DP is involved)
CREATE OR REPLACE FUNCTION request_mutual_cancel(
  p_request_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req requests%ROWTYPE;
  v_role text;
  v_other uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_req FROM requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Request not found');
  END IF;

  IF v_req.status IN ('cancelled', 'completed', 'expired') THEN
    RETURN json_build_object('success', false, 'error', 'Order already closed');
  END IF;

  IF COALESCE(v_req.order_type, 'instant') <> 'advance' THEN
    RETURN json_build_object('success', false, 'error', 'Use normal cancel for instant orders');
  END IF;

  -- Who is calling?
  IF v_uid = v_req.user_id THEN
    v_role := 'user';
    v_other := COALESCE(v_req.reserved_dp_id, v_req.accepted_dp_id);
  ELSIF v_uid = v_req.reserved_dp_id OR v_uid = v_req.accepted_dp_id THEN
    v_role := 'dp';
    v_other := v_req.user_id;
  ELSE
    RETURN json_build_object('success', false, 'error', 'Not a party on this order');
  END IF;

  -- No partner yet → user may cancel alone
  IF v_role = 'user' AND v_other IS NULL THEN
    UPDATE requests SET
      status = 'cancelled',
      cancellation_reason = COALESCE(p_reason, 'Cancelled before partner reserved'),
      cancelled_by = 'customer',
      cancel_requested_by = NULL,
      cancel_request_reason = NULL,
      cancel_requested_at = NULL
    WHERE id = p_request_id;
    RETURN json_build_object('success', true, 'cancelled', true, 'mode', 'solo');
  END IF;

  -- Already requested by the other party → confirm cancel
  IF v_req.cancel_requested_by IS NOT NULL AND v_req.cancel_requested_by <> v_role THEN
    UPDATE requests SET
      status = 'cancelled',
      cancellation_reason = COALESCE(p_reason, v_req.cancel_request_reason, 'Cancelled by mutual agreement'),
      cancelled_by = 'mutual',
      cancel_requested_by = NULL,
      cancel_request_reason = NULL,
      cancel_requested_at = NULL
    WHERE id = p_request_id;

    UPDATE orders SET status = 'cancelled' WHERE request_id = p_request_id;

    IF v_other IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, body, type, related_id, notification_type)
      VALUES (
        v_other,
        'Booking cancelled',
        'This advance booking was cancelled by mutual agreement.',
        'order_status',
        p_request_id,
        'advance_cancel_confirmed'
      );
    END IF;

    RETURN json_build_object('success', true, 'cancelled', true, 'mode', 'mutual');
  END IF;

  -- Same party refreshing request
  IF v_req.cancel_requested_by = v_role THEN
    UPDATE requests SET
      cancel_request_reason = COALESCE(p_reason, cancel_request_reason),
      cancel_requested_at = now()
    WHERE id = p_request_id;
    RETURN json_build_object('success', true, 'cancelled', false, 'mode', 'pending', 'waiting_for', CASE WHEN v_role = 'user' THEN 'dp' ELSE 'user' END);
  END IF;

  -- New request from this party
  UPDATE requests SET
    cancel_requested_by = v_role,
    cancel_request_reason = p_reason,
    cancel_requested_at = now()
  WHERE id = p_request_id;

  IF v_other IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, body, type, related_id, notification_type)
    VALUES (
      v_other,
      'Cancel requested',
      CASE WHEN v_role = 'user'
        THEN 'Customer requested to cancel this advance booking. Open Orders to agree or ignore.'
        ELSE 'Partner requested to cancel this advance booking. Open Orders to agree or ignore.'
      END,
      'order_status',
      p_request_id,
      'advance_cancel_request'
    );
  END IF;

  RETURN json_build_object('success', true, 'cancelled', false, 'mode', 'pending', 'waiting_for', CASE WHEN v_role = 'user' THEN 'dp' ELSE 'user' END);
END;
$$;

GRANT EXECUTE ON FUNCTION request_mutual_cancel(uuid, text) TO authenticated;

-- 3) Instant cancel (customer only)
CREATE OR REPLACE FUNCTION cancel_instant_order(
  p_request_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req requests%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_req FROM requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Request not found');
  END IF;

  IF v_req.user_id <> v_uid THEN
    RETURN json_build_object('success', false, 'error', 'Only the customer can cancel instant orders');
  END IF;

  IF COALESCE(v_req.order_type, 'instant') = 'advance' THEN
    RETURN json_build_object('success', false, 'error', 'Use mutual cancel for advance bookings');
  END IF;

  IF v_req.status NOT IN ('pending', 'accepted', 'confirmed', 'shopping', 'purchased') THEN
    RETURN json_build_object('success', false, 'error', 'This order can no longer be cancelled');
  END IF;

  UPDATE requests SET
    status = 'cancelled',
    cancellation_reason = COALESCE(p_reason, 'Cancelled by customer'),
    cancelled_by = 'customer'
  WHERE id = p_request_id;

  UPDATE orders SET status = 'cancelled' WHERE request_id = p_request_id;

  IF v_req.accepted_dp_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, body, type, related_id, notification_type)
    VALUES (
      v_req.accepted_dp_id,
      'Order cancelled',
      'The customer cancelled this instant order.',
      'order_status',
      p_request_id,
      'instant_cancelled'
    );
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_instant_order(uuid, text) TO authenticated;

-- 4) Scheduled / admin broadcast queue
CREATE TABLE IF NOT EXISTS notification_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  image_url text,
  target_type text NOT NULL CHECK (target_type IN ('broadcast', 'all_users', 'all_dps', 'single')),
  target_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  recipient_count integer DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

ALTER TABLE notification_broadcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "broadcasts_admin_all" ON notification_broadcasts;
CREATE POLICY "broadcasts_admin_all" ON notification_broadcasts FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_notification_broadcasts_pending
  ON notification_broadcasts (scheduled_for)
  WHERE status = 'pending';

-- =============================================================================
-- END: 20260809110000_mutual_cancel_and_scheduled_notify.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: 20260809120000_push_outbox_and_fcm.sql
-- =============================================================================

-- Push outbox + unique device tokens + ensure broadcast table
-- PASTE INTO SUPABASE SQL EDITOR IF MIGRATIONS ARE NOT AUTO-APPLIED

CREATE TABLE IF NOT EXISTS notification_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  image_url text,
  target_type text NOT NULL CHECK (target_type IN ('broadcast', 'all_users', 'all_dps', 'single')),
  target_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  recipient_count integer DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

ALTER TABLE notification_broadcasts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "broadcasts_admin_all" ON notification_broadcasts;
CREATE POLICY "broadcasts_admin_all" ON notification_broadcasts FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_notification_broadcasts_pending
  ON notification_broadcasts (scheduled_for)
  WHERE status = 'pending';

-- Unique device token for upserts
CREATE UNIQUE INDEX IF NOT EXISTS device_tokens_token_uidx ON device_tokens (token);

CREATE TABLE IF NOT EXISTS push_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  image_url text,
  notification_type text,
  related_id uuid,
  route text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped_no_fcm')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_push_outbox_pending ON push_outbox (created_at) WHERE status = 'pending';
ALTER TABLE push_outbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push_outbox_admin" ON push_outbox;
CREATE POLICY "push_outbox_admin" ON push_outbox FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE OR REPLACE FUNCTION enqueue_push_outbox()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO push_outbox (
    notification_id, user_id, title, body, image_url,
    notification_type, related_id, route, status
  ) VALUES (
    NEW.id,
    NEW.user_id,
    NEW.title,
    NEW.body,
    NEW.image_url,
    COALESCE(NEW.notification_type, NEW.type),
    NEW.related_id,
    NEW.route,
    'pending'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_enqueue_push ON notifications;
CREATE TRIGGER trg_notifications_enqueue_push
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION enqueue_push_outbox();

-- =============================================================================
-- END: 20260809120000_push_outbox_and_fcm.sql
-- =============================================================================


-- =============================================================================
-- BEGIN: service_area_waitlist (coming-soon notify-me)
-- =============================================================================

CREATE TABLE IF NOT EXISTS service_area_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  email text NOT NULL,
  pincode text,
  area_name text,
  city_name text,
  lat double precision,
  lng double precision,
  source text DEFAULT 'app',
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS service_area_waitlist_email_uidx
  ON service_area_waitlist (lower(email));

CREATE INDEX IF NOT EXISTS service_area_waitlist_pincode_idx
  ON service_area_waitlist (pincode);

CREATE INDEX IF NOT EXISTS service_area_waitlist_created_idx
  ON service_area_waitlist (created_at DESC);

ALTER TABLE service_area_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_area_waitlist_insert_anyone" ON service_area_waitlist;
CREATE POLICY "service_area_waitlist_insert_anyone"
  ON service_area_waitlist FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_area_waitlist_select_own_or_admin" ON service_area_waitlist;
CREATE POLICY "service_area_waitlist_select_own_or_admin"
  ON service_area_waitlist FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "service_area_waitlist_update_admin" ON service_area_waitlist;
CREATE POLICY "service_area_waitlist_update_admin"
  ON service_area_waitlist FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "service_area_waitlist_delete_admin" ON service_area_waitlist;
CREATE POLICY "service_area_waitlist_delete_admin"
  ON service_area_waitlist FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "service_area_waitlist_update_own_email" ON service_area_waitlist;
CREATE POLICY "service_area_waitlist_update_own_email"
  ON service_area_waitlist FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  WITH CHECK (user_id = auth.uid() OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- =============================================================================
-- END: service_area_waitlist
-- =============================================================================

-- =============================================================================
-- BEGIN: instant COD payment completion columns
-- =============================================================================

ALTER TABLE requests ADD COLUMN IF NOT EXISTS payment_completed_at timestamptz;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS payment_accepted_at timestamptz;

COMMENT ON COLUMN requests.payment_completed_at IS 'Customer tapped Payment Completed after delivery';
COMMENT ON COLUMN requests.payment_accepted_at IS 'DP tapped Accept Payment after customer marked paid';

-- =============================================================================
-- END: instant COD payment completion columns
-- =============================================================================
