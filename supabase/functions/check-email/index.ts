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
    const { email } = await req.json()
    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ exists: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const normalizedEmail = email.toLowerCase().trim()

    // Search auth.users by email directly — works regardless of user count
    const { data: { users }, error } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })
    if (error) throw error

    let match = users.find((u) => u.email?.toLowerCase() === normalizedEmail)

    // If not found in first page, paginate up to 20 pages
    if (!match) {
      for (let page = 2; page <= 20; page++) {
        const { data: pageData, error: pageError } = await adminClient.auth.admin.listUsers({
          page,
          perPage: 1000,
        })
        if (pageError) break
        if (!pageData.users || pageData.users.length === 0) break
        const found = pageData.users.find((u) => u.email?.toLowerCase() === normalizedEmail)
        if (found) { match = found; break }
      }
    }

    // Also check profiles table as a fallback source of truth
    if (!match) {
      const { data: profileRow } = await adminClient
        .from("profiles")
        .select("id")
        .eq("email", normalizedEmail)
        .maybeSingle()
      if (profileRow) {
        return new Response(JSON.stringify({ exists: true, user_id: profileRow.id, providers: [] }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
    }

    const exists = !!match
    const userId = match?.id || null
    const providers = match?.app_metadata?.providers || []

    return new Response(JSON.stringify({ exists, user_id: userId, providers }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ exists: false, error: String(err) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
