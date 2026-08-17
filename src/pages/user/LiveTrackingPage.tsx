import { useEffect, useMemo, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, type DeliveryRequest, type Profile, type DeliveryPartner } from '../../lib/supabase'
import { kickPushDelivery } from '../../lib/notify'
import { useAuth } from '../../context'
import { STATUS_LABELS } from '../../lib/utils'
import VisualTracking, { STATUS_PROGRESS, STATUS_ETA } from '../../components/VisualTracking'
import FreeStreetMap, { MAP_VIEW_RADIUS_M, type MapMarker } from '../../components/map/FreeStreetMap'
import { Images } from '../../lib/customImages'
import { fetchRoute, formatETA, type LatLng } from '../../lib/mapUtils'
import { ArrowLeft, Phone, MessageCircle, Star, Clock, Bike, PackageCheck, MapPin, Car, Truck, Pencil } from 'lucide-react'
import { InteractiveStarRating } from '../../components/ui'
import { pg } from '../../design/tokens'
import { CTA, Surface, MobileFrame } from '../../design/primitives'
import NeedHelpCard from '../../components/NeedHelpCard'
import AddressPicker, { formatAddress, type SavedAddress } from '../../components/AddressPicker'
import { openRequestChatRoom } from '../../lib/openRequestChat'

function vehicleIcon(v: string | null | undefined) {
  const s = (v || '').toLowerCase()
  if (s === 'bicycle' || s === 'motorbike' || s === 'scooter' || s === 'auto') return Bike
  if (s === 'car') return Car
  return Truck
}

type PayPhase = 'idle' | 'awaiting_user_payment' | 'awaiting_dp_accept' | 'payment_accepted' | 'rating' | 'thanks'

const LIVE_STATUSES = new Set(['on_the_way', 'arrived'])

export default function LiveTrackingPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [request, setRequest] = useState<DeliveryRequest | null>(null)
  const [dpProfile, setDpProfile] = useState<Profile | null>(null)
  const [dpData, setDpData] = useState<DeliveryPartner | null>(null)
  const [dpLive, setDpLive] = useState<LatLng | null>(null)
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([])
  const [liveEtaLabel, setLiveEtaLabel] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [payPhase, setPayPhase] = useState<PayPhase>('idle')
  const [ratingStars, setRatingStars] = useState(0)
  const [ratingFeedback, setRatingFeedback] = useState('')
  const [ratingSubmitting, setRatingSubmitting] = useState(false)
  const [changingAddress, setChangingAddress] = useState(false)
  const lastEtaWrite = useRef(0)

  useEffect(() => {
    if (!requestId) return
    const fetchData = async () => {
      const { data: req } = await supabase.from('requests').select('*').eq('id', requestId).maybeSingle()
      if (!req) { setLoading(false); return }
      setRequest(req as DeliveryRequest)
      if (req.payment_accepted_at) {
        setPayPhase('rating')
      } else if (req.payment_completed_at || req.status === 'cash_received') {
        setPayPhase('awaiting_dp_accept')
      } else if (req.status === 'completed') {
        setPayPhase('awaiting_user_payment')
      }
      if (req.accepted_dp_id) {
        const [dpProf, dp, stats] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', req.accepted_dp_id).maybeSingle(),
          supabase.from('delivery_partners').select('*').eq('user_id', req.accepted_dp_id).maybeSingle(),
          supabase.rpc('get_dp_public_stats', { p_dp_user_id: req.accepted_dp_id }),
        ])
        setDpProfile(dpProf.data as Profile | null)
        const pub = (stats.data || {}) as { rating_avg?: number; rating_count?: number; vehicle_type?: string }
        const merged = {
          ...((dp.data as DeliveryPartner | null) || { user_id: req.accepted_dp_id } as DeliveryPartner),
          rating_avg: Number(pub.rating_avg ?? (dp.data as any)?.rating_avg ?? 0),
          rating_count: Number(pub.rating_count ?? (dp.data as any)?.rating_count ?? 0),
          vehicle_type: (pub.vehicle_type || (dp.data as any)?.vehicle_type || 'bike') as string,
        } as DeliveryPartner
        setDpData(merged)
        const p = dpProf.data as Profile | null
        const d = merged
        const lat = (req as any).dp_lat ?? d?.current_lat ?? p?.gps_lat
        const lng = (req as any).dp_lng ?? d?.current_lng ?? p?.gps_lng
        if (lat != null && lng != null) setDpLive({ lat: Number(lat), lng: Number(lng) })
      }
      setLoading(false)
    }
    fetchData()

    const channel = supabase
      .channel(`tracking-${requestId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests', filter: `id=eq.${requestId}` },
        async (payload: any) => {
          const next = payload.new as DeliveryRequest
          setRequest(next)
          if (next.payment_accepted_at) {
            setPayPhase(prev => (prev === 'rating' || prev === 'thanks' ? prev : 'payment_accepted'))
          } else if (next.payment_completed_at || next.status === 'cash_received') {
            setPayPhase(prev => (prev === 'payment_accepted' || prev === 'rating' || prev === 'thanks' ? prev : 'awaiting_dp_accept'))
          }
          const lat = (next as any).dp_lat
          const lng = (next as any).dp_lng
          if (lat != null && lng != null) setDpLive({ lat: Number(lat), lng: Number(lng) })
          if (payload.new.accepted_dp_id && !dpProfile) {
            const dpId = payload.new.accepted_dp_id
            const [dpProf, dp, stats] = await Promise.all([
              supabase.from('profiles').select('*').eq('id', dpId).maybeSingle(),
              supabase.from('delivery_partners').select('*').eq('user_id', dpId).maybeSingle(),
              supabase.rpc('get_dp_public_stats', { p_dp_user_id: dpId }),
            ])
            setDpProfile(dpProf.data as Profile | null)
            const pub = (stats.data || {}) as { rating_avg?: number; rating_count?: number; vehicle_type?: string }
            setDpData({
              ...((dp.data as DeliveryPartner | null) || { user_id: dpId } as DeliveryPartner),
              rating_avg: Number(pub.rating_avg ?? (dp.data as any)?.rating_avg ?? 0),
              rating_count: Number(pub.rating_count ?? (dp.data as any)?.rating_count ?? 0),
              vehicle_type: (pub.vehicle_type || (dp.data as any)?.vehicle_type || 'bike') as string,
            } as DeliveryPartner)
          }
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [requestId])

  // Poll DP GPS from profiles / delivery_partners for live bike
  useEffect(() => {
    const dpId = request?.accepted_dp_id
    if (!dpId || !request || !LIVE_STATUSES.has(request.status)) return

    const pull = async () => {
      const [prof, dp, stats] = await Promise.all([
        supabase.from('profiles').select('gps_lat,gps_lng,photo_url,full_name,phone').eq('id', dpId).maybeSingle(),
        supabase.from('delivery_partners').select('current_lat,current_lng,vehicle_type,rating_avg,rating_count').eq('user_id', dpId).maybeSingle(),
        supabase.rpc('get_dp_public_stats', { p_dp_user_id: dpId }),
      ])
      if (prof.data) {
        setDpProfile(prev => ({ ...(prev || {}), ...prof.data } as Profile))
      }
      const pub = (stats.data || {}) as { rating_avg?: number; rating_count?: number; vehicle_type?: string }
      setDpData(prev => ({
        ...(prev || {}),
        ...(dp.data || {}),
        rating_avg: Number(pub.rating_avg ?? (dp.data as any)?.rating_avg ?? prev?.rating_avg ?? 0),
        rating_count: Number(pub.rating_count ?? (dp.data as any)?.rating_count ?? prev?.rating_count ?? 0),
        vehicle_type: (pub.vehicle_type || (dp.data as any)?.vehicle_type || prev?.vehicle_type || 'bike') as string,
        current_lat: (dp.data as any)?.current_lat ?? prev?.current_lat,
        current_lng: (dp.data as any)?.current_lng ?? prev?.current_lng,
      } as DeliveryPartner))
      const lat = (dp.data as any)?.current_lat ?? prof.data?.gps_lat ?? (request as any).dp_lat
      const lng = (dp.data as any)?.current_lng ?? prof.data?.gps_lng ?? (request as any).dp_lng
      if (lat != null && lng != null) setDpLive({ lat: Number(lat), lng: Number(lng) })
    }
    pull()
    const id = window.setInterval(pull, 4000)
    return () => window.clearInterval(id)
  }, [request?.accepted_dp_id, request?.status])

  const userPos: LatLng | null = useMemo(() => {
    if (!request) return null
    if (request.delivery_lat != null && request.delivery_lng != null) {
      return { lat: Number(request.delivery_lat), lng: Number(request.delivery_lng) }
    }
    if (profile?.gps_lat != null && profile?.gps_lng != null) {
      return { lat: Number(profile.gps_lat), lng: Number(profile.gps_lng) }
    }
    return null
  }, [request, profile?.gps_lat, profile?.gps_lng])

  const mapMarkers: MapMarker[] = useMemo(() => {
    const list: MapMarker[] = []
    if (userPos) list.push({ id: 'user', position: userPos, kind: 'user' })
    if (dpLive) list.push({
      id: 'dp',
      position: dpLive,
      kind: 'bike',
      label: dpProfile?.full_name?.split(' ')[0],
      vehicleType: dpData?.vehicle_type,
    })
    return list
  }, [userPos, dpLive, dpProfile?.full_name, dpData?.vehicle_type])

  const mapCenter = useMemo(() => {
    if (dpLive && userPos) {
      return { lat: (dpLive.lat + userPos.lat) / 2, lng: (dpLive.lng + userPos.lng) / 2 }
    }
    return dpLive || userPos
  }, [dpLive, userPos])

  // Live route + ETA from DP → user
  useEffect(() => {
    if (!request || !LIVE_STATUSES.has(request.status) || !dpLive || !userPos) return
    let cancelled = false
    const run = async () => {
      const route = await fetchRoute(dpLive, userPos, 'driving')
      if (cancelled || !route) {
        const R = 6371000
        const dLat = ((userPos.lat - dpLive.lat) * Math.PI) / 180
        const dLng = ((userPos.lng - dpLive.lng) * Math.PI) / 180
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((dpLive.lat * Math.PI) / 180) *
            Math.cos((userPos.lat * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2
        const meters = 2 * R * Math.asin(Math.sqrt(a))
        const seconds = (meters / 1000 / 22) * 3600
        setRouteCoords([dpLive, userPos])
        setLiveEtaLabel(formatETA(seconds))
        return
      }
      setRouteCoords(route.coordinates.map(([lat, lng]) => ({ lat, lng })))
      setLiveEtaLabel(formatETA(route.duration_seconds))
      const mins = Math.max(1, Math.round(route.duration_seconds / 60))
      if (Date.now() - lastEtaWrite.current > 20000 && requestId) {
        lastEtaWrite.current = Date.now()
        await supabase.from('requests').update({ eta_minutes: mins } as any).eq('id', requestId)
      }
    }
    run()
    const id = window.setInterval(run, 12000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [dpLive?.lat, dpLive?.lng, userPos?.lat, userPos?.lng, request?.status, requestId])

  // Poll so payment-accepted from DP is never missed
  useEffect(() => {
    if (!requestId) return
    if (payPhase === 'rating' || payPhase === 'thanks' || payPhase === 'payment_accepted') return
    const id = window.setInterval(async () => {
      const { data } = await supabase
        .from('requests')
        .select('payment_completed_at,payment_accepted_at,status')
        .eq('id', requestId)
        .maybeSingle()
      if (!data) return
      setRequest(prev => (prev ? ({ ...prev, ...data } as DeliveryRequest) : prev))
      if (data.payment_accepted_at) {
        setPayPhase(prev => (prev === 'rating' || prev === 'thanks' ? prev : 'payment_accepted'))
      } else if (data.payment_completed_at || data.status === 'cash_received') {
        setPayPhase(prev => (
          prev === 'payment_accepted' || prev === 'rating' || prev === 'thanks' ? prev : 'awaiting_dp_accept'
        ))
      }
    }, 3000)
    return () => window.clearInterval(id)
  }, [requestId, payPhase])

  // After DP accepts payment → show payment-accepted image, then rating
  useEffect(() => {
    if (payPhase !== 'payment_accepted') return
    const t = window.setTimeout(() => setPayPhase('rating'), 2200)
    return () => window.clearTimeout(t)
  }, [payPhase])

  const confirmDelivery = async () => {
    const now = new Date().toISOString()
    // Prefer status update; delivery_accepted_at is optional on older DBs
    const { error } = await supabase.from('requests').update({
      status: 'completed',
      delivery_accepted_at: now,
    }).eq('id', requestId)
    if (error) {
      await supabase.from('requests').update({ status: 'completed' }).eq('id', requestId)
    }
    await supabase.from('orders').update({ status: 'completed', completed_at: now }).eq('request_id', requestId)
    setRequest(prev => prev ? { ...prev, status: 'completed' } : prev)
    setPayPhase('awaiting_user_payment')
  }

  const applyDeliveryAddress = async (addr: SavedAddress) => {
    const line = formatAddress(addr)
    const { error } = await supabase.from('requests').update({
      delivery_address: line,
      delivery_lat: addr.lat,
      delivery_lng: addr.lng,
    }).eq('id', requestId)
    if (error) {
      alert(error.message || 'Could not update address')
      return
    }
    setRequest(prev => prev ? {
      ...prev,
      delivery_address: line,
      delivery_lat: addr.lat,
      delivery_lng: addr.lng,
    } : prev)
    setChangingAddress(false)
    if (request?.accepted_dp_id) {
      await supabase.from('notifications').insert({
        user_id: request.accepted_dp_id,
        title: 'Delivery address updated',
        body: `Customer updated delivery address to: ${line}`,
        type: 'order_status',
        related_id: requestId,
      })
      kickPushDelivery()
    }
  }

  const markPaymentCompleted = async () => {
    const now = new Date().toISOString()

    // Prefer RPC (adds timestamps + cash_received even when schema/RLS is sticky)
    const { data: rpcData, error: rpcErr } = await supabase.rpc('mark_customer_payment_completed', {
      p_request_id: requestId,
    })

    if (!rpcErr && rpcData && (rpcData as any).ok !== false) {
      const completedAt = (rpcData as any).payment_completed_at || now
      const nextStatus = (rpcData as any).status || 'cash_received'
      setRequest(prev => (prev ? {
        ...prev,
        payment_completed_at: completedAt,
        status: nextStatus,
      } : prev))
    } else {
      // Fallback 1: direct column update
      let { error } = await supabase.from('requests').update({
        payment_completed_at: now,
        status: 'cash_received',
      }).eq('id', requestId)

      if (error) {
        // Fallback 2: status-only (column may be missing on older DBs)
        const fb = await supabase.from('requests').update({
          status: 'cash_received',
        }).eq('id', requestId)
        if (fb.error) {
          console.error('[LiveTracking] payment confirm failed:', rpcErr || error, fb.error)
          alert('Could not confirm payment. Please try again.')
          return
        }
        setRequest(prev => (prev ? { ...prev, status: 'cash_received', payment_completed_at: now } : prev))
      } else {
        setRequest(prev => (prev ? { ...prev, payment_completed_at: now, status: 'cash_received' } : prev))
      }
    }

    if (request?.accepted_dp_id) {
      await supabase.from('notifications').insert({
        user_id: request.accepted_dp_id,
        title: 'Payment Completed',
        body: 'Customer marked payment as completed. Please Accept Payment.',
        type: 'payment_completed',
        related_id: requestId,
      })
      kickPushDelivery()
    }
    setPayPhase('awaiting_dp_accept')
  }

  const submitRating = async () => {
    if (ratingStars === 0) return
    setRatingSubmitting(true)
    try {
      if (request?.accepted_dp_id) {
        const { data: orderData } = await supabase.from('orders').select('id').eq('request_id', requestId).maybeSingle()
        if (orderData) {
          await supabase.from('ratings').insert({
            order_id: orderData.id,
            rater_id: profile!.id,
            rated_id: request.accepted_dp_id,
            stars: ratingStars,
            review: ratingFeedback.trim() || null,
          })
        }
        await supabase.from('notifications').insert({
          user_id: request.accepted_dp_id,
          title: 'Order completed',
          body: 'Customer rated the delivery. Order completed.',
          type: 'order_completed',
          related_id: requestId,
        })
        kickPushDelivery()
      }
    } catch { /* ignore */ }
    finally {
      setRatingSubmitting(false)
      setPayPhase('thanks')
      setTimeout(() => navigate('/app'), 2000)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#000000]">
        <div className="text-black/40">Loading tracking...</div>
      </div>
    )
  }

  if (!request) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#000000]">
        <p className="text-black/50">Order not found</p>
        <button type="button" onClick={() => navigate('/app')} className="btn-primary">Back Home</button>
      </div>
    )
  }

  const isCancelled = request.status === 'cancelled'
  const isPending = request.status === 'pending'
  const isCompleted = request.status === 'completed' || request.status === 'delivered' || request.status === 'cash_received'
  const isDelivered = request.status === 'delivered' || request.status === 'cash_received' || request.status === 'completed'
  const showLiveMap = LIVE_STATUSES.has(request.status)
  const progress = STATUS_PROGRESS[request.status] ?? 0
  const etaLabel = liveEtaLabel || STATUS_ETA[request.status] || '--'
  const VehicleIcon = vehicleIcon(dpData?.vehicle_type)

  if (payPhase === 'thanks') {
    return (
      <MobileFrame overlay className="items-center justify-center overflow-hidden px-6">
        <img src={Images.thankYouRating} alt="Thank you for rating" className="mb-4 w-full max-w-sm object-contain" draggable={false} style={{ background: 'transparent' }} />
        <p className="text-sm text-black/50">Returning home...</p>
      </MobileFrame>
    )
  }

  if (payPhase === 'payment_accepted') {
    return (
      <MobileFrame overlay className="items-center justify-center overflow-hidden px-6">
        <img src={Images.paymentReceived} alt="Payment accepted" className="mb-4 w-full max-w-sm object-contain rounded-3xl" draggable={false} style={{ background: 'transparent' }} />
        <p className="text-base font-extrabold text-[#F5F7F6]">Payment accepted</p>
        <p className="mt-1 text-sm text-black/50">Opening rating…</p>
      </MobileFrame>
    )
  }

  if (payPhase === 'rating') {
    return (
      <MobileFrame overlay className="items-center justify-center overflow-y-auto px-6 py-8">
        <div className="w-full max-w-sm">
          <Surface className="rounded-[28px] p-6 text-center">
            <h2 className="mb-1 text-xl font-bold text-[#F5F7F6]">Rate Your Delivery</h2>
            <p className="mb-5 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              How was {dpProfile?.full_name?.split(' ')[0] || 'your partner'}'s service?
            </p>
            <div className="mb-2">
              <InteractiveStarRating value={ratingStars} onChange={setRatingStars} size={40} />
            </div>
            <p className="mb-5 text-center text-sm font-semibold" style={{ color: ratingStars ? '#FBBF24' : 'rgba(255,255,255,0.35)' }}>
              {ratingStars === 0
                ? 'Tap a star to rate'
                : ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][ratingStars]}
            </p>
            <textarea
              value={ratingFeedback}
              onChange={e => setRatingFeedback(e.target.value)}
              placeholder="Write feedback (optional)..."
              rows={3}
              className="input mb-5 w-full resize-none text-sm"
            />
            <CTA type="button" onClick={submitRating} disabled={ratingStars === 0 || ratingSubmitting} className="w-full">
              {ratingSubmitting ? 'Submitting...' : 'Confirm Rating & Feedback'}
            </CTA>
          </Surface>
        </div>
      </MobileFrame>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col" style={{ background: pg.bg }}>
      <div className="flex-shrink-0 px-4 pt-12 pb-2">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate('/app')} className="map-control-btn map-control-dark">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 text-center pr-11">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em]" style={{ color: pg.lime }}>Live</p>
            <p className="text-sm font-extrabold text-[#F5F7F6]">Order tracking</p>
          </div>
        </div>
      </div>

      <div className="relative flex-shrink-0">
        {isPending ? (
          <div className="flex h-[46vh] min-h-[300px] flex-col items-center justify-center bg-[#000000] px-6">
            <img src={Images.userWaiting} alt="" className="mb-3 h-40 w-40 object-contain" />
            <p className="text-lg font-bold text-[#F5F7F6]">Waiting for partner</p>
          </div>
        ) : isCancelled ? (
          <div className="flex h-[46vh] min-h-[300px] flex-col items-center justify-center bg-[#000000] px-6">
            <p className="text-lg font-bold text-[#F5F7F6]">Order Cancelled</p>
            <button type="button" onClick={() => navigate('/app')} className="btn-primary mt-4">Back Home</button>
          </div>
        ) : showLiveMap ? (
          <div className="space-y-2">
            <VisualTracking
              progress={progress}
              status={request.status}
              dpName={dpProfile?.full_name}
              pickupLabel={request.pickup_address?.split(',')[0] || 'Store'}
              deliveryLabel={request.delivery_address?.split(',')[0] || 'You'}
              hideProgress
              compact
            />
            <div className="relative mx-3 mb-2 h-[30vh] min-h-[200px] overflow-hidden" style={{ borderRadius: 24, border: '1px solid rgba(255,255,255,0.1)' }}>
              <FreeStreetMap
                center={mapCenter}
                zoom={14}
                markers={mapMarkers}
                routeLine={routeCoords.length >= 2 ? routeCoords : dpLive && userPos ? [dpLive, userPos] : null}
                light
                instant
                hideRadius
                hideBadge
                radiusMeters={MAP_VIEW_RADIUS_M}
              />
              {liveEtaLabel && (
                <div
                  className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full px-4 py-1.5 text-xs font-extrabold"
                  style={{ background: 'rgba(0,0,0,0.94)', color: pg.lime, border: `1px solid rgba(12, 138, 62, 0.35)` }}
                >
                  ETA {liveEtaLabel}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="min-h-[240px]">
            <VisualTracking
              progress={progress}
              status={request.status}
              dpName={dpProfile?.full_name}
              pickupLabel={request.pickup_address?.split(',')[0] || 'Store'}
              deliveryLabel={request.delivery_address?.split(',')[0] || 'You'}
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24" style={{ background: pg.bg }}>
        <div className="mx-auto max-w-md">
          {dpProfile && !isCancelled && !isPending && (
            <>
              <div className="mb-3 grid grid-cols-3 gap-2.5">
                <Surface className="p-3 text-center">
                  <div className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'rgba(251,191,36,0.15)' }}>
                    <Star size={16} style={{ color: pg.lime }} fill={pg.lime} />
                  </div>
                  <p className="text-base font-bold text-[#F5F7F6]">
                    {dpData?.rating_avg && Number(dpData.rating_avg) > 0 ? Number(dpData.rating_avg).toFixed(1) : '—'}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: pg.text3 }}>
                    Rating{dpData?.rating_count ? ` (${dpData.rating_count})` : ''}
                  </p>
                </Surface>
                <Surface className="p-3 text-center">
                  <div className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: pg.limeDim }}>
                    <VehicleIcon size={16} style={{ color: pg.lime }} />
                  </div>
                  <p className="text-base font-bold text-[#F5F7F6] capitalize">{dpData?.vehicle_type || 'Bike'}</p>
                  <p className="text-[10px]" style={{ color: pg.text3 }}>Vehicle</p>
                </Surface>
                <Surface className="p-3 text-center">
                  <div className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'rgba(59,130,246,0.15)' }}>
                    <Clock size={16} style={{ color: pg.lime }} />
                  </div>
                  <p className="text-base font-bold text-[#F5F7F6]">{etaLabel}</p>
                  <p className="text-[10px]" style={{ color: pg.text3 }}>ETA</p>
                </Surface>
              </div>

              <Surface className="mb-4 p-4">
                <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: pg.text3 }}>
                  Delivery Partner
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative h-16 w-16 overflow-hidden rounded-2xl shrink-0" style={{ background: pg.surface2 }}>
                    {dpProfile.photo_url ? (
                      <img src={dpProfile.photo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center" style={{ color: pg.text3 }}><Bike size={24} /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#F5F7F6] truncate">{dpProfile.full_name}</p>
                    <p className="text-xs" style={{ color: pg.text3 }}>{STATUS_LABELS[request.status] || request.status}</p>
                  </div>
                  {!isCompleted && (
                    <>
                      <button type="button" onClick={() => { window.location.href = `tel:${dpProfile.phone || ''}` }}
                        className="flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
                        style={{ background: pg.limeDim, border: '1px solid rgba(196,214,0,0.25)', color: pg.lime }}>
                        <Phone size={18} />
                      </button>
                      <button type="button" onClick={async () => {
                        if (!request || !request.accepted_dp_id || !request.user_id) return
                        const roomId = await openRequestChatRoom({
                          requestId: request.id,
                          userId: request.user_id,
                          dpId: request.accepted_dp_id,
                        })
                        if (roomId) navigate(`/app/chat/${roomId}`)
                      }} className="flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
                        style={{ background: pg.lime, color: pg.limeText }}>
                        <MessageCircle size={18} />
                      </button>
                    </>
                  )}
                </div>
              </Surface>

              <Surface className="mb-4 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-red-400" />
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: pg.text3 }}>Delivery Address</p>
                  </div>
                  {!isCompleted && (
                    <button
                      type="button"
                      onClick={() => setChangingAddress(true)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold"
                      style={{ background: pg.limeDim, color: pg.lime }}
                    >
                      <Pencil size={12} /> Change
                    </button>
                  )}
                </div>
                <p className="text-sm leading-relaxed" style={{ color: pg.text }}>{request.delivery_address || 'Not specified'}</p>
              </Surface>

              {changingAddress && (
                <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                  <div className="w-full max-w-lg max-h-[85dvh] overflow-y-auto rounded-[24px]" style={{ background: pg.surface, border: `1px solid ${pg.lineStrong}` }}>
                    <div className="flex items-center justify-between px-4 pt-4">
                      <p className="text-sm font-extrabold">Update delivery address</p>
                      <button type="button" onClick={() => setChangingAddress(false)} className="text-xs font-bold" style={{ color: pg.text3 }}>Close</button>
                    </div>
                    <div className="p-4">
                      <AddressPicker
                        defaultOpenList
                        onSelect={(addr) => { void applyDeliveryAddress(addr) }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-4">
                <NeedHelpCard requestId={requestId} chatBasePath="/app/support" />
              </div>

              {Array.isArray((request as any).photo_urls) && (request as any).photo_urls.length > 0 && (
                <Surface className="mb-4 p-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-black/55">Order photos</p>
                  <div className="flex flex-wrap gap-2">
                    {((request as any).photo_urls as string[]).map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={url}
                          alt={`Order photo ${i + 1}`}
                          className="h-20 w-20 rounded-xl object-cover"
                          style={{ border: `1px solid ${pg.line}` }}
                        />
                      </a>
                    ))}
                  </div>
                </Surface>
              )}
            </>
          )}

          {isPending && (
            <button type="button" onClick={async () => {
              await supabase.from('requests').update({ status: 'cancelled' }).eq('id', requestId)
              navigate('/app')
            }} className="w-full rounded-2xl py-3 text-sm font-semibold text-red-400"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              Cancel Request
            </button>
          )}

          {isDelivered && payPhase === 'idle' && request.status !== 'completed' && (
            <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-[28px] p-6 text-center" style={{ background: pg.headerElevated, border: `1px solid ${pg.headerBorder}` }}>
                <PackageCheck size={40} className="mx-auto mb-3 text-green-400" />
                <p className="text-lg font-extrabold text-[#F5F7F6]">Order delivered</p>
                <p className="mt-1 mb-5 text-sm" style={{ color: pg.text3 }}>Please accept delivery to continue</p>
                <CTA type="button" onClick={confirmDelivery} className="w-full" style={{ background: pg.success, color: '#fff', boxShadow: 'none' }}>
                  Accept Delivery
                </CTA>
              </div>
            </div>
          )}

          {(payPhase === 'awaiting_user_payment' || (request.status === 'completed' && payPhase === 'idle')) && (
            <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-[28px] p-6 text-center" style={{ background: pg.headerElevated, border: `1px solid ${pg.headerBorder}` }}>
                <p className="text-lg font-extrabold text-[#F5F7F6]">Payment completed?</p>
                <p className="mt-1 mb-5 text-sm" style={{ color: pg.text3 }}>Confirm you have paid your delivery partner</p>
                <CTA type="button" onClick={markPaymentCompleted} className="w-full">
                  Payment Completed
                </CTA>
              </div>
            </div>
          )}

          {payPhase === 'awaiting_dp_accept' && (
            <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-[28px] p-6 text-center" style={{ background: pg.headerElevated, border: `1px solid ${pg.headerBorder}` }}>
                <p className="font-extrabold text-[#F5F7F6]">Waiting for partner…</p>
                <p className="mt-2 text-sm" style={{ color: pg.text3 }}>Partner will Accept Payment next — then you can rate</p>
              </div>
            </div>
          )}

          {isCancelled && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-center">
              <p className="font-semibold text-red-400">Order Cancelled</p>
              <CTA onClick={() => navigate('/app')} className="mt-3 w-full">Back Home</CTA>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
