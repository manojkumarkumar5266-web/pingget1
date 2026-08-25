import { supabase } from './supabase'
import { kickPushDelivery } from './notify'

/**
 * Push + in-app notify every nearby online DP about a new request.
 * Dedupes per DP + request so scanning retries do not spam.
 * These rows are NOT shown in the Alerts tab (admin offers only).
 */
export async function notifyNearbyDpsForRequest(opts: {
  requestId: string
  lat: number | null | undefined
  lng: number | null | undefined
  radiusMeters: number
  body?: string
}): Promise<void> {
  const lat = Number(opts.lat)
  const lng = Number(opts.lng)
  if (!opts.requestId || !Number.isFinite(lat) || !Number.isFinite(lng)) return

  const { data, error } = await supabase.rpc('scan_nearby_dps', {
    p_user_lat: lat,
    p_user_lng: lng,
    p_radius_meters: opts.radiusMeters,
    p_request_id: opts.requestId,
  })
  if (error) {
    console.warn('[notifyNearbyDps] scan_nearby_dps', error.message)
    return
  }

  const ids = [...new Set(((data as { dp_user_id?: string }[]) || []).map(d => d.dp_user_id).filter(Boolean))] as string[]
  if (ids.length === 0) return

  const { data: existing } = await supabase
    .from('notifications')
    .select('user_id')
    .eq('related_id', opts.requestId)
    .eq('type', 'new_nearby_request')
    .in('user_id', ids)

  const have = new Set((existing || []).map((r: { user_id: string }) => r.user_id))
  const rows = ids.filter(id => !have.has(id)).map(id => ({
    user_id: id,
    title: 'New delivery request nearby',
    body: opts.body || 'A customer needs a partner nearby. Open the app to accept.',
    type: 'new_nearby_request',
    notification_type: 'new_nearby_request',
    related_id: opts.requestId,
    route: '/dp',
  }))
  if (rows.length === 0) return
  const { error: insErr } = await supabase.from('notifications').insert(rows)
  if (insErr) {
    console.warn('[notifyNearbyDps] insert', insErr.message)
    return
  }
  kickPushDelivery()
}
