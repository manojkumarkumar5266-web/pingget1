import { useEffect, useMemo, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, type DeliveryRequest, type Profile, type DeliveryPartner } from '../../lib/supabase'
import { useAuth } from '../../context'
import { STATUS_LABELS } from '../../lib/utils'
import VisualTracking, { STATUS_PROGRESS, STATUS_ETA } from '../../components/VisualTracking'
import FreeStreetMap, { type MapMarker } from '../../components/map/FreeStreetMap'
import { Images } from '../../lib/customImages'
import { fetchRoute, formatETA, type LatLng } from '../../lib/mapUtils'
import { ArrowLeft, Phone, MessageCircle, Star, Clock, Bike, PackageCheck, MapPin, Car, Truck } from 'lucide-react'
import { pg } from '../../design/tokens'
import { CTA, Surface, MobileFrame } from '../../design/primitives'

function vehicleIcon(v: string | null | undefined) {
  const s = (v || '').toLowerCase()
  if (s === 'bicycle' || s === 'motorbike' || s === 'scooter' || s === 'auto') return Bike
  if (s === 'car') return Car
  return Truck
}

type PayPhase = 'idle' | 'awaiting_user_payment' | 'awaiting_dp_accept' | 'rating' | 'thanks'

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
  const lastEtaWrite = useRef(0)

  useEffect(() => {
    if (!requestId) return
    const fetchData = async () => {
      const { data: req } = await supabase.from('requests').select('*').eq('id', requestId).maybeSingle()
      if (!req) { setLoading(false); return }
      setRequest(req as DeliveryRequest)
      if ((req as any).payment_completed_at && !(req as any).payment_accepted_at) {
        setPayPhase('awaiting_dp_accept')
      }
      if (req.accepted_dp_id) {
        const [dpProf, dp] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', req.accepted_dp_id).maybeSingle(),
          supabase.from('delivery_partners').select('*').eq('user_id', req.accepted_dp_id).maybeSingle(),
        ])
        setDpProfile(dpProf.data as Profile | null)
        setDpData(dp.data as DeliveryPartner | null)
        const p = dpProf.data as Profile | null
        const d = dp.data as DeliveryPartner | null
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
          if ((next as any).payment_accepted_at && payPhase !== 'rating' && payPhase !== 'thanks') {
            setPayPhase('rating')
          }
          const lat = (next as any).dp_lat
          const lng = (next as any).dp_lng
          if (lat != null && lng != null) setDpLive({ lat: Number(lat), lng: Number(lng) })
          if (payload.new.accepted_dp_id && !dpProfile) {
            const [dpProf, dp] = await Promise.all([
              supabase.from('profiles').select('*').eq('id', payload.new.accepted_dp_id).maybeSingle(),
              supabase.from('delivery_partners').select('*').eq('user_id', payload.new.accepted_dp_id).maybeSingle(),
            ])
            setDpProfile(dpProf.data as Profile | null)
            setDpData(dp.data as DeliveryPartner | null)
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
      const [prof, dp] = await Promise.all([
        supabase.from('profiles').select('gps_lat,gps_lng,photo_url,full_name,phone').eq('id', dpId).maybeSingle(),
        supabase.from('delivery_partners').select('current_lat,current_lng,vehicle_type,rating_avg,rating_count').eq('user_id', dpId).maybeSingle(),
      ])
      if (prof.data) {
        setDpProfile(prev => ({ ...(prev || {}), ...prof.data } as Profile))
      }
      if (dp.data) setDpData(prev => ({ ...(prev || {}), ...dp.data } as DeliveryPartner))
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
    if (dpLive) list.push({ id: 'dp', position: dpLive, kind: 'bike', label: dpProfile?.full_name?.split(' ')[0] })
    return list
  }, [userPos, dpLive, dpProfile?.full_name])

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

  const confirmDelivery = async () => {
    await supabase.from('requests').update({ status: 'completed' }).eq('id', requestId)
    await supabase.from('orders').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('request_id', requestId)
    setPayPhase('awaiting_user_payment')
  }

  const markPaymentCompleted = async () => {
    await supabase.from('requests').update({
      payment_completed_at: new Date().toISOString(),
    } as any).eq('id', requestId)
    await supabase.from('notifications').insert({
      user_id: request?.accepted_dp_id,
      title: 'Payment Completed',
      body: 'Customer marked payment as completed. Please Accept Payment.',
      type: 'payment_completed',
      related_id: requestId,
    })
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
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-white/40">Loading tracking...</div>
      </div>
    )
  }

  if (!request) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black">
        <p className="text-white/50">Order not found</p>
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
        <img src={Images.customerThankYou} alt="Thank you" className="w-full max-w-sm object-contain mb-4" draggable={false} />
        <p className="text-sm text-white/50">Returning home...</p>
      </MobileFrame>
    )
  }

  if (payPhase === 'rating') {
    return (
      <MobileFrame overlay className="items-center justify-center overflow-y-auto px-6 py-8">
        <div className="w-full max-w-sm">
          <img src={Images.paymentReceived} alt="Thank you payment received" className="w-full object-contain mb-4 rounded-2xl" draggable={false} />
          <Surface className="rounded-[28px] p-6 text-center">
            <h2 className="mb-1 text-xl font-bold text-white">Rate Your Delivery</h2>
            <p className="mb-5 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              How was {dpProfile?.full_name?.split(' ')[0] || 'your partner'}'s service?
            </p>
            <div className="mb-5 flex items-center justify-center gap-3">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" onClick={() => setRatingStars(n)} className="active:scale-90">
                  <Star size={36} fill={n <= ratingStars ? '#FBBF24' : 'none'}
                    className={n <= ratingStars ? 'text-[#F5C542]' : 'text-white/20'} />
                </button>
              ))}
            </div>
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
            <p className="text-sm font-extrabold text-white">Order tracking</p>
          </div>
        </div>
      </div>

      <div className="relative flex-shrink-0">
        {isPending ? (
          <div className="flex h-[46vh] min-h-[300px] flex-col items-center justify-center bg-black px-6">
            <img src={Images.userWaiting} alt="" className="mb-3 h-40 w-40 object-contain" />
            <p className="text-lg font-bold text-white">Waiting for partner</p>
          </div>
        ) : isCancelled ? (
          <div className="flex h-[46vh] min-h-[300px] flex-col items-center justify-center bg-black px-6">
            <p className="text-lg font-bold text-white">Order Cancelled</p>
            <button type="button" onClick={() => navigate('/app')} className="btn-primary mt-4">Back Home</button>
          </div>
        ) : showLiveMap ? (
          <div>
            <VisualTracking
              progress={progress}
              status={request.status}
              dpName={dpProfile?.full_name}
              pickupLabel={request.pickup_address?.split(',')[0] || 'Store'}
              deliveryLabel={request.delivery_address?.split(',')[0] || 'You'}
              hideProgress
              compact
            />
            <div className="relative mx-3 mb-2 h-[32vh] min-h-[200px] overflow-hidden" style={{ borderRadius: 24, border: '1px solid rgba(255,255,255,0.1)' }}>
              <FreeStreetMap
                center={mapCenter}
                zoom={14}
                markers={mapMarkers}
                routeLine={routeCoords.length >= 2 ? routeCoords : dpLive && userPos ? [dpLive, userPos] : null}
                light
                instant
                hideRadius
                radiusMeters={5000}
              />
              {liveEtaLabel && (
                <div
                  className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full px-4 py-1.5 text-xs font-extrabold"
                  style={{ background: 'rgba(7,8,11,0.88)', color: pg.lime, border: `1px solid rgba(245,197,66,0.35)` }}
                >
                  ETA {liveEtaLabel}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-[46vh] min-h-[300px]">
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
                  <p className="text-base font-bold text-white">{dpData?.rating_avg?.toFixed(1) || '0.0'}</p>
                  <p className="text-[10px]" style={{ color: pg.text3 }}>{dpData?.rating_count || 0} reviews</p>
                </Surface>
                <Surface className="p-3 text-center">
                  <div className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: pg.limeDim }}>
                    <VehicleIcon size={16} style={{ color: pg.lime }} />
                  </div>
                  <p className="text-base font-bold text-white capitalize">{dpData?.vehicle_type || 'Bike'}</p>
                  <p className="text-[10px]" style={{ color: pg.text3 }}>Vehicle</p>
                </Surface>
                <Surface className="p-3 text-center">
                  <div className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'rgba(59,130,246,0.15)' }}>
                    <Clock size={16} style={{ color: pg.lime }} />
                  </div>
                  <p className="text-base font-bold text-white">{etaLabel}</p>
                  <p className="text-[10px]" style={{ color: pg.text3 }}>ETA</p>
                </Surface>
              </div>

              <Surface className="mb-4 p-4">
                <div className="flex items-center gap-3">
                  <div className="relative h-16 w-16 overflow-hidden rounded-2xl bg-white/5 shrink-0">
                    {dpProfile.photo_url ? (
                      <img src={dpProfile.photo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-white/30"><Bike size={24} /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white truncate">{dpProfile.full_name}</p>
                    <p className="text-xs text-white/40">{STATUS_LABELS[request.status] || request.status}</p>
                  </div>
                  {!isCompleted && (
                    <>
                      <button type="button" onClick={() => { window.location.href = `tel:${dpProfile.phone || ''}` }}
                        className="flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
                        style={{ background: pg.limeDim, border: '1px solid rgba(245,197,66,0.25)', color: pg.lime }}>
                        <Phone size={18} />
                      </button>
                      <button type="button" onClick={async () => {
                        const { data } = await supabase.from('chat_rooms').select('id').eq('request_id', requestId).maybeSingle()
                        if (data) navigate(`/app/chat/${data.id}`)
                      }} className="flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
                        style={{ background: pg.lime, color: pg.limeText }}>
                        <MessageCircle size={18} />
                      </button>
                    </>
                  )}
                </div>
              </Surface>

              <Surface className="mb-4 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <MapPin size={16} className="text-red-400" />
                  <p className="text-xs font-bold uppercase tracking-wider text-white/60">Delivery Address</p>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: pg.text2 }}>{request.delivery_address || 'Not specified'}</p>
              </Surface>
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
            <div className="mb-4 rounded-2xl border border-green-500/20 bg-green-500/5 p-4">
              <div className="mb-3 flex items-center gap-2">
                <PackageCheck size={20} className="text-green-400" />
                <div>
                  <p className="font-bold text-white">Order has been delivered!</p>
                  <p className="text-xs text-white/40">Confirm receipt to continue</p>
                </div>
              </div>
              <CTA type="button" onClick={confirmDelivery} className="w-full" style={{ background: pg.success, color: '#fff', boxShadow: 'none' }}>
                Accept Delivery
              </CTA>
            </div>
          )}

          {(payPhase === 'awaiting_user_payment' || (request.status === 'completed' && payPhase === 'idle')) && (
            <Surface accent className="mb-4 p-4">
              <p className="mb-3 text-sm" style={{ color: pg.text2 }}>Confirm you have paid your partner.</p>
              <CTA type="button" onClick={markPaymentCompleted} className="w-full">
                Payment Completed
              </CTA>
            </Surface>
          )}

          {payPhase === 'awaiting_dp_accept' && (
            <Surface accent className="mb-4 p-4 text-center">
              <p className="font-extrabold">Waiting for partner to Accept Payment…</p>
              <p className="mt-1 text-xs" style={{ color: pg.text3 }}>You will rate the delivery next</p>
            </Surface>
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
