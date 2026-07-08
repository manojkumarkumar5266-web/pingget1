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
