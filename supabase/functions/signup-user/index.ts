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
    const { email, password, role, full_name, phone, pincode, address, vehicle_type, aadhaar_number, emergency_contact } = body;

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

    // Insert profile row
    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      role,
      full_name,
      phone: phone || null,
      address: address || null,
      ...(pincode ? { pincode } : {}),
    });

    if (profileError) {
      await supabase.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      if (dpError) {
        return new Response(JSON.stringify({ error: dpError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
