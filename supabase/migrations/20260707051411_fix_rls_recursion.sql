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
