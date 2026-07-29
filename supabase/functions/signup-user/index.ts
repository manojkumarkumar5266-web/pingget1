import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

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
    const body = await req.json();
    const {
      email, password, role, full_name, phone, pincode, city,
      vehicle_type, aadhaar_number, emergency_contact,
    } = body;

    if (!email || !password || !full_name || !role) {
      return new Response(JSON.stringify({ error: "email, password, full_name and role are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Create user with email pre-confirmed — no verification email needed
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    // Insert profile row (service role bypasses RLS)
    const profileRow: Record<string, any> = {
      id: userId,
      role,
      full_name,
      email,
      phone: phone || null,
      status: role === "dp" ? "pending" : "active",
    };
    if (pincode) profileRow.pincode = pincode;
    if (city) profileRow.city = city;

    // Insert the profile row (service role bypasses RLS). A broken AFTER
    // INSERT trigger (notify_admin_new_user) used to roll this back for
    // role='user' because admin_notifications had no INSERT policy. The
    // service role bypasses RLS, so the trigger insert now succeeds; we also
    // notify the admin directly below as the authoritative path.
    const { error: profileError } = await supabase.from("profiles").insert(profileRow);

    if (profileError) {
      await supabase.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Notify the admin directly (service role bypasses RLS on admin_notifications).
    if (role === "user") {
      await supabase.from("admin_notifications").insert({
        type: "new_user",
        title: "New User Registered",
        body: `${full_name} just signed up`,
        related_id: userId,
      }).then(() => {}, () => {});
    }

    // Create delivery_partner record for dp role
    if (role === "dp") {
      const dpRecord: Record<string, any> = {
        user_id: userId,
        status: "pending",
      };
      if (vehicle_type) dpRecord.vehicle_type = vehicle_type;
      if (aadhaar_number) dpRecord.aadhaar_number = aadhaar_number;
      if (emergency_contact) dpRecord.emergency_contact = emergency_contact;

      const { error: dpError } = await supabase.from("delivery_partners").insert(dpRecord);
      if (dpError && !dpError.message.includes("duplicate")) {
        await supabase.auth.admin.deleteUser(userId);
        return new Response(JSON.stringify({ error: dpError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Notify the admin about the new DP application (service role bypasses RLS).
      await supabase.from("admin_notifications").insert({
        type: "new_dp",
        title: "New DP Application",
        body: "A new delivery partner applied for approval",
        related_id: userId,
      }).then(() => {}, () => {});
    }

    return new Response(JSON.stringify({ user_id: userId, success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
