import { useEffect, useMemo, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, type DeliveryRequest, type Profile } from '../../lib/supabase'
import { useAuth } from '../../context'
import { useGps } from '../../hooks/useGps'
import { STATUS_LABELS } from '../../lib/utils'
import FreeStreetMap, { type MapMarker } from '../../components/map/FreeStreetMap'
import { Images } from '../../lib/customImages'
import { fetchRoute, formatETA, type LatLng } from '../../lib/mapUtils'
import {
  ArrowLeft, Navigation, MapPin, MessageCircle, Package, CheckCircle2,
  Bike, Phone, Camera, X, Clock, User as UserIcon, Store,
} from 'lucide-react'
import { pg } from '../../design/tokens'
import { CTA, Surface } from '../../design/primitives'

const STATUS_FLOW: { from: string; to: string; label: string; notifTitle: string; notifBody: string; icon: any }[] = [
  { from: 'accepted', to: 'shopping', label: 'Reached Store', notifTitle: 'Reached Store', notifBody: 'Your delivery partner reached the store.', icon: Store },
  { from: 'confirmed', to: 'shopping', label: 'Reached Store', notifTitle: 'Reached Store', notifBody: 'Your delivery partner reached the store.', icon: Store },
  { from: 'shopping', to: 'purchased', label: 'Order Picked Up', notifTitle: 'Order Picked Up', notifBody: 'Items picked up! Partner is heading your way soon.', icon: Package },
  { from: 'purchased', to: 'on_the_way', label: 'On The Way', notifTitle: 'On The Way!', notifBody: 'Your delivery partner is heading to your location.', icon: Bike },
  { from: 'on_the_way', to: 'arrived', label: 'Arrived', notifTitle: 'Partner Arrived', notifBody: 'Your delivery partner has arrived. Please be ready to receive.', icon: MapPin },
  { from: 'arrived', to: 'delivered', label: 'Delivered', notifTitle: 'Order Delivered', notifBody: 'Your order has been delivered. Please confirm receipt in the app.', icon: CheckCircle2 },
]

const LIVE_STATUSES = new Set(['on_the_way', 'arrived', 'purchased', 'shopping', 'accepted', 'confirmed'])

export default function DpNavigationPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const gps = useGps(profile?.id, !!profile)

  const [request, setRequest] = useState<DeliveryRequest | null>(null)
  const [userProfile, setUserProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [showAcceptedSplash, setShowAcceptedSplash] = useState(false)
  const [showThanks, setShowThanks] = useState(false)
  const [liveEtaLabel, setLiveEtaLabel] = useState<string | null>(null)
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([])
  const photoInputRef = useRef<HTMLInputElement>(null)
  const splashShown = useRef(false)
  const lastEtaWrite = useRef(0)

  useEffect(() => {
    if (!requestId) return
    const fetchData = async () => {
      const { data: req } = await supabase.from('requests').select('*').eq('id', requestId).maybeSingle()
      if (!req) { setLoading(false); return }
      setRequest(req as DeliveryRequest)
      if (!splashShown.current && (req.status === 'accepted' || req.status === 'confirmed')) {
        splashShown.current = true
        setShowAcceptedSplash(true)
        setTimeout(() => setShowAcceptedSplash(false), 2000)
      }
      if (req.user_id) {
        const { data: userProf } = await supabase.from('profiles').select('*').eq('id', req.user_id).maybeSingle()
        setUserProfile(userProf as Profile | null)
      }
      const existingPhotos = (req as any)?.delivery_proof_photos as string[] | null
      if (existingPhotos && existingPhotos.length > 0) {
        setPhotoPreviews(existingPhotos)
        setPhotoFiles([])
      }
      setLoading(false)
    }
    fetchData()

    const channel = supabase
      .channel(`dp-nav-${requestId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests', filter: `id=eq.${requestId}` },
        (payload: any) => setRequest(payload.new as DeliveryRequest))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
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
    if (!request || !LIVE_STATUSES.has(request.status) || !dpPos || !userPos) return
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

  const mapMarkers: MapMarker[] = useMemo(() => {
    const list: MapMarker[] = []
    if (userPos) list.push({ id: 'user', position: userPos, kind: 'user', label: 'Customer' })
    if (dpPos) list.push({ id: 'dp', position: dpPos, kind: 'bike', label: 'You' })
    return list
  }, [userPos, dpPos])

  const mapCenter = useMemo(() => {
    if (dpPos && userPos) return { lat: (dpPos.lat + userPos.lat) / 2, lng: (dpPos.lng + userPos.lng) / 2 }
    return dpPos || userPos
  }, [dpPos, userPos])

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-black text-white/40">Loading...</div>
  if (!request) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black">
      <p className="text-white/50">Order not found</p>
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
    const ts = Date.now()
    const urls: string[] = []
    for (let i = 0; i < photoFiles.length; i++) {
      const path = `delivery-proof/${requestId}/${ts}-proof-${i}`
      const { error } = await supabase.storage.from('media').upload(path, photoFiles[i], { upsert: true })
      if (!error) urls.push(supabase.storage.from('media').getPublicUrl(path).data.publicUrl)
    }
    if (urls.length > 0) {
      await supabase.from('requests').update({
        delivery_proof_photos: urls, delivery_proof_url: urls[0],
        delivery_proof_by: profile!.id, delivery_proof_at: new Date().toISOString(),
      }).eq('id', requestId)
    }
    setUploading(false)
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

  if (showThanks) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black px-6">
        <img src={Images.customerThankYou} alt="Thank you" className="mb-4 w-full max-w-sm object-contain" draggable={false} />
        <p className="text-sm text-white/50">Returning home...</p>
      </div>
    )
  }

  if (showAcceptedSplash) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 px-6" style={{ background: pg.bg }}>
        <img src={Images.orderAccepted} alt="Order accepted" className="w-full max-w-sm rounded-3xl object-contain" draggable={false} />
        <p className="text-sm text-white/50">Opening order tracking...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col" style={{ background: pg.bg }}>
      {/* Centered header — no side ribbon */}
      <div className="relative flex-shrink-0 px-4 pb-2 pt-12">
        <button
          type="button"
          onClick={() => navigate('/dp')}
          className="absolute left-4 top-12 map-control-btn map-control-dark"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="text-center">
          <p className="text-base font-extrabold text-white">Order tracking</p>
          <p className="text-xs" style={{ color: pg.text3 }}>{STATUS_LABELS[request.status] || request.status}</p>
        </div>
      </div>

      {/* Live street map — no status illustrations */}
      <div className="relative mx-3 mb-3 h-[42vh] min-h-[260px] shrink-0 overflow-hidden" style={{ borderRadius: 24, border: '1px solid rgba(255,255,255,0.1)' }}>
        <FreeStreetMap
          center={mapCenter || { lat: 17.6868, lng: 83.2185 }}
          zoom={14}
          markers={mapMarkers}
          routeLine={routeCoords.length >= 2 ? routeCoords : dpPos && userPos ? [dpPos, userPos] : null}
          light
          instant
          hideRadius
          radiusMeters={5000}
        />
        {liveEtaLabel && (
          <div
            className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full px-4 py-1.5 text-xs font-extrabold"
            style={{ background: 'rgba(7,8,11,0.88)', color: pg.lime, border: '1px solid rgba(245,197,66,0.35)' }}
          >
            ETA to customer · {liveEtaLabel}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2 pb-24" style={{ background: pg.bg }}>
        <div className="mx-auto max-w-md space-y-4">
          {/* DP own photo + Customer photo */}
          <div className="grid grid-cols-2 gap-3">
            <Surface className="p-3">
              <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wide" style={{ color: pg.text4 }}>You</p>
              <div className="flex items-center gap-2">
                <div className="h-12 w-12 overflow-hidden rounded-xl bg-white/5 shrink-0">
                  {profile?.photo_url ? (
                    <img src={profile.photo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/30"><Bike size={18} /></div>
                  )}
                </div>
                <p className="truncate text-sm font-extrabold">{profile?.full_name?.split(' ')[0] || 'Partner'}</p>
              </div>
            </Surface>
            <Surface className="p-3">
              <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wide" style={{ color: pg.text4 }}>Customer</p>
              <div className="flex items-center gap-2">
                <div className="h-12 w-12 overflow-hidden rounded-xl bg-white/5 shrink-0">
                  {userProfile?.photo_url ? (
                    <img src={userProfile.photo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/30"><UserIcon size={18} /></div>
                  )}
                </div>
                <p className="truncate text-sm font-extrabold">{userProfile?.full_name?.split(' ')[0] || 'Customer'}</p>
              </div>
            </Surface>
          </div>

          {userProfile && (
            <Surface className="p-4">
              <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: pg.text3 }}>Customer</div>
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-2xl bg-white/5 shrink-0">
                  {userProfile.photo_url ? (
                    <img src={userProfile.photo_url} alt={userProfile.full_name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/30"><UserIcon size={20} /></div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-white">{userProfile.full_name}</p>
                  <p className="text-xs text-white/40">{userProfile.phone || 'No phone'}</p>
                </div>
                <button type="button" onClick={() => { window.location.href = `tel:${userProfile.phone || ''}` }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl active:scale-95 disabled:opacity-30"
                  style={{ background: pg.limeDim, border: '1px solid rgba(245,197,66,0.25)', color: pg.lime }}
                  disabled={isCompleted}>
                  <Phone size={16} />
                </button>
                <button type="button" onClick={async () => {
                  const { data } = await supabase.from('chat_rooms').select('id').eq('request_id', requestId).maybeSingle()
                  if (data) navigate(`/dp/chat/${data.id}`)
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
              <p className="text-sm font-bold text-white">Delivery Address</p>
            </div>
            <p className="mb-3 text-sm leading-relaxed text-white/80">{request.delivery_address || 'Not specified'}</p>
            <CTA type="button" onClick={openGoogleMaps} className="w-full">
              <Navigation size={18} /> Open in Google Maps
            </CTA>
          </Surface>

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
                      <button type="button" onClick={() => removePhoto(idx)} className="absolute -right-1 -top-1 rounded-full bg-red-500 p-1 text-white shadow">
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => photoInputRef.current?.click()}
                className="w-full rounded-xl border-2 border-dashed py-3 text-sm font-bold"
                style={{ borderColor: pg.line, background: pg.bgElevated, color: pg.text3 }}>
                <Camera size={18} className="mx-auto mb-1 text-white/60" />
                {photoPreviews.length > 0 ? 'Add More Photos' : 'Take Delivery Photos'}
              </button>
              {photoFiles.length > 0 && (
                <CTA type="button" onClick={uploadDeliveryPhotos} disabled={uploading} className="mt-2 w-full">
                  {uploading ? 'Uploading...' : `Save ${photoFiles.length} Photo${photoFiles.length === 1 ? '' : 's'}`}
                </CTA>
              )}
            </Surface>
          )}

          {isDelivered && !isCompleted && (
            <Surface className="p-4 text-center">
              <Clock size={24} className="mx-auto mb-2 animate-pulse" style={{ color: pg.lime }} />
              <p className="font-bold text-white">Waiting for customer to accept delivery</p>
              <p className="mt-1 text-xs" style={{ color: pg.text3 }}>You'll continue after the customer confirms receipt</p>
            </Surface>
          )}

          {(request as any).payment_completed_at && !(request as any).payment_accepted_at && (
            <Surface accent className="p-4">
              <p className="mb-3 text-sm font-extrabold" style={{ color: pg.lime }}>Customer marked payment completed</p>
              <CTA
                type="button"
                onClick={async () => {
                  await supabase.from('requests').update({
                    payment_accepted_at: new Date().toISOString(),
                  } as any).eq('id', requestId)
                  await supabase.from('notifications').insert({
                    user_id: request.user_id,
                    title: 'Payment Accepted',
                    body: 'Partner accepted your payment. Please rate the delivery.',
                    type: 'payment_accepted',
                    related_id: requestId,
                  })
                  setShowThanks(true)
                  setTimeout(() => navigate('/dp'), 2000)
                }}
                className="w-full"
              >
                Accept Payment
              </CTA>
            </Surface>
          )}

          {isCompleted && (
            <CTA type="button" onClick={() => navigate('/dp')} className="w-full">
              <CheckCircle2 size={18} /> Delivery Confirmed — Go Home
            </CTA>
          )}
        </div>
      </div>
    </div>
  )
}
