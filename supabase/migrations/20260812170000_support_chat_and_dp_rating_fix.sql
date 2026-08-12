-- Harden support chat (idempotent) + customer-visible DP ratings

-- Tables (safe if already created)
CREATE TABLE IF NOT EXISTS support_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requester_role text NOT NULL CHECK (requester_role IN ('user', 'dp')),
  admin_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  related_request_id uuid REFERENCES requests(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'resolved', 'closed')),
  last_message_at timestamptz,
  last_message_preview text,
  requester_unread int NOT NULL DEFAULT 0,
  admin_unread int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS support_chats_open_requester_uidx
  ON support_chats (requester_id)
  WHERE status IN ('open', 'assigned');

CREATE INDEX IF NOT EXISTS support_chats_role_idx ON support_chats (requester_role, last_message_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES support_chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('user', 'dp', 'admin')),
  content text NOT NULL,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image')),
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_messages_chat_idx ON support_messages (chat_id, created_at);

ALTER TABLE support_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_chats_select ON support_chats;
CREATE POLICY support_chats_select ON support_chats FOR SELECT TO authenticated
  USING (
    requester_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS support_chats_insert ON support_chats;
CREATE POLICY support_chats_insert ON support_chats FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());

DROP POLICY IF EXISTS support_chats_update ON support_chats;
CREATE POLICY support_chats_update ON support_chats FOR UPDATE TO authenticated
  USING (
    requester_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS support_messages_select ON support_messages;
CREATE POLICY support_messages_select ON support_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM support_chats c
      WHERE c.id = chat_id
        AND (c.requester_id = auth.uid()
          OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
    )
  );

DROP POLICY IF EXISTS support_messages_insert ON support_messages;
CREATE POLICY support_messages_insert ON support_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM support_chats c
      WHERE c.id = chat_id
        AND (c.requester_id = auth.uid()
          OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
    )
  );

DROP POLICY IF EXISTS support_messages_update ON support_messages;
CREATE POLICY support_messages_update ON support_messages FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM support_chats c
      WHERE c.id = chat_id
        AND (c.requester_id = auth.uid()
          OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
    )
  );

CREATE OR REPLACE FUNCTION public.open_support_chat(p_related_request_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_chat_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role = 'customer' THEN
    v_role := 'user';
  END IF;
  IF v_role NOT IN ('user', 'dp') THEN
    RAISE EXCEPTION 'only customers and partners can open support chat';
  END IF;

  SELECT id INTO v_chat_id
  FROM support_chats
  WHERE requester_id = v_uid AND status IN ('open', 'assigned')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_chat_id IS NULL THEN
    INSERT INTO support_chats (requester_id, requester_role, related_request_id, status)
    VALUES (v_uid, v_role, p_related_request_id, 'open')
    RETURNING id INTO v_chat_id;
  ELSIF p_related_request_id IS NOT NULL THEN
    UPDATE support_chats
    SET related_request_id = COALESCE(related_request_id, p_related_request_id),
        updated_at = now()
    WHERE id = v_chat_id;
  END IF;

  RETURN v_chat_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_support_message(p_chat_id uuid, p_content text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_chat support_chats%ROWTYPE;
  v_msg_id uuid;
  v_sender_role text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_content IS NULL OR length(trim(p_content)) = 0 THEN
    RAISE EXCEPTION 'empty message';
  END IF;

  SELECT * INTO v_chat FROM support_chats WHERE id = p_chat_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'chat not found'; END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role = 'customer' THEN v_role := 'user'; END IF;

  IF v_role = 'admin' THEN
    v_sender_role := 'admin';
  ELSIF v_uid = v_chat.requester_id THEN
    v_sender_role := v_chat.requester_role;
  ELSE
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO support_messages (chat_id, sender_id, sender_role, content)
  VALUES (p_chat_id, v_uid, v_sender_role, trim(p_content))
  RETURNING id INTO v_msg_id;

  UPDATE support_chats SET
    last_message_at = now(),
    last_message_preview = left(trim(p_content), 140),
    updated_at = now(),
    admin_unread = CASE WHEN v_sender_role = 'admin' THEN admin_unread ELSE admin_unread + 1 END,
    requester_unread = CASE WHEN v_sender_role = 'admin' THEN requester_unread + 1 ELSE requester_unread END,
    admin_id = CASE WHEN v_sender_role = 'admin' THEN v_uid ELSE admin_id END,
    status = CASE
      WHEN v_sender_role = 'admin' AND status = 'open' THEN 'assigned'
      ELSE status
    END
  WHERE id = p_chat_id;

  RETURN v_msg_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_support_chat_read(p_chat_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_chat support_chats%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  SELECT * INTO v_chat FROM support_chats WHERE id = p_chat_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT role INTO v_role FROM profiles WHERE id = v_uid;

  IF v_role = 'admin' THEN
    UPDATE support_chats SET admin_unread = 0, updated_at = now() WHERE id = p_chat_id;
    UPDATE support_messages SET is_read = true
    WHERE chat_id = p_chat_id AND sender_role IN ('user', 'dp') AND is_read = false;
  ELSIF v_uid = v_chat.requester_id THEN
    UPDATE support_chats SET requester_unread = 0, updated_at = now() WHERE id = p_chat_id;
    UPDATE support_messages SET is_read = true
    WHERE chat_id = p_chat_id AND sender_role = 'admin' AND is_read = false;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_support_chat(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_support_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_support_chat_read(uuid) TO authenticated;

INSERT INTO app_settings (key, value)
VALUES ('support_email', 'support@pingget.in')
ON CONFLICT (key) DO NOTHING;

-- Customers can read public DP fields for partners on their requests
DROP POLICY IF EXISTS "dp_select_assigned_customer" ON delivery_partners;
CREATE POLICY "dp_select_assigned_customer" ON delivery_partners
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM requests r
      WHERE r.user_id = auth.uid()
        AND (
          r.accepted_dp_id = delivery_partners.user_id
          OR r.reserved_dp_id = delivery_partners.user_id
        )
    )
  );

CREATE OR REPLACE FUNCTION public.get_dp_public_stats(p_dp_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_avg numeric;
  v_count int;
  v_vehicle text;
BEGIN
  IF p_dp_user_id IS NULL THEN
    RETURN json_build_object('rating_avg', 0, 'rating_count', 0, 'vehicle_type', 'bike');
  END IF;

  SELECT vehicle_type, COALESCE(rating_avg, 0), COALESCE(rating_count, 0)
    INTO v_vehicle, v_avg, v_count
  FROM delivery_partners
  WHERE user_id = p_dp_user_id;

  IF NOT FOUND OR COALESCE(v_count, 0) = 0 THEN
    SELECT COALESCE(ROUND(AVG(stars)::numeric, 2), 0), COUNT(*)::int
      INTO v_avg, v_count
    FROM ratings
    WHERE rated_id = p_dp_user_id;
  END IF;

  IF v_vehicle IS NULL THEN
    SELECT vehicle_type INTO v_vehicle FROM delivery_partners WHERE user_id = p_dp_user_id;
  END IF;

  RETURN json_build_object(
    'rating_avg', COALESCE(v_avg, 0),
    'rating_count', COALESCE(v_count, 0),
    'vehicle_type', COALESCE(v_vehicle, 'bike')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dp_public_stats(uuid) TO authenticated;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE support_chats;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
