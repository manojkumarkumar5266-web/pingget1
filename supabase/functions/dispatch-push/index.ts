import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { sendFcmToUserIds, fcmConfigured } from "../_shared/fcm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

/**
 * Dispatches FCM push for:
 * - a single notification_id
 * - a list of pending push_outbox rows (processOutbox: true)
 * - ad-hoc { userIds, title, body, ... }
 *
 * Auth: service role header OR authenticated user (for their own outbox) OR admin.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));

    if (body.processOutbox) {
      const result = await processOutbox(admin, Number(body.limit) || 40);
      return json({ success: true, fcmConfigured: fcmConfigured(), ...result });
    }

    if (body.notification_id || body.notificationId) {
      const id = body.notification_id || body.notificationId;
      const { data: n, error } = await admin.from("notifications").select("*").eq("id", id).maybeSingle();
      if (error || !n) return json({ success: false, error: "Notification not found" }, 404);

      const { data: profile } = await admin.from("profiles").select("role").eq("id", n.user_id).maybeSingle();
      const role = profile?.role || "user";
      const type = n.notification_type || n.type || "order_status";
      const route = n.route || defaultRoute(type, n.id, n.related_id, role);

      const push = await sendFcmToUserIds(admin, [n.user_id], {
        title: n.title,
        body: n.body || "",
        imageUrl: n.image_url,
        route,
        entityId: type === "admin_announcement" || type === "admin_offer" ? n.id : (n.related_id || n.id),
        notificationType: type,
        notificationId: n.id,
      });

      await admin.from("push_outbox").update({
        status: push.skipped ? "skipped_no_fcm" : (push.failed && !push.sent ? "failed" : "sent"),
        processed_at: new Date().toISOString(),
        error_message: push.skipped ? "FCM secrets not set" : null,
      }).eq("notification_id", n.id).eq("status", "pending");

      return json({ success: true, ...push, route });
    }

    if (Array.isArray(body.userIds) && body.title) {
      const push = await sendFcmToUserIds(admin, body.userIds, {
        title: body.title,
        body: body.body || "",
        imageUrl: body.imageUrl,
        route: body.route,
        entityId: body.entityId,
        notificationType: body.notificationType || "order_status",
        notificationId: body.notificationId,
      });
      return json({ success: true, ...push });
    }

    return json({ success: false, error: "Provide notificationId, processOutbox, or userIds+title" }, 400);
  } catch (err: any) {
    console.error("dispatch-push error:", err);
    return json({ success: false, error: err?.message || "failed" }, 500);
  }
});

async function processOutbox(admin: any, limit: number) {
  const { data: rows } = await admin
    .from("push_outbox")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  let processed = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows || []) {
    processed++;
    const { data: profile } = await admin.from("profiles").select("role").eq("id", row.user_id).maybeSingle();
    const role = profile?.role || "user";
    const type = row.notification_type || "order_status";
    const route = row.route || defaultRoute(type, row.notification_id, row.related_id, role);

    try {
      const result = await sendFcmToUserIds(admin, [row.user_id], {
        title: row.title,
        body: row.body || "",
        imageUrl: row.image_url,
        route,
        entityId: type === "admin_announcement" || type === "admin_offer" ? row.notification_id : (row.related_id || row.notification_id),
        notificationType: type,
        notificationId: row.notification_id,
      });
      if (result.skipped) {
        skipped++;
        await admin.from("push_outbox").update({
          status: "skipped_no_fcm",
          processed_at: new Date().toISOString(),
          error_message: "FCM secrets not set on edge function",
        }).eq("id", row.id);
      } else {
        sent += result.sent;
        failed += result.failed;
        await admin.from("push_outbox").update({
          status: result.sent > 0 ? "sent" : (result.failed > 0 ? "failed" : "sent"),
          processed_at: new Date().toISOString(),
          error_message: result.failed && !result.sent ? "No active device tokens or all sends failed" : null,
        }).eq("id", row.id);
      }
    } catch (e: any) {
      failed++;
      await admin.from("push_outbox").update({
        status: "failed",
        processed_at: new Date().toISOString(),
        error_message: String(e?.message || e).slice(0, 500),
      }).eq("id", row.id);
    }
  }

  return { processed, sent, failed, skipped };
}

function defaultRoute(type: string, notificationId: string, relatedId: string | null, role: string) {
  const base = role === "dp" ? "/dp" : "/app";
  if (type === "admin_announcement" || type === "admin_offer") {
    return `${base}/offers/${notificationId}`;
  }
  if (type === "request_accepted" || type === "delivery_accepted") return `${base === "/dp" ? "/dp/orders" : "/app/orders"}`;
  if (type === "new_chat_message" || type === "chat_message") {
    return relatedId ? `${base}/chat/${relatedId}` : `${base}/notifications`;
  }
  if (type === "new_nearby_request" || type === "order_received") return "/dp";
  if (relatedId) {
    return role === "dp" ? `/dp/navigate/${relatedId}` : `/app/track/${relatedId}`;
  }
  return `${base}/notifications`;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
