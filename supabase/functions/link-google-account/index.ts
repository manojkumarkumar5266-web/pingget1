import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const { user_id, email, role, mode } = await req.json()

    if (!user_id || !email) {
      return new Response(
        JSON.stringify({ error: "user_id and email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // 1. Check if a profile already exists for this Google user ID
    const { data: existingById } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user_id)
      .maybeSingle()

    if (existingById) {
      return new Response(
        JSON.stringify({ success: true, profile: existingById, action: "existing" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 2. Look up profile by email (user signed up with email/password first)
    const { data: existingByEmail } = await supabase
      .from("profiles")
      .select("*")
      .ilike("email", email)
      .maybeSingle()

    if (existingByEmail) {
      const oldUserId = existingByEmail.id

      // Update the profile ID to the Google user's ID
      const { data: updatedProfile, error: profileError } = await supabase
        .from("profiles")
        .update({ id: user_id })
        .eq("id", oldUserId)
        .select()
        .single()

      if (profileError) {
        return new Response(
          JSON.stringify({ error: "Failed to link profile: " + profileError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      // Update delivery_partners.user_id if the user is a DP
      await supabase.from("delivery_partners").update({ user_id }).eq("user_id", oldUserId)

      // Update requests.user_id
      await supabase.from("requests").update({ user_id }).eq("user_id", oldUserId)

      // Update notifications.user_id
      await supabase.from("notifications").update({ user_id }).eq("user_id", oldUserId)

      // Update chat_rooms.user_id and dp_id
      await supabase.from("chat_rooms").update({ user_id }).eq("user_id", oldUserId)
      await supabase.from("chat_rooms").update({ dp_id: user_id }).eq("dp_id", oldUserId)

      // Update messages.sender_id
      await supabase.from("messages").update({ sender_id: user_id }).eq("sender_id", oldUserId)

      // Update wallets.dp_user_id if DP
      await supabase.from("wallets").update({ dp_user_id: user_id }).eq("dp_user_id", oldUserId)

      // Update ratings
      await supabase.from("ratings").update({ user_id }).eq("user_id", oldUserId)
      await supabase.from("ratings").update({ dp_id: user_id }).eq("dp_id", oldUserId)

      // Update quotations
      await supabase.from("quotations").update({ dp_id: user_id }).eq("dp_id", oldUserId)

      return new Response(
        JSON.stringify({ success: true, profile: updatedProfile, action: "linked" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 3. No existing profile by ID or email — create a new one (signup mode)
    if (mode === "signup" && role) {
      const profileRow: Record<string, any> = {
        id: user_id,
        role,
        full_name: "",
        status: role === "dp" ? "pending" : "active",
      }

      const { data: newProfile, error: createError } = await supabase
        .from("profiles")
        .insert(profileRow)
        .select()
        .single()

      if (createError) {
        return new Response(
          JSON.stringify({ error: createError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      if (role === "dp") {
        await supabase.from("delivery_partners").insert({ user_id, status: "pending" })
      }

      return new Response(
        JSON.stringify({ success: true, profile: newProfile, action: "created" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 4. No profile found and not signup mode — user must sign up first
    return new Response(
      JSON.stringify({
        error: `No account found for "${email}". Please sign up first, then sign in with Google.`,
      }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
