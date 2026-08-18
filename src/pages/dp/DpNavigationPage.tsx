import { useEffect, useMemo, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, type DeliveryRequest, type Profile } from '../../lib/supabase'
import { kickPushDelivery } from '../../lib/notify'
import { useAuth } from '../../context'
import { useGps } from '../../hooks/useGps'
import { STATUS_LABELS } from '../../lib/utils'
import VisualTracking, { STATUS_PROGRESS } from '../../components/VisualTracking'
import FreeStreetMap, { MAP_VIEW_RADIUS_M, type MapMarker } from '../../components/map/FreeStreetMap'
import { fetchRoute, formatETA, type LatLng } from '../../lib/mapUtils'
import { BrandPersonName } from '../../components/Brand'
import {
  ArrowLeft, Navigation, MapPin, MessageCircle, Package, CheckCircle2,
  Bike, Phone, Camera, X, Clock, User as UserIcon, Store, Maximize2, Minimize2,
} from 'lucide-react'
import { pg } from '../../design/tokens'
import { CTA, Surface } from '../../design/primitives'
import { uploadMediaFile } from '../../lib/uploadMedia'
import NeedHelpCard from '../../components/NeedHelpCard'
import { openRequestChatRoom } from '../../lib/openRequestChat'
import { acceptDpPayment } from '../../lib/acceptDpPayment'

const STATUS_FLOW: { from: string; to: string; label: string; notifTitle: string; notifBody: string; icon: any }[] = [
  { from: 'accepted', to: 'shopping', label: 'Reached Store', notifTitle: 'Reached Store', notifBody: 'Your delivery partner reached the store.', icon: Store },
  { from: 'confirmed', to: 'shopping', label: 'Reached Store', notifTitle: 'Reached Store', notifBody: 'Your delivery partner reached the store.', icon: Store },
  { from: 'task_started', to: 'shopping', label: 'Reached Store', notifTitle: 'Reached Store', notifBody: 'Your delivery partner reached the store.', icon: Store },
  { from: 'shopping', to: 'purchased', label: 'Order Picked Up', notifTitle: 'Order Picked Up', notifBody: 'Items picked up! Partner is heading your way soon.', icon: Package },
  { from: 'purchased', to: 'on_the_way', label: 'On The Way', notifTitle: 'On The Way!', notifBody: 'Your delivery partner is heading to your location.', icon: Bike },
  { from: 'on_the_way', to: 'arrived', label: 'Arrived', notifTitle: 'Partner Arrived', notifBody: 'Your delivery partner has arrived. Please be ready to receive.', icon: MapPin },
  { from: 'arrived', to: 'delivered', label: 'Delivered', notifTitle: 'Order Delivered', notifBody: 'Your order has been delivered. Please confirm receipt in the app.', icon: CheckCircle2 },
]

const ROUTE_STATUSES = new Set(['on_the_way', 'arrived', 'purchased', 'shopping', 'accepted', 'confirmed', 'task_started'])
const MAP_LIVE_STATUSES = new Set(['on_the_way', 'arrived'])

export default function DpNavigationPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const gps = useGps(profile?.id, !!profile)

  const [request, setRequest] = useState<DeliveryRequest | null>(null)
  const [userProfile, setUserProfile] = useState<Profile | null>(null)
  const [vehicleType, setVehicleType] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [endPhase, setEndPhase] = useState<'idle' | 'payment_accepted' | 'thanks_rating'>('idle')
  const [liveEtaLabel, setLiveEtaLabel] = useState<string | null>(null)
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([])
  const photoInputRef = useRef<HTMLInputElement>(null)
  const lastEtaWrite = useRef(0)
  const [mapExpanded, setMapExpanded] = useState(false)

  useEffect(() => {
    if (!requestId) return
    const fetchData = async () => {
      const { data: req } = await supabase.from('requests').select('*').eq('id', requestId).maybeSingle()
      if (!req) { setLoading(false); return }
      setRequest(req as DeliveryRequest)
      if (req.user_id) {
        const { data: userProf } = await supabase.from('profiles').select('*').eq('id', req.user_id).maybeSingle()
        setUserProfile(userProf as Profile | null)
      }
      if (profile?.id) {
        const { data: dpRow } = await supabase.from('delivery_partners').select('vehicle_type').eq('user_id', profile.id).maybeSingle()
        setVehicleType((dpRow as any)?.vehicle_type || null)
      }
      const existingPhotos = (req as any)?.delivery_proof_photos as string[] | null
      if (existingPhotos && existingPhotos.length > 0) {
        setPhotoPreviews(existingPhotos)
        setPhotoFiles([])
      }
      if (req.payment_accepted_at) {
        setEndPhase('payment_accepted')
      }
      setLoading(false)
    }
    fetchData()

    const channel = supabase
      .channel(`dp-nav-${requestId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests', filter: `id=eq.${requestId}` },
        (payload: any) => {
          const next = payload.new as DeliveryRequest
          setRequest(next)
          if (next.payment_accepted_at) setEndPhase(prev => (prev === 'thanks_rating' ? prev : 'payment_accepted'))
        })
      .subscribe()

    // Poll payment fields so DP sees Accept Payment as soon as user marks paid
    const poll = window.setInterval(async () => {
      const { data: req } = await supabase
        .from('requests')
        .select('payment_completed_at,payment_accepted_at,status')
        .eq('id', requestId)
        .maybeSingle()
      if (!req) return
      setRequest(prev => (prev ? ({ ...prev, ...req } as DeliveryRequest) : prev))
      if (req.payment_accepted_at) setEndPhase(prev => (prev === 'thanks_rating' ? prev : 'payment_accepted'))
    }, 2000)

    return () => {
      supabase.removeChannel(channel)
      window.clearInterval(poll)
    }
  }, [requestId, profile?.id])

  const dpPos: LatLng | null = useMemo(() => {
    if (gps.lat != null && gps.lng != null) return { lat: gps.lat, lng: gps.lng }
    if (profile?.gps_lat != null && profile?.gps_lng != null) {
      return { lat: Number(profile.gps_lat), lng: Number(profile.gps_lng) }
    }
    return null
  }, [gps.lat, gps.lng, profile?.gps_lat, profile?.gps_lng])

  const userPos: LatLng | null = useMemo(() => {
    if (!request) return null
    if (request.delivery_lat != null && request.delivery_lng != null) {
      return { lat: Number(request.delivery_lat), lng: Number(request.delivery_lng) }
    }
    return null
  }, [request])

  // Live route + ETA DP → customer; write eta_minutes for user side
  useEffect(() => {
    if (!request || !ROUTE_STATUSES.has(request.status) || !dpPos || !userPos) return
    let cancelled = false
    const run = async () => {
      const route = await fetchRoute(dpPos, userPos, 'driving')
      if (cancelled) return
      if (!route) {
        setRouteCoords([dpPos, userPos])
        const R = 6371000
        const dLat = ((userPos.lat - dpPos.lat) * Math.PI) / 180
        const dLng = ((userPos.lng - dpPos.lng) * Math.PI) / 180
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((dpPos.lat * Math.PI) / 180) *
            Math.cos((userPos.lat * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2
        const meters = 2 * R * Math.asin(Math.sqrt(a))
        const seconds = (meters / 1000 / 22) * 3600
        setLiveEtaLabel(formatETA(seconds))
        return
      }
      setRouteCoords(route.coordinates.map(([lat, lng]) => ({ lat, lng })))
      setLiveEtaLabel(formatETA(route.duration_seconds))
      const mins = Math.max(1, Math.round(route.duration_seconds / 60))
      if (Date.now() - lastEtaWrite.current > 15000 && requestId) {
        lastEtaWrite.current = Date.now()
        await supabase.from('requests').update({
          eta_minutes: mins,
          dp_lat: dpPos.lat,
          dp_lng: dpPos.lng,
          dp_last_update: new Date().toISOString(),
        } as any).eq('id', requestId)
      }
    }
    run()
    const id = window.setInterval(run, 10000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [dpPos?.lat, dpPos?.lng, userPos?.lat, userPos?.lng, request?.status, requestId])

  // Stay on tracking until customer finishes rating — then thank-you → home
  useEffect(() => {
    if (!requestId || !profile?.id) return
    if (endPhase !== 'payment_accepted' && !(request?.payment_accepted_at)) return

    let cancelled = false
    const goThanks = () => {
      if (cancelled) return
      setEndPhase('thanks_rating')
    }

    const checkRating = async () => {
      const { data: order } = await supabase.from('orders').select('id').eq('request_id', requestId).maybeSingle()
      if (!order || cancelled) return
      const { data: rating } = await supabase
        .from('ratings')
        .select('id')
        .eq('order_id', order.id)
        .eq('rated_id', profile.id)
        .maybeSingle()
      if (rating) goThanks()
    }

    void checkRating()
    const poll = window.setInterval(() => void checkRating(), 4000)

    const channel = supabase
      .channel(`dp-rating-${requestId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        (payload: any) => {
          const n = payload.new
          if (n?.type === 'order_completed' && n?.related_id === requestId) goThanks()
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      window.clearInterval(poll)
      supabase.removeChannel(channel)
    }
  }, [endPhase, requestId, profile?.id, request?.payment_accepted_at])

  const mapMarkers: MapMarker[] = useMemo(() => {
    const list: MapMarker[] = []
    if (userPos) list.push({ id: 'user', position: userPos, kind: 'user', label: 'Customer' })
    if (dpPos) list.push({ id: 'dp', position: dpPos, kind: 'bike', label: 'You', vehicleType })
    return list
  }, [userPos, dpPos, vehicleType])

  const mapCenter = useMemo(() => {
    if (dpPos && userPos) return { lat: (dpPos.lat + userPos.lat) / 2, lng: (dpPos.lng + userPos.lng) / 2 }
    return dpPos || userPos
  }, [dpPos, userPos])

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#000000] text-black/40">Loading...</div>
  if (!request) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#000000]">
      <p className="text-black/50">Order not found</p>
      <button type="button" onClick={() => navigate('/dp')} className="btn-primary">Back</button>
    </div>
  )

  const updateStatus = async (newStatus: string, notifTitle: string, notifBody: string) => {
    const patch: Record<string, unknown> = { status: newStatus }
    if (dpPos) {
      patch.dp_lat = dpPos.lat
      patch.dp_lng = dpPos.lng
      patch.dp_last_update = new Date().toISOString()
    }
    await supabase.from('requests').update(patch as any).eq('id', requestId)
    await supabase.from('orders').update({ status: newStatus }).eq('request_id', requestId)
    await supabase.from('notifications').insert({
      user_id: request.user_id, title: notifTitle, body: notifBody, type: 'order_status', related_id: requestId,
    })
    kickPushDelivery()
  }

  const handlePhotosSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    const newPreviews = files.map(f => URL.createObjectURL(f))
    setPhotoFiles(prev => [...prev, ...files])
    setPhotoPreviews(prev => [...prev, ...newPreviews])
  }

  const removePhoto = (idx: number) => {
    setPhotoPreviews(prev => { URL.revokeObjectURL(prev[idx]); return prev.filter((_, i) => i !== idx) })
    setPhotoFiles(prev => prev.filter((_, i) => i !== idx))
  }

  const uploadDeliveryPhotos = async () => {
    if (photoFiles.length === 0) return
    setUploading(true)
    try {
      const ts = Date.now()
      const urls: string[] = []
      for (let i = 0; i < photoFiles.length; i++) {
        urls.push(await uploadMediaFile(photoFiles[i], `delivery-proof/${requestId}/${ts}-proof-${i}`))
      }
      if (urls.length > 0) {
        await supabase.from('requests').update({
          delivery_proof_photos: urls, delivery_proof_url: urls[0],
          delivery_proof_by: profile!.id, delivery_proof_at: new Date().toISOString(),
        }).eq('id', requestId)
      }
    } catch (e: any) {
      alert(e?.message || 'Photo upload failed')
    } finally {
      setUploading(false)
    }
  }

  const openGoogleMaps = () => {
    const lat = request.delivery_lat
    const lng = request.delivery_lng
    if (lat && lng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`, '_blank')
    } else if (request.delivery_address) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(request.delivery_address)}`, '_blank')
    }
  }

  const isDelivered = request.status === 'delivered'
  const isCompleted = request.status === 'completed'
  const currentStep = STATUS_FLOW.find(s => s.from === request.status)
  const progress = STATUS_PROGRESS[request.status] ?? 0
  const showLiveMap = MAP_LIVE_STATUSES.has(request.status)
  const mapH = mapExpanded ? 'min(62vh, 520px)' : 'min(38vh, 320px)'
  const headlineSub = STATUS_LABELS[request.status] || request.status
  const headlineMain = liveEtaLabel ? `ETA ${liveEtaLabel}` : 'Live tracking'

  if (endPhase === 'thanks_rating') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 px-6" style={{ background: pg.bg }}>
        <div className="w-full max-w-sm rounded-[28px] p-6 text-center" style={{ background: pg.headerElevated, border: `1px solid ${pg.headerBorder}` }}>
          <p className="mb-2 text-lg font-extrabold text-[#F5F7F6]">Customer rated your delivery</p>
          <p className="mb-5 text-sm" style={{ color: pg.text3 }}>Thank them to finish this order</p>
          <CTA type="button" onClick={() => navigate('/dp', { replace: true })} className="w-full">
            Thank You
          </CTA>
        </div>
      </div>
    )
  }

  if (endPhase === 'payment_accepted' || request.payment_accepted_at) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 px-6" style={{ background: pg.bg }}>
        <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: 'rgba(12,138,62,0.18)' }}>
          <CheckCircle2 size={32} style={{ color: pg.lime }} />
        </div>
        <p className="text-center text-base font-extrabold text-[#F5F7F6]">Payment accepted</p>
        <p className="text-center text-sm" style={{ color: pg.text3 }}>Waiting for customer rating…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col" style={{ background: pg.bg }}>
      <div className="sticky top-0 z-30 px-4 pb-3 pt-12" style={{ background: pg.header, borderBottom: `1px solid ${pg.line}` }}>
        <div className="flex items-start gap-3">
          <button type="button" onClick={() => navigate('/dp')}
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'rgba(255,255,255,0.08)' }}>
            <ArrowLeft size={18} color="#fff" />
          </button>
          <div className="min-w-0 flex-1 text-center pr-10">
            <p className="text-xs font-semibold" style={{ color: pg.text3 }}>{headlineSub}</p>
            <p className="mt-0.5 text-lg font-extrabold leading-tight text-white">{headlineMain}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {showLiveMap ? (
          <div className="relative" style={{ height: mapH }}>
            <FreeStreetMap
              center={mapCenter || { lat: 17.6868, lng: 83.2185 }}
              zoom={14}
              markers={mapMarkers}
              routeLine={routeCoords.length >= 2 ? routeCoords : dpPos && userPos ? [dpPos, userPos] : null}
              instant
              hideRadius
              hideBadge
              radiusMeters={MAP_VIEW_RADIUS_M}
            />
            <button type="button" onClick={() => setMapExpanded(v => !v)}
              className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.15)' }}
              aria-label={mapExpanded ? 'Collapse map' : 'Expand map'}>
              {mapExpanded ? <Minimize2 size={16} color="#fff" /> : <Maximize2 size={16} color="#fff" />}
            </button>
            {liveEtaLabel && (
              <div
                className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full px-4 py-1.5 text-xs font-extrabold"
                style={{ background: 'rgba(0,0,0,0.9)', color: '#F5F7F6', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                ETA {liveEtaLabel}
              </div>
            )}
          </div>
        ) : (
          <div className="min-h-[220px]">
            <VisualTracking
              progress={progress}
              status={request.status}
              pickupLabel={request.pickup_address?.split(',')[0] || 'Store'}
              deliveryLabel={request.delivery_address?.split(',')[0] || 'Customer'}
            />
          </div>
        )}

      <div className="space-y-3 px-3 pt-3 pb-8">
          {userProfile && (
            <Surface className="p-4">
              <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: pg.text3 }}>Customer</div>
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-2xl bg-black/5 shrink-0">
                  {userProfile.photo_url ? (
                    <img
                      src={userProfile.photo_url}
                      alt={userProfile.full_name}
                      className="h-full w-full object-cover"
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-black/30"><UserIcon size={20} /></div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <BrandPersonName as="p" className="truncate text-base" style={{ color: '#F5F7F6' }}>
                    {userProfile.full_name}
                  </BrandPersonName>
                  <p className="text-xs text-black/40">{userProfile.phone || 'No phone'}</p>
                </div>
                <button type="button" onClick={() => { window.location.href = `tel:${userProfile.phone || ''}` }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl active:scale-95 disabled:opacity-30"
                  style={{ background: pg.limeDim, border: '1px solid rgba(196,214,0,0.25)', color: pg.lime }}
                  disabled={isCompleted}>
                  <Phone size={16} />
                </button>
                <button type="button" onClick={async () => {
                  if (!request || !profile?.id || !request.user_id) return
                  const roomId = await openRequestChatRoom({
                    requestId: request.id,
                    userId: request.user_id,
                    dpId: profile.id,
                  })
                  if (roomId) navigate(`/dp/chat/${roomId}`)
                }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl active:scale-95 disabled:opacity-30"
                  style={{ background: pg.lime, color: pg.limeText }}
                  disabled={isCompleted}>
                  <MessageCircle size={16} />
                </button>
              </div>
            </Surface>
          )}

          <Surface className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <MapPin size={16} className="text-red-400" />
              <p className="text-sm font-bold text-[#F5F7F6]">Delivery Address</p>
            </div>
            <p className="mb-3 text-sm leading-relaxed" style={{ color: pg.text }}>{request.delivery_address || 'Not specified'}</p>
            <CTA type="button" onClick={openGoogleMaps} className="w-full">
              <Navigation size={18} /> Open in Google Maps
            </CTA>
          </Surface>

          <NeedHelpCard requestId={requestId} chatBasePath="/dp/support" />

          {Array.isArray(request.photo_urls) && request.photo_urls.length > 0 && (
            <Surface className="p-4">
              <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: pg.text3 }}>Order photos</p>
              <div className="flex flex-wrap gap-2">
                {request.photo_urls.map((url, i) => (
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

          {request.pickup_address && (
            <Surface className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <Store size={16} style={{ color: pg.lime }} />
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: pg.text3 }}>Pickup Location</p>
              </div>
              <p className="text-sm" style={{ color: pg.text2 }}>{request.pickup_address}</p>
            </Surface>
          )}

          {currentStep && (
            <Surface className="p-4">
              <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: pg.text3 }}>Update Status</p>
              <CTA type="button" onClick={() => updateStatus(currentStep.to, currentStep.notifTitle, currentStep.notifBody)} className="w-full">
                <currentStep.icon size={18} /> {currentStep.label}
              </CTA>
            </Surface>
          )}

          {isDelivered && (
            <Surface className="p-4">
              <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: pg.text3 }}>Delivery Proof Photos</div>
              <input ref={photoInputRef} type="file" className="hidden" accept="image/*" multiple onChange={handlePhotosSelect} />
              {photoPreviews.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {photoPreviews.map((preview, idx) => (
                    <div key={idx} className="relative">
                      <img src={preview} alt={`Proof ${idx + 1}`} className="h-20 w-20 rounded-xl object-cover" />
                      <button type="button" onClick={() => removePhoto(idx)} className="absolute -right-1 -top-1 rounded-full bg-red-500 p-1 text-[#F5F7F6] shadow">
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => photoInputRef.current?.click()}
                className="w-full rounded-xl border-2 border-dashed py-3 text-sm font-bold"
                style={{ borderColor: pg.line, background: pg.bgElevated, color: pg.text3 }}>
                <Camera size={18} className="mx-auto mb-1 text-black/55" />
                {photoPreviews.length > 0 ? 'Add More Photos' : 'Take Delivery Photos'}
              </button>
              {photoFiles.length > 0 && (
                <CTA type="button" onClick={uploadDeliveryPhotos} disabled={uploading} className="mt-2 w-full">
                  {uploading ? 'Uploading...' : `Save ${photoFiles.length} Photo${photoFiles.length === 1 ? '' : 's'}`}
                </CTA>
              )}
            </Surface>
          )}

          {isDelivered && !isCompleted && !request.payment_completed_at && (
            <Surface className="p-4 text-center">
              <Clock size={24} className="mx-auto mb-2 animate-pulse" style={{ color: pg.lime }} />
              <p className="font-bold text-[#F5F7F6]">Waiting for customer to accept delivery</p>
              <p className="mt-1 text-xs" style={{ color: pg.text3 }}>You'll continue after the customer confirms receipt</p>
            </Surface>
          )}

          {(isCompleted || isDelivered) && !request.payment_completed_at && request.status !== 'cash_received' && !request.payment_accepted_at && isCompleted && (
            <Surface className="p-4 text-center">
              <Clock size={24} className="mx-auto mb-2 animate-pulse" style={{ color: pg.lime }} />
              <p className="font-bold" style={{ color: pg.text }}>Waiting for customer payment</p>
              <p className="mt-1 text-xs" style={{ color: pg.text3 }}>Stay here until the customer marks payment completed</p>
            </Surface>
          )}

          {(!!request.payment_completed_at || request.status === 'cash_received') && !request.payment_accepted_at && (
            <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-[28px] p-6 text-center" style={{ background: pg.headerElevated, border: `1px solid ${pg.headerBorder}` }}>
                <p className="mb-1 text-lg font-extrabold" style={{ color: pg.lime }}>Payment completed</p>
                <p className="mb-5 text-sm" style={{ color: pg.text3 }}>Customer marked payment complete. Accept to continue.</p>
                <CTA
                  type="button"
                  onClick={async () => {
                    const errMsg = await acceptDpPayment(requestId!)
                    if (errMsg) {
                      console.error('[DpNav] accept payment failed:', errMsg)
                      alert(errMsg)
                      return
                    }
                    const now = new Date().toISOString()
                    setRequest(prev => prev ? ({ ...prev, payment_accepted_at: now, status: 'cash_received' as any }) : prev)
                    await supabase.from('notifications').insert({
                      user_id: request.user_id,
                      title: 'Payment Accepted',
                      body: 'Partner accepted your payment. Please rate the delivery.',
                      type: 'payment_accepted',
                      related_id: requestId,
                    })
                    kickPushDelivery()
                    setEndPhase('payment_accepted')
                  }}
                  className="w-full"
                >
                  Accept Payment
                </CTA>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
