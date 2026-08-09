import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

/**
 * Accept/reserve advance booking using service role.
 * Uses only message_type 'text' / 'order_summary' so it works even before
 * messages_message_type_check is updated for 'advance_payment'.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await anon.auth.getUser();
    if (userErr || !userData.user) {
      return json({ success: false, error_msg: "Not authenticated" }, 401);
    }
    const dpId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const requestId = body.request_id as string | undefined;
    if (!requestId) return json({ success: false, error_msg: "request_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: reqRow, error: reqErr } = await admin
      .from("requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();
    if (reqErr || !reqRow) return json({ success: false, error_msg: "Request not found" }, 404);

    // Idempotent
    if (
      reqRow.accepted_dp_id === dpId &&
      ["dp_reserved", "waiting_payment", "booking_confirmed", "payment_verified"].includes(reqRow.status)
    ) {
      const { data: room } = await admin.from("chat_rooms").select("id").eq("request_id", requestId).maybeSingle();
      return json({ success: true, chat_room_id: room?.id || null, advance_payment_id: reqRow.advance_payment_id });
    }

    if (!["searching_dp", "no_dp_found"].includes(reqRow.status)) {
      return json({ success: false, error_msg: `Request is not in searching state (${reqRow.status})` }, 400);
    }

    const declined: string[] = reqRow.declined_by || [];
    if (declined.includes(dpId)) {
      return json({ success: false, error_msg: "You declined this request" }, 400);
    }

    const { data: settings } = await admin.from("advance_settings").select("*").limit(1).maybeSingle();
    const fee = Number(settings?.confirmation_fee ?? 50);
    const deadlineMinutes = Number(settings?.payment_deadline_minutes ?? 30);
    const deadline = new Date(Date.now() + deadlineMinutes * 60_000).toISOString();

    const { error: updErr } = await admin.from("requests").update({
      status: "dp_reserved",
      reserved_dp_id: dpId,
      reserved_at: new Date().toISOString(),
      accepted_dp_id: dpId,
      payment_deadline: deadline,
    }).eq("id", requestId);
    if (updErr) return json({ success: false, error_msg: updErr.message }, 500);

    let roomId: string | null = null;
    const { data: existingRoom } = await admin.from("chat_rooms").select("id").eq("request_id", requestId).maybeSingle();
    if (existingRoom?.id) {
      roomId = existingRoom.id;
      await admin.from("chat_rooms").update({ dp_id: dpId }).eq("id", roomId);
    } else {
      const { data: created, error: roomErr } = await admin.from("chat_rooms").insert({
        request_id: requestId,
        user_id: reqRow.user_id,
        dp_id: dpId,
      }).select("id").single();
      if (roomErr || !created) return json({ success: false, error_msg: roomErr?.message || "Chat create failed" }, 500);
      roomId = created.id;
    }

    const { data: ap, error: apErr } = await admin.from("advance_payments").insert({
      request_id: requestId,
      chat_room_id: roomId,
      dp_id: dpId,
      customer_id: reqRow.user_id,
      amount: fee,
      payment_deadline: deadline,
      status: "waiting",
    }).select("id").maybeSingle();
    if (apErr) return json({ success: false, error_msg: apErr.message }, 500);

    if (ap?.id) {
      await admin.from("requests").update({ advance_payment_id: ap.id }).eq("id", requestId);
    }

    const { data: dpProfile } = await admin.from("profiles").select("full_name").eq("id", dpId).maybeSingle();
    const { data: userProfile } = await admin.from("profiles").select("full_name").eq("id", reqRow.user_id).maybeSingle();

    await admin.from("messages").insert({
      chat_room_id: roomId,
      sender_id: reqRow.user_id,
      message_type: "order_summary",
      quotation_data: {
        description: reqRow.description,
        delivery_address: reqRow.delivery_address,
        scheduled_date: reqRow.scheduled_date,
        scheduled_time: reqRow.scheduled_time,
        photo_urls: reqRow.photo_urls,
      },
    });

    await admin.from("messages").insert({
      chat_room_id: roomId,
      sender_id: dpId,
      message_type: "text",
      content: `Hi ${userProfile?.full_name || "there"}! I reserved your advance booking. Please pay ₹${fee} confirmation amount and upload proof in chat.`,
    });

    // Try typed payment card; ignore if CHECK still blocks advance_payment
    if (ap?.id) {
      const { error: typedErr } = await admin.from("messages").insert({
        chat_room_id: roomId,
        sender_id: dpId,
        message_type: "advance_payment",
        advance_payment_id: ap.id,
        quotation_data: {
          amount: fee,
          deadline,
          booking_id: requestId,
          scheduled_date: reqRow.scheduled_date,
          scheduled_time: reqRow.scheduled_slot || reqRow.scheduled_time,
          purpose: "Advance Booking Confirmation",
          status: "waiting",
        },
      });
      if (typedErr) {
        await admin.from("messages").insert({
          chat_room_id: roomId,
          sender_id: dpId,
          message_type: "text",
          content: `Advance confirmation payment requested: ₹${fee}. Please pay and upload proof.`,
        });
      }
    }

    await admin.from("notifications").insert({
      user_id: reqRow.user_id,
      title: "Delivery Partner Reserved!",
      body: `${dpProfile?.full_name || "A delivery partner"} reserved your advance booking. Pay confirmation amount in chat.`,
      type: "dp_reserved",
      related_id: requestId,
    });

    return json({
      success: true,
      chat_room_id: roomId,
      advance_payment_id: ap?.id || null,
    });
  } catch (e: any) {
    return json({ success: false, error_msg: e?.message || "Server error" }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
