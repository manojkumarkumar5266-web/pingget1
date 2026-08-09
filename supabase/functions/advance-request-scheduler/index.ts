import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: settings, error: settingsError } = await supabase
      .from("advance_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      throw new Error(`Failed to fetch settings: ${settingsError.message}`);
    }

    const leadMinutes = settings?.notification_lead_minutes ?? 30;
    const now = Date.now();

    // 1. Transition scheduled→searching_dp for advance requests due within lead time
    //    In V3, advance requests start as 'searching_dp' immediately after booking.
    //    Legacy 'scheduled' requests are also transitioned to 'searching_dp'.
    const { data: activated, error: activateError } = await supabase
      .from("requests")
      .update({ status: "searching_dp" })
      .in("status", ["scheduled"])
      .eq("order_type", "advance")
      .not("scheduled_timestamp", "is", null)
      .filter(`scheduled_timestamp.lte.${new Date(now + leadMinutes * 60 * 1000).toISOString()}`)
      .select("id, user_id, request_category, scheduled_date, scheduled_time, recurring_type, recurring_interval_days, recurring_weekday, recurring_month_day, recurring_parent_id, recurring_count, scheduled_slot, delivery_address, delivery_lat, delivery_lng, pickup_address, pickup_lat, pickup_lng, preferred_shop, description, photo_urls, voice_note_url, max_budget, shop_name, shop_phone, shop_address, shop_lat, shop_lng, estimated_task_duration, estimated_total_charge, charge_breakdown, radius_meters");

    if (activateError) {
      throw new Error(`Failed to activate scheduled requests: ${activateError.message}`);
    }

    // 2. Send "Searching for Delivery Partner" notifications
    if (activated && activated.length > 0) {
      for (const req of activated) {
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", req.user_id)
          .eq("related_id", req.id)
          .eq("type", "advance_searching_dp")
          .maybeSingle();

        if (!existing) {
          await supabase.from("notifications").insert({
            user_id: req.user_id,
            title: "Searching for Delivery Partner",
            body: `Your ${req.request_category || "advance"} request is now active. We're finding a delivery partner for you.`,
            type: "advance_searching_dp",
            related_id: req.id,
          });
        }

        // 2b. Auto-create next recurring request if applicable
        if (req.recurring_type && req.recurring_type !== "none" && req.recurring_count < 100) {
          await createNextRecurringRequest(supabase, req);
        }
      }
    }

    // 2b. Retry search for searching_dp requests (V3 reservation flow)
    //     This calls the retry_search_for_advance RPC which:
    //     - Expands the search radius if admin settings allow
    //     - Finds available DPs and reserves the first one
    //     - Creates chat room and notifies both parties
    const { data: reservedCount, error: retryError } = await supabase.rpc("retry_search_for_advance");
    if (retryError) {
      console.error("Retry search error:", retryError.message);
    }

    // 3. Expire scheduled/searching_dp requests based on configurable expiry
    const expiryMinutes = getExpiryMinutes(settings?.expiry_mode, settings?.expiry_custom_minutes);
    if (expiryMinutes !== null) {
      const expireThreshold = new Date(now - expiryMinutes * 60 * 1000).toISOString();
      const { data: expired, error: expireError } = await supabase
        .from("requests")
        .update({ status: "expired", expired_at: new Date().toISOString() })
        .in("status", ["scheduled", "searching_dp"])
        .eq("order_type", "advance")
        .not("scheduled_timestamp", "is", null)
        .filter(`scheduled_timestamp.lt.${expireThreshold}`)
        .select("id, user_id");

      if (expireError) {
        console.error("Expire error:", expireError.message);
      }

      if (expired && expired.length > 0) {
        for (const req of expired) {
          await supabase.from("notifications").insert({
            user_id: req.user_id,
            title: "Advance Request Expired",
            body: "Your scheduled request has expired as no delivery partner was available. Please try rescheduling.",
            type: "advance_expired",
            related_id: req.id,
          });
        }
      }
    }

    // 4. Smart configurable reminders — sent for booking_confirmed and scheduled requests
    const reminderConfigs = [
      { enabled: settings?.reminder_24h, minutes: 24 * 60, type: "advance_reminder_24h", title: "Advance Request — 24 Hours Left", body: "is in 24 hours." },
      { enabled: settings?.reminder_12h, minutes: 12 * 60, type: "advance_reminder_12h", title: "Advance Request — 12 Hours Left", body: "is in 12 hours." },
      { enabled: settings?.reminder_2h, minutes: 2 * 60, type: "advance_reminder_2h", title: "Advance Request — 2 Hours Left", body: "is in 2 hours." },
      { enabled: settings?.reminder_1h, minutes: 60, type: "advance_reminder_1h", title: "Advance Request — 1 Hour Left", body: "is in 1 hour." },
      { enabled: settings?.reminder_30m, minutes: 30, type: "advance_reminder_30m", title: "Advance Request — 30 Minutes Left", body: "is in 30 minutes." },
      { enabled: settings?.reminder_15m, minutes: 15, type: "advance_reminder_15m", title: "Advance Request — 15 Minutes Left", body: "is in 15 minutes." },
      { enabled: settings?.reminder_5m, minutes: 5, type: "advance_reminder_5m", title: "Advance Request — 5 Minutes Left", body: "is starting in 5 minutes." },
    ];

    for (const r of reminderConfigs) {
      if (!r.enabled) continue;
      const ahead = new Date(now + r.minutes * 60 * 1000).toISOString();
      const behind = new Date(now + (r.minutes - 2) * 60 * 1000).toISOString();

      const { data: reminders } = await supabase
        .from("requests")
        .select("id, user_id, accepted_dp_id, reserved_dp_id, request_category, scheduled_date, scheduled_time")
        .in("status", ["scheduled", "booking_confirmed"])
        .eq("order_type", "advance")
        .not("scheduled_timestamp", "is", null)
        .filter(`scheduled_timestamp.lte.${ahead}`)
        .filter(`scheduled_timestamp.gt.${behind}`);

      if (reminders && reminders.length > 0) {
        for (const req of reminders) {
          const recipients = [req.user_id, req.accepted_dp_id || req.reserved_dp_id].filter(Boolean) as string[];
          const uniqueRecipients = [...new Set(recipients)];
          for (const recipientId of uniqueRecipients) {
            const { data: existing } = await supabase
              .from("notifications")
              .select("id")
              .eq("user_id", recipientId)
              .eq("related_id", req.id)
              .eq("type", r.type)
              .maybeSingle();

            if (!existing) {
              const isDp = recipientId !== req.user_id;
              await supabase.from("notifications").insert({
                user_id: recipientId,
                title: r.title,
                body: isDp
                  ? `Your reserved ${req.request_category || "scheduled"} task ${r.body}`
                  : `Your ${req.request_category || "scheduled"} request ${r.body}`,
                type: r.type,
                related_id: req.id,
              });
            }
          }
        }
      }
    }

    // Process due admin scheduled broadcasts → User/DP Alerts (+ Resend + FCM)
    let broadcastsSent = 0;
    let pushProcessed = 0;
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      const dueRes = await fetch(`${supabaseUrl}/functions/v1/notify-broadcast`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ processDueOnly: true }),
      });
      if (dueRes.ok) {
        const dueJson = await dueRes.json();
        broadcastsSent = dueJson.processed || 0;
      }

      const pushRes = await fetch(`${supabaseUrl}/functions/v1/dispatch-push`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ processOutbox: true, limit: 80 }),
      });
      if (pushRes.ok) {
        const pushJson = await pushRes.json();
        pushProcessed = pushJson.processed || 0;
      }
    } catch (broadcastErr: any) {
      console.error("scheduled broadcast / push processing error:", broadcastErr?.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        activated: activated?.length || 0,
        broadcastsSent,
        pushProcessed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getExpiryMinutes(mode: string | undefined, customMinutes: number | undefined): number | null {
  switch (mode) {
    case "30_minutes": return 30;
    case "1_hour": return 60;
    case "2_hours": return 120;
    case "4_hours": return 240;
    case "end_of_slot": return 120; // approximate
    case "never": return null;
    default: return customMinutes ?? 120;
  }
}

async function createNextRecurringRequest(supabase: any, parentReq: any): Promise<void> {
  try {
    const type: string = parentReq.recurring_type;
    if (type === "none" || !type) return;

    const baseDate = new Date(parentReq.scheduled_timestamp || parentReq.scheduled_date);
    let nextDate = new Date(baseDate);

    if (type === "daily") {
      nextDate.setDate(nextDate.getDate() + 1);
    } else if (type === "weekly") {
      const targetWeekday = parentReq.recurring_weekday;
      if (targetWeekday != null) {
        nextDate.setDate(nextDate.getDate() + 1);
        while (nextDate.getDay() !== targetWeekday) {
          nextDate.setDate(nextDate.getDate() + 1);
        }
      } else {
        nextDate.setDate(nextDate.getDate() + 7);
      }
    } else if (type === "monthly") {
      const targetDay = parentReq.recurring_month_day || baseDate.getDate();
      nextDate.setMonth(nextDate.getMonth() + 1);
      nextDate.setDate(targetDay);
    } else if (type === "custom") {
      const interval = parentReq.recurring_interval_days || 1;
      nextDate.setDate(nextDate.getDate() + interval);
    } else {
      return;
    }

    // Don't create requests more than 30 days ahead
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);
    if (nextDate > maxDate) return;

    // Check if next occurrence already exists
    const nextDateStr = nextDate.toISOString().slice(0, 10);
    const { data: existing } = await supabase
      .from("requests")
      .select("id")
      .eq("recurring_parent_id", parentReq.recurring_parent_id || parentReq.id)
      .eq("scheduled_date", nextDateStr)
      .maybeSingle();

    if (existing) return;

    const scheduledTime = parentReq.scheduled_time || "09:00";
    const [sh, sm] = scheduledTime.split(":").map(Number);
    const scheduledTimestamp = new Date(nextDate);
    scheduledTimestamp.setHours(sh || 9, sm || 0, 0, 0);

    await supabase.from("requests").insert({
      user_id: parentReq.user_id,
      description: parentReq.description,
      photo_urls: parentReq.photo_urls,
      voice_note_url: parentReq.voice_note_url,
      preferred_shop: parentReq.preferred_shop,
      pickup_address: parentReq.pickup_address,
      pickup_lat: parentReq.pickup_lat,
      pickup_lng: parentReq.pickup_lng,
      delivery_address: parentReq.delivery_address,
      delivery_lat: parentReq.delivery_lat,
      delivery_lng: parentReq.delivery_lng,
      max_budget: parentReq.max_budget,
      radius_meters: parentReq.radius_meters || 10000,
      status: "searching_dp",
      order_type: "advance",
      is_scheduled: true,
      scheduled_date: nextDateStr,
      scheduled_time: scheduledTime,
      scheduled_slot: parentReq.scheduled_slot,
      scheduled_timestamp: scheduledTimestamp.toISOString(),
      request_category: parentReq.request_category,
      shop_name: parentReq.shop_name,
      shop_phone: parentReq.shop_phone,
      shop_address: parentReq.shop_address,
      shop_lat: parentReq.shop_lat,
      shop_lng: parentReq.shop_lng,
      estimated_task_duration: parentReq.estimated_task_duration,
      estimated_total_charge: parentReq.estimated_total_charge,
      charge_breakdown: parentReq.charge_breakdown,
      recurring_type: type,
      recurring_interval_days: parentReq.recurring_interval_days,
      recurring_weekday: parentReq.recurring_weekday,
      recurring_month_day: parentReq.recurring_month_day,
      recurring_parent_id: parentReq.recurring_parent_id || parentReq.id,
      recurring_count: (parentReq.recurring_count || 0) + 1,
    });
  } catch (err) {
    console.error("Recurring creation error:", err.message);
  }
}
