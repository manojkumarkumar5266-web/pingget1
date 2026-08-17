import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return json({ error: "Server misconfigured: missing Supabase credentials" }, 500);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const {
      email, password, role, full_name, phone, pincode, city,
      vehicle_type, aadhaar_number, emergency_contact,
    } = body as Record<string, any>;

    if (!email || !password || !full_name || !role) {
      return json({ error: "email, password, full_name and role are required" }, 400);
    }
    if (role !== "user" && role !== "dp") {
      return json({ error: "role must be 'user' or 'dp'" }, 400);
    }
    if (typeof password !== "string" || password.length < 8) {
      return json({ error: "Password must be at least 8 characters" }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const normalizedEmail = String(email).trim().toLowerCase();

    // Create auth user with email pre-confirmed
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name, role },
    });

    if (createError) {
      const msg = createError.message || "Failed to create auth user";
      const lower = msg.toLowerCase();
      if (lower.includes("already") || lower.includes("registered") || lower.includes("exists")) {
        return json({ error: "An account with this email already exists. Please sign in instead." }, 409);
      }
      return json({ error: msg }, 400);
    }

    const userId = userData.user?.id;
    if (!userId) {
      return json({ error: "Auth user created but no id returned" }, 500);
    }

    const profileRow: Record<string, any> = {
      id: userId,
      role,
      full_name: String(full_name).trim(),
      email: normalizedEmail,
      phone: phone || null,
      status: role === "dp" ? "pending" : "active",
    };
    if (pincode) profileRow.pincode = String(pincode);
    if (city) profileRow.city = String(city);

    // Upsert so a partial auth-hook profile (if any) does not block signup
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(profileRow, { onConflict: "id" });

    if (profileError) {
      // Rollback auth user so the email can be retried cleanly
      await supabase.auth.admin.deleteUser(userId).catch(() => {});
      return json({ error: profileError.message || "Failed to create profile" }, 400);
    }

    // Best-effort admin notification (never fail signup if this fails)
    if (role === "user") {
      await supabase.from("admin_notifications").insert({
        type: "new_user",
        title: "New User Registered",
        body: `${profileRow.full_name} just signed up`,
        related_id: userId,
        is_read: false,
      }).then(() => {}, () => {});
    }

    if (role === "dp") {
      const dpRecord: Record<string, any> = {
        user_id: userId,
        status: "pending",
      };
      if (vehicle_type) dpRecord.vehicle_type = vehicle_type;
      if (aadhaar_number) dpRecord.aadhaar_number = aadhaar_number;
      if (emergency_contact) dpRecord.emergency_contact = emergency_contact;

      const { data: existingDp } = await supabase
        .from("delivery_partners")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      let dpError = null as { message?: string } | null;
      if (existingDp?.id) {
        const { error } = await supabase.from("delivery_partners").update(dpRecord).eq("user_id", userId);
        dpError = error;
      } else {
        const { error } = await supabase.from("delivery_partners").insert(dpRecord);
        dpError = error;
      }

      if (dpError && !String(dpError.message || "").toLowerCase().includes("duplicate")) {
        await supabase.auth.admin.deleteUser(userId).catch(() => {});
        await supabase.from("profiles").delete().eq("id", userId).catch(() => {});
        return json({ error: dpError.message || "Failed to create delivery partner record" }, 400);
      }

      await supabase.from("admin_notifications").insert({
        type: "new_dp",
        title: "New DP Application",
        body: "A new delivery partner applied for approval",
        related_id: userId,
        is_read: false,
      }).then(() => {}, () => {});
    }

    return json({ user_id: userId, success: true });
  } catch (err: any) {
    return json({ error: err?.message || "Internal server error" }, 500);
  }
});
