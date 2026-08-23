import { supabase } from './supabase'

/** Notify nearby **online** partners so they get sound/popup in background via FCM. Offline DPs are skipped. */
export async function notifyNearbyOnlineDps(opts: {
  requestId: string
  lat: number | null | undefined
  lng: number | null | undefined
  radiusMeters: number
  title?: string
  body?: string
}) {
  const lat = opts.lat
  const lng = opts.lng
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return
  const radius = Math.max(1000, Math.min(20000, Math.round(opts.radiusMeters || 5000)))
  const { data, error } = await supabase.rpc('scan_nearby_dps', {
    p_user_lat: lat,
    p_user_lng: lng,
    p_radius_meters: radius,
    p_request_id: opts.requestId,
  })
  if (error || !data) return
  const seen = new Set<string>()
  for (const row of data as Array<{ dp_user_id?: string; user_id?: string; is_online?: boolean }>) {
    const uid = row.dp_user_id || row.user_id
    if (!uid || seen.has(uid)) continue
    if (row.is_online === false) continue
    seen.add(uid)
    await notifyUser({
      userId: uid,
      title: opts.title || 'New order nearby',
      body: opts.body || 'A customer needs a delivery near you. Open the app to accept.',
      type: 'new_nearby_request',
      relatedId: opts.requestId,
      route: '/dp',
      notificationType: 'new_nearby_request',
    })
  }
}

/**
 * Kick FCM delivery for a notification (or drain pending outbox).
 * Safe to fire-and-forget after any notifications insert.
 */
export function kickPushDelivery(notificationId?: string) {
  const body = notificationId
    ? { notificationId }
    : { processOutbox: true, limit: 40 }
  void supabase.functions.invoke('dispatch-push', { body }).catch(() => {})
}

/** Insert in-app notification and enqueue mobile push. */
export async function notifyUser(input: {
  userId: string
  title: string
  body: string
  type: string
  relatedId?: string | null
  imageUrl?: string | null
  route?: string | null
  notificationType?: string | null
}) {
  const { data, error } = await supabase.from('notifications').insert({
    user_id: input.userId,
    title: input.title,
    body: input.body,
    type: input.type,
    notification_type: input.notificationType || input.type,
    related_id: input.relatedId || null,
    image_url: input.imageUrl || null,
    route: input.route || null,
  }).select('id').single()

  if (!error && data?.id) kickPushDelivery(data.id)
  else kickPushDelivery()
  return { data, error }
}
