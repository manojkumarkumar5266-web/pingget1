/**
 * FCM helpers for Supabase Edge Functions.
 * Secrets (any one works):
 * - FCM_SERVER_KEY / FIREBASE_SERVER_KEY  (legacy HTTP API)
 * - FCM_SERVICE_ACCOUNT_JSON / FIREBASE_SERVICE_ACCOUNT_JSON (HTTP v1)
 */

export type PushPayload = {
  title: string
  body: string
  imageUrl?: string | null
  route?: string | null
  entityId?: string | null
  notificationType?: string | null
  notificationId?: string | null
}

function dataFields(p: PushPayload): Record<string, string> {
  const d: Record<string, string> = {
    title: p.title,
    body: p.body,
    notificationType: p.notificationType || "admin_announcement",
    notification_type: p.notificationType || "admin_announcement",
    type: p.notificationType || "admin_announcement",
    createdAt: new Date().toISOString(),
  }
  if (p.imageUrl) {
    d.image = p.imageUrl
    d.imageUrl = p.imageUrl
  }
  if (p.route) d.route = p.route
  if (p.entityId) {
    d.entityId = p.entityId
    d.entity_id = p.entityId
  }
  if (p.notificationId) d.notificationId = p.notificationId
  return d
}

async function sendLegacy(token: string, p: PushPayload, serverKey: string) {
  const res = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      Authorization: `key=${serverKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: token,
      priority: "high",
      notification: {
        title: p.title,
        body: p.body,
        sound: "default",
        image: p.imageUrl || undefined,
      },
      data: dataFields(p),
      android: { priority: "high" },
    }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`FCM legacy ${res.status}: ${text}`)
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

let cachedAccess: { token: string; projectId: string; expiresAt: number } | null = null

async function getV1Access(serviceJson: string): Promise<{ token: string; projectId: string }> {
  if (cachedAccess && cachedAccess.expiresAt > Date.now() + 60_000) {
    return { token: cachedAccess.token, projectId: cachedAccess.projectId }
  }
  const sa = JSON.parse(serviceJson)
  const now = Math.floor(Date.now() / 1000)
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    .replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_")
  const claim = btoa(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_")

  const unsigned = `${header}.${claim}`
  const keyPem = String(sa.private_key || "").replace(/\\n/g, "\n")
  const pemBody = keyPem.replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "")
  const binary = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binary.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sigBuf = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsigned),
  )
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
    .replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_")
  const jwt = `${unsigned}.${sig}`

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  })
  const tokenJson = await tokenRes.json()
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(`OAuth token failed: ${JSON.stringify(tokenJson)}`)
  }
  cachedAccess = {
    token: tokenJson.access_token,
    projectId: sa.project_id,
    expiresAt: Date.now() + ((tokenJson.expires_in || 3600) * 1000),
  }
  return { token: cachedAccess.token, projectId: cachedAccess.projectId }
}

async function sendV1(token: string, p: PushPayload, serviceJson: string) {
  const { token: accessToken, projectId } = await getV1Access(serviceJson)
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: {
            title: p.title,
            body: p.body,
            image: p.imageUrl || undefined,
          },
          data: dataFields(p),
          android: {
            priority: "HIGH",
            notification: {
              channel_id: p.notificationType === "admin_announcement" || p.notificationType === "admin_offer"
                ? "announcements"
                : "orders",
              sound: "default",
              image: p.imageUrl || undefined,
            },
          },
          apns: {
            payload: {
              aps: {
                sound: "default",
                "mutable-content": 1,
              },
            },
            fcm_options: p.imageUrl ? { image: p.imageUrl } : undefined,
          },
        },
      }),
    },
  )
  const text = await res.text()
  if (!res.ok) throw new Error(`FCM v1 ${res.status}: ${text}`)
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

export function fcmConfigured(): boolean {
  return !!(
    Deno.env.get("FCM_SERVER_KEY") ||
    Deno.env.get("FIREBASE_SERVER_KEY") ||
    Deno.env.get("FCM_SERVICE_ACCOUNT_JSON") ||
    Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON")
  )
}

export async function sendFcmToToken(token: string, payload: PushPayload) {
  const legacy = Deno.env.get("FCM_SERVER_KEY") || Deno.env.get("FIREBASE_SERVER_KEY")
  const serviceJson =
    Deno.env.get("FCM_SERVICE_ACCOUNT_JSON") ||
    Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON")

  if (serviceJson) return await sendV1(token, payload, serviceJson)
  if (legacy) return await sendLegacy(token, payload, legacy)
  throw new Error("FCM not configured — set FCM_SERVER_KEY or FCM_SERVICE_ACCOUNT_JSON")
}

export async function sendFcmToUserIds(
  admin: any,
  userIds: string[],
  payload: PushPayload,
): Promise<{ sent: number; failed: number; skipped: boolean }> {
  if (!userIds.length) return { sent: 0, failed: 0, skipped: false }
  if (!fcmConfigured()) return { sent: 0, failed: 0, skipped: true }

  const { data: tokens } = await admin
    .from("device_tokens")
    .select("id, token, user_id")
    .in("user_id", userIds)
    .eq("is_active", true)

  let sent = 0
  let failed = 0
  for (const row of tokens || []) {
    try {
      const result = await sendFcmToToken(row.token, payload)
      sent++
      try {
        await admin.from("notification_delivery_logs").insert({
          notification_id: payload.notificationId || null,
          device_token_id: row.id,
          token: row.token,
          status: "sent",
          fcm_message_id: result?.name || result?.message_id || null,
        })
      } catch (_) { /* ignore log failures */ }
    } catch (err: any) {
      failed++
      try {
        await admin.from("notification_delivery_logs").insert({
          notification_id: payload.notificationId || null,
          device_token_id: row.id,
          token: row.token,
          status: "failed",
          error_message: String(err?.message || err).slice(0, 500),
        })
      } catch (_) { /* ignore */ }
      const msg = String(err?.message || "")
      if (msg.includes("NotRegistered") || msg.includes("UNREGISTERED") || msg.includes("InvalidRegistration")) {
        await admin.from("device_tokens").update({ is_active: false }).eq("id", row.id)
      }
    }
  }
  return { sent, failed, skipped: false }
}
