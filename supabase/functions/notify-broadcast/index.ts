import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { sendFcmToUserIds, fcmConfigured } from "../_shared/fcm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type TargetType = "broadcast" | "all_users" | "all_dps" | "single";

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
    const processDueOnly = !!body.processDueOnly;

    // Cron / service-role path (advance-request-scheduler)
    const authHeader = req.headers.get("Authorization") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (processDueOnly && authHeader.includes(serviceKey) && serviceKey) {
      const result = await processDueBroadcasts(admin);
      return json({ success: true, ...result });
    }

    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await anon.auth.getUser();
    if (userErr || !userData.user) {
      return json({ success: false, error: "Not authenticated" }, 401);
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (!profile || profile.role !== "admin") {
      return json({ success: false, error: "Admin only" }, 403);
    }

    const title = String(body.title || "").trim();
    const message = String(body.body || body.message || "").trim();
    const targetType = (body.targetType || "broadcast") as TargetType;
    const targetUserId = body.targetUserId as string | undefined;
    const imageUrl = body.imageUrl as string | undefined;
    const scheduledForRaw = body.scheduledFor as string | undefined;

    if (processDueOnly) {
      const result = await processDueBroadcasts(admin);
      return json({ success: true, ...result });
    }

    if (!title || !message) {
      return json({ success: false, error: "title and body are required" }, 400);
    }
    if (targetType === "single" && !targetUserId) {
      return json({ success: false, error: "targetUserId required for single" }, 400);
    }

    const scheduledFor = scheduledForRaw ? new Date(scheduledForRaw) : new Date();
    if (Number.isNaN(scheduledFor.getTime())) {
      return json({ success: false, error: "Invalid scheduledFor" }, 400);
    }

    const shouldSchedule = scheduledFor.getTime() - Date.now() > 45_000;

    const { data: broadcast, error: bErr } = await admin.from("notification_broadcasts").insert({
      title,
      body: message,
      image_url: imageUrl || null,
      target_type: targetType,
      target_user_id: targetType === "single" ? targetUserId : null,
      scheduled_for: scheduledFor.toISOString(),
      status: shouldSchedule ? "pending" : "sending",
      created_by: profile.id,
    }).select("id").single();

    if (bErr) return json({ success: false, error: bErr.message }, 500);

    if (shouldSchedule) {
      return json({
        success: true,
        scheduled: true,
        broadcastId: broadcast.id,
        scheduledFor: scheduledFor.toISOString(),
        channels: ["in_app_alerts", "email_resend", "push_fcm"],
        fcmConfigured: fcmConfigured(),
      });
    }

    const sendResult = await deliverBroadcast(admin, {
      title,
      body: message,
      imageUrl,
      targetType,
      targetUserId,
      broadcastId: broadcast.id,
    });

    await admin.from("notification_broadcasts").update({
      status: "sent",
      sent_at: new Date().toISOString(),
      recipient_count: sendResult.recipientCount || 0,
    }).eq("id", broadcast.id);

    return json({
      success: true,
      scheduled: false,
      broadcastId: broadcast.id,
      ...sendResult,
      channels: ["in_app_alerts", "email_resend", "push_fcm"],
      fcmConfigured: fcmConfigured(),
    });
  } catch (err: any) {
    console.error("notify-broadcast error:", err);
    return json({ success: false, error: err?.message || "Failed" }, 500);
  }
});

async function processDueBroadcasts(admin: ReturnType<typeof createClient>) {
  const nowIso = new Date().toISOString();
  const { data: due } = await admin
    .from("notification_broadcasts")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(20);

  let processed = 0;
  let failed = 0;

  for (const row of due || []) {
    await admin.from("notification_broadcasts").update({ status: "sending" }).eq("id", row.id);
    try {
      const result = await deliverBroadcast(admin, {
        title: row.title,
        body: row.body,
        imageUrl: row.image_url || undefined,
        targetType: row.target_type,
        targetUserId: row.target_user_id || undefined,
        broadcastId: row.id,
      });
      await admin.from("notification_broadcasts").update({
        status: "sent",
        sent_at: new Date().toISOString(),
        recipient_count: result.recipientCount || 0,
        error_message: null,
      }).eq("id", row.id);
      processed++;
    } catch (e: any) {
      await admin.from("notification_broadcasts").update({
        status: "failed",
        error_message: e?.message || "send failed",
      }).eq("id", row.id);
      failed++;
    }
  }

  return { processed, failed };
}

async function deliverBroadcast(
  admin: ReturnType<typeof createClient>,
  opts: {
    title: string;
    body: string;
    imageUrl?: string;
    targetType: TargetType;
    targetUserId?: string;
    broadcastId: string;
  },
) {
  let profilesQuery = admin.from("profiles").select("id, full_name, email, role");
  if (opts.targetType === "single" && opts.targetUserId) {
    profilesQuery = profilesQuery.eq("id", opts.targetUserId);
  } else if (opts.targetType === "all_users") {
    profilesQuery = profilesQuery.eq("role", "user");
  } else if (opts.targetType === "all_dps") {
    profilesQuery = profilesQuery.eq("role", "dp");
  } else {
    profilesQuery = profilesQuery.in("role", ["user", "dp"]);
  }

  const { data: recipients, error } = await profilesQuery;
  if (error) throw new Error(error.message);
  if (!recipients || recipients.length === 0) {
    return { recipientCount: 0, emailsSent: 0, inAppInserted: 0, pushSent: 0, pushFailed: 0 };
  }

  let inAppInserted = 0;
  let pushSent = 0;
  let pushFailed = 0;
  const insertedRows: any[] = [];

  for (let i = 0; i < recipients.length; i += 100) {
    const chunk = recipients.slice(i, i + 100);
    const inserts = chunk.map((r) => {
      const base = r.role === "dp" ? "/dp" : "/app";
      return {
        user_id: r.id,
        title: opts.title,
        body: opts.body,
        type: "admin_announcement",
        notification_type: "admin_offer",
        image_url: opts.imageUrl || null,
        related_id: opts.broadcastId,
        route: `${base}/offers/pending`, // updated after insert with real id
      };
    });
    const { data: created, error: insErr } = await admin.from("notifications").insert(inserts).select("id, user_id");
    if (insErr) throw new Error(insErr.message);
    for (const row of created || []) {
      const role = chunk.find((c) => c.id === row.user_id)?.role || "user";
      const base = role === "dp" ? "/dp" : "/app";
      const route = `${base}/offers/${row.id}`;
      await admin.from("notifications").update({ route, entity_id: row.id }).eq("id", row.id);
      insertedRows.push({ ...row, route, role });
    }
    inAppInserted += (created || []).length;
  }

  // Push each recipient (batched by identical payload except route/entity)
  for (const row of insertedRows) {
    const result = await sendFcmToUserIds(admin, [row.user_id], {
      title: opts.title,
      body: opts.body,
      imageUrl: opts.imageUrl,
      route: row.route,
      entityId: row.id,
      notificationType: "admin_offer",
      notificationId: row.id,
    });
    pushSent += result.sent;
    pushFailed += result.failed;
    // Mark outbox rows created by trigger as processed
    await admin.from("push_outbox").update({
      status: result.skipped ? "skipped_no_fcm" : (result.sent > 0 ? "sent" : "failed"),
      processed_at: new Date().toISOString(),
      route: row.route,
    }).eq("notification_id", row.id).eq("status", "pending");
  }

  // Resend emails
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "PingGet <noreply@pingget.com>";
  let emailsSent = 0;

  if (RESEND_API_KEY) {
    const withEmail = recipients.filter((r) => !!r.email).slice(0, 200);
    for (const r of withEmail) {
      try {
        const html = `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0E1016;border-radius:16px;overflow:hidden;color:#F7F4EE">
          <div style="padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.08)">
            <div style="font-size:22px;font-weight:800">
              <span style="color:#F7F4EE">pin</span><span style="color:#8FAE3E">G</span><span style="color:#C4D600">G</span><span style="color:#F7F4EE">et</span>
            </div>
          </div>
          <div style="padding:24px">
            <h1 style="margin:0 0 12px;font-size:20px">${escapeHtml(opts.title)}</h1>
            <p style="margin:0;font-size:14px;line-height:1.6;color:rgba(247,244,238,0.75)">${escapeHtml(opts.body)}</p>
            ${opts.imageUrl ? `<img src="${escapeHtml(opts.imageUrl)}" style="margin-top:16px;width:100%;border-radius:12px" />` : ""}
            <p style="margin-top:20px;font-size:12px;color:rgba(247,244,238,0.4)">Open Alerts in the app for full offer details.</p>
          </div>
        </div>`;
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [r.email],
            subject: opts.title,
            html,
            text: `${opts.title}\n\n${opts.body}`,
          }),
        });
        if (res.ok) emailsSent++;
      } catch (_) { /* ignore */ }
    }
  }

  return { recipientCount: recipients.length, emailsSent, inAppInserted, pushSent, pushFailed };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
