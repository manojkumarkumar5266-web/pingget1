import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import IncomingRequestPopup from '../components/IncomingRequestPopup'
import { haversineDistance } from '../lib/utils'
import { playRequestAlert, REQUEST_ALERT_DURATION_MS, stopRequestAlertSound } from '../lib/requestAlertSound'
import {
  acceptNearbyRequest,
  declineNearbyRequest,
  type NearbyRequest,
} from '../lib/dpNearbyRespond'
import { supabase, type DeliveryPartner, type DeliveryRequest, type Profile } from '../lib/supabase'

export const DP_NEARBY_REFRESH_EVENT = 'dp-nearby-refresh'

function requestDistance(
  req: NearbyRequest,
  gps: { lat: number | null; lng: number | null },
  profileGps: { lat?: number | null; lng?: number | null },
): number | null {
  const rpcDist = Number(req.distance_meters)
  if (Number.isFinite(rpcDist) && rpcDist >= 0) return rpcDist
  const lat = gps.lat ?? profileGps.lat ?? null
  const lng = gps.lng ?? profileGps.lng ?? null
  const userLat = req.delivery_lat ?? req.pickup_lat ?? req.user_profile?.gps_lat
  const userLng = req.delivery_lng ?? req.pickup_lng ?? req.user_profile?.gps_lng
  if (!lat || !lng || !userLat || !userLng) return null
  return haversineDistance(lat, lng, userLat, userLng)
}

/**
 * Incoming order popup + 60s ring for online DPs on every in-app screen.
 * Offline partners are skipped. Background / closed apps use FCM via notifyNearbyOnlineDps.
 */
export function useDpIncomingAlerts(
  dp: DeliveryPartner | null,
  profileId: string | undefined,
  gps: { lat: number | null; lng: number | null },
  profileGps: { lat?: number | null; lng?: number | null },
) {
  const navigate = useNavigate()
  const [incoming, setIncoming] = useState<NearbyRequest | null>(null)
  const [reservingId, setReservingId] = useState<string | null>(null)
  const knownIdsRef = useRef<Set<string>>(new Set())
  const stopAlertRef = useRef<(() => void) | null>(null)

  const stopRing = () => {
    try { stopAlertRef.current?.() } catch { /* ignore */ }
    stopAlertRef.current = null
    try { stopRequestAlertSound() } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!profileId || !dp?.is_online) {
      stopRing()
      knownIdsRef.current = new Set()
      setIncoming(null)
      return
    }

    const fetchRequests = async () => {
      const { data, error } = await supabase.rpc('get_nearby_requests', { p_dp_user_id: profileId })
      if (error || !data) return
      const ids = data.map((r: { id?: string }) => r.id).filter(Boolean) as string[]
      let metaById = new Map<string, Partial<DeliveryRequest>>()
      if (ids.length > 0) {
        const { data: metas } = await supabase
          .from('requests')
          .select('id, status, order_type, is_scheduled, scheduled_date, scheduled_time, scheduled_slot, scheduled_timestamp, request_category, radius_meters, recurring_type')
          .in('id', ids)
        metas?.forEach((m: { id: string }) => metaById.set(m.id, m as Partial<DeliveryRequest>))
      }
      const userIds = [...new Set(data.map((r: { user_id: string }) => r.user_id))]
      let profileMap = new Map<string, Profile>()
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('*').in('id', userIds)
        profiles?.forEach((p: Profile) => profileMap.set(p.id, p))
      }
      const next = (data as DeliveryRequest[]).map(r => {
        const meta = metaById.get(r.id) || {}
        return {
          ...r,
          ...meta,
          order_type: (meta as DeliveryRequest).order_type || r.order_type || 'instant',
          status: (meta as DeliveryRequest).status || r.status,
          user_profile: profileMap.get(r.user_id),
        } as NearbyRequest
      })
      const firstOnlineFetch = knownIdsRef.current.size === 0
      const fresh = firstOnlineFetch ? next : next.filter(r => !knownIdsRef.current.has(r.id))
      knownIdsRef.current = new Set(next.map(r => r.id))
      if (fresh.length > 0) {
        const newest = fresh[0]
        stopRing()
        stopAlertRef.current = playRequestAlert(REQUEST_ALERT_DURATION_MS)
        setIncoming(newest)
      }
      setIncoming(cur => (cur && !next.some(r => r.id === cur.id) ? null : cur))
    }

    void fetchRequests()
    const channel = supabase.channel(`dp-incoming-alerts-${profileId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => { void fetchRequests() })
      .subscribe()
    const poll = setInterval(() => { void fetchRequests() }, 5000)
    const onRefresh = () => { void fetchRequests() }
    const onVis = () => { if (document.visibilityState === 'visible') void fetchRequests() }
    window.addEventListener(DP_NEARBY_REFRESH_EVENT, onRefresh)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      stopRing()
      supabase.removeChannel(channel)
      clearInterval(poll)
      window.removeEventListener(DP_NEARBY_REFRESH_EVENT, onRefresh)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [dp?.is_online, profileId])

  const onDecline = async () => {
    if (!incoming || !profileId) return
    stopRing()
    const id = incoming.id
    setIncoming(null)
    const { error } = await declineNearbyRequest(profileId, incoming)
    if (error) console.error('[dp] decline failed:', error.message)
    knownIdsRef.current.add(id)
  }

  const onAccept = async () => {
    if (!incoming || !profileId || reservingId) return
    stopRing()
    setReservingId(incoming.id)
    try {
      const result = await acceptNearbyRequest(profileId, incoming)
      if (result.success) {
        setIncoming(null)
        if (result.chatRoomId) navigate(`/dp/chat/${result.chatRoomId}`, { replace: true })
        else navigate('/dp/orders', { replace: true })
        return
      }
      window.alert(result.error || 'Failed to accept request')
    } finally {
      setReservingId(null)
    }
  }

  const popup = incoming && dp?.is_online ? (
    <IncomingRequestPopup
      req={incoming}
      distanceM={requestDistance(incoming, gps, profileGps)}
      accepting={reservingId === incoming.id}
      onAccept={() => { void onAccept() }}
      onDecline={() => { void onDecline() }}
    />
  ) : null

  return { popup, incoming }
}
