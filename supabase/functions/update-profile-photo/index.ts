import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

/**
 * Save profile photo_url with service role to bypass recursive profiles RLS.
 * Client uploads the file to storage first, then calls this with the public URL.
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
      return json({ success: false, error: "Not authenticated" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const photoUrl = (body.photo_url as string | undefined)?.trim();
    if (!photoUrl) return json({ success: false, error: "photo_url required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error } = await admin
      .from("profiles")
      .update({ photo_url: photoUrl })
      .eq("id", userData.user.id);

    if (error) return json({ success: false, error: error.message }, 500);
    return json({ success: true, photo_url: photoUrl });
  } catch (e: any) {
    return json({ success: false, error: e?.message || "Server error" }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
