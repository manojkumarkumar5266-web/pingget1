import { useEffect, useMemo, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, type DeliveryRequest, type Profile } from '../../lib/supabase'
import { useAuth } from '../../context'
import { STATUS_LABELS } from '../../lib/utils'
import VisualTracking, { STATUS_PROGRESS } from '../../components/VisualTracking'
import FreeStreetMap, { type MapMarker } from '../../components/map/FreeStreetMap'
import { Images } from '../../lib/customImages'
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

export default function DpNavigationPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [request, setRequest] = useState<DeliveryRequest | null>(null)
  const [userProfile, setUserProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null)
  const [updatingEta, setUpdatingEta] = useState(false)
  const [showAcceptedSplash, setShowAcceptedSplash] = useState(false)
  const [showThanks, setShowThanks] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const splashShown = useRef(false)

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
      if (profile?.id) {
        /* profile already available via useAuth */
      }
      const currentEta = (req as any).eta_minutes
      if (currentEta) setEtaMinutes(currentEta)
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

  const mapMarkers: MapMarker[] = useMemo(() => {
    if (!request) return []
    const list: MapMarker[] = []
    if (request.pickup_lat && request.pickup_lng) {
      list.push({ id: 'pickup', position: { lat: request.pickup_lat, lng: request.pickup_lng }, kind: 'pickup' })
    }
    if (request.delivery_lat && request.delivery_lng) {
      list.push({ id: 'dest', position: { lat: request.delivery_lat, lng: request.delivery_lng }, kind: 'destination' })
    }
    return list
  }, [request])

  const mapCenter =
    request?.delivery_lat && request?.delivery_lng
      ? { lat: request.delivery_lat, lng: request.delivery_lng }
      : request?.pickup_lat && request?.pickup_lng
      ? { lat: request.pickup_lat, lng: request.pickup_lng }
      : null

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-black text-white/40">Loading...</div>
  if (!request) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black">
      <p className="text-white/50">Order not found</p>
      <button type="button" onClick={() => navigate('/dp')} className="btn-primary">Back</button>
    </div>
  )

  const updateStatus = async (newStatus: string, notifTitle: string, notifBody: string) => {
    await supabase.from('requests').update({ status: newStatus }).eq('id', requestId)
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

  const updateEta = async () => {
    if (!etaMinutes || etaMinutes < 1) return
    setUpdatingEta(true)
    await supabase.from('requests').update({ eta_minutes: etaMinutes }).eq('id', requestId)
    await supabase.from('notifications').insert({
      user_id: request.user_id, title: 'ETA Updated',
      body: `Your delivery partner updated the ETA to ${etaMinutes} minutes.`,
      type: 'order_status', related_id: requestId,
    })
    setUpdatingEta(false)
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
  const stepIndex = STATUS_FLOW.findIndex(s => s.from === request.status)
  const progress = STATUS_PROGRESS[request.status] ?? 0

  if (showThanks) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black px-6">
        <img src={Images.customerThankYou} alt="Thank you" className="w-full max-w-sm object-contain mb-4" draggable={false} />
        <p className="text-sm text-white/50">Returning home...</p>
      </div>
    )
  }

  if (showAcceptedSplash) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 px-6" style={{ background: pg.bg }}>
        <img src={Images.orderAccepted} alt="Order accepted" className="w-full max-w-sm object-contain rounded-3xl" draggable={false} />
        <p className="text-sm text-white/50">Opening order tracking...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ background: pg.bg }}>
      <div className="flex-shrink-0 px-4 pt-12 pb-2">
        <div className="map-glass-panel flex items-center gap-3 p-3">
          <button type="button" onClick={() => navigate('/dp')} className="map-control-btn map-control-dark">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/50">Order Tracking</p>
            <p className="truncate text-sm font-bold text-white">{STATUS_LABELS[request.status] || request.status}</p>
          </div>
        </div>
      </div>

      {/* Progress store → user + large synced step images */}
      <div className="flex-shrink-0 px-2 pb-2" style={{ height: '42vh', minHeight: 260 }}>
        <VisualTracking
          progress={progress}
          status={request.status}
          pickupLabel={request.pickup_address?.split(',')[0] || 'Store'}
          deliveryLabel={request.delivery_address?.split(',')[0] || 'Customer'}
        />
      </div>

      {mapCenter && (
        <div className="mx-4 mb-3 h-44 overflow-hidden rounded-[24px] shrink-0" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
          <FreeStreetMap center={mapCenter} zoom={14} markers={mapMarkers} radiusMeters={10_000} />
        </div>
      )}

      <div className="flex-shrink-0 px-4 pb-3">
        <div className="mx-auto max-w-md">
          <div className="rounded-[24px] p-4" style={{ background: pg.surface, border: `1px solid ${pg.line}` }}>
            <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: pg.lime }}>Delivery Progress</p>
            <div className="flex items-center justify-between">
              {STATUS_FLOW.filter((s, i, arr) => arr.findIndex(x => x.label === s.label) === i).map((step, i, arr) => {
                const reached = stepIndex > STATUS_FLOW.indexOf(step) || isDelivered || isCompleted
                const isCurrent = step.from === request.status || (request.status === 'confirmed' && step.from === 'accepted')
                const Icon = step.icon
                return (
                  <div key={`${step.label}-${i}`} className="flex flex-1 flex-col items-center relative">
                    {i > 0 && (
                      <div className="absolute right-1/2 top-3 h-0.5 w-full" style={{
                        background: reached ? pg.lime : pg.line,
                      }} />
                    )}
                    <div className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full"
                      style={{
                        background: reached ? pg.lime : isCurrent ? pg.limeDim : pg.surface2,
                        border: isCurrent ? `2px solid ${pg.lime}` : '2px solid transparent',
                      }}>
                      {reached ? <Icon size={13} className="text-black" /> : <div className="h-2 w-2 rounded-full bg-white/20" />}
                    </div>
                    <span className="mt-1 text-[8px] font-medium text-center leading-tight"
                      style={{ color: reached || isCurrent ? pg.lime : pg.text4 }}>
                      {step.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {['confirmed', 'shopping', 'purchased', 'on_the_way', 'accepted'].includes(request.status) && (
            <Surface className="mt-3 p-4">
              <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: pg.lime }}>Update ETA (minutes)</p>
              <div className="flex gap-2">
                <input type="number" min={1} max={120} value={etaMinutes ?? ''} onChange={e => setEtaMinutes(e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Enter minutes" className="input flex-1" />
                <CTA type="button" onClick={updateEta} disabled={!etaMinutes || updatingEta} className="!min-h-[48px] !px-5">
                  {updatingEta ? '...' : 'Update'}
                </CTA>
              </div>
            </Surface>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24" style={{ background: pg.bg }}>
        <div className="mx-auto max-w-md space-y-4">
          {userProfile && (
            <Surface className="p-4 animate-slide-up">
              <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: pg.text3 }}>Customer</div>
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-2xl bg-white/5 shrink-0">
                  {userProfile.photo_url ? (
                    <img src={userProfile.photo_url} alt={userProfile.full_name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/30"><UserIcon size={20} /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white truncate">{userProfile.full_name}</p>
                  <p className="text-xs text-white/40">{userProfile.phone || 'No phone'}</p>
                </div>
                <button type="button" onClick={() => { window.location.href = `tel:${userProfile.phone || ''}` }}
                  className="flex h-10 w-10 items-center justify-center rounded-xl active:scale-95 transition-transform shrink-0 disabled:opacity-30"
                  style={{ background: pg.limeDim, border: '1px solid rgba(212,240,0,0.25)', color: pg.lime }}
                  disabled={isCompleted}>
                  <Phone size={16} />
                </button>
                <button type="button" onClick={async () => {
                  const { data } = await supabase.from('chat_rooms').select('id').eq('request_id', requestId).maybeSingle()
                  if (data) navigate(`/dp/chat/${data.id}`)
                }} className="flex h-10 w-10 items-center justify-center rounded-xl active:scale-95 transition-transform shrink-0 disabled:opacity-30"
                  style={{ background: pg.lime, color: pg.limeText }}
                  disabled={isCompleted}>
                  <MessageCircle size={16} />
                </button>
              </div>
            </Surface>
          )}

          <Surface className="p-4 animate-slide-up">
            <div className="mb-3 flex items-center gap-2">
              <MapPin size={16} className="text-red-400" />
              <p className="text-sm font-bold text-white">Delivery Address</p>
            </div>
            <p className="text-sm text-white/80 mb-3 leading-relaxed">{request.delivery_address || 'Not specified'}</p>
            <CTA type="button" onClick={openGoogleMaps} className="w-full">
              <Navigation size={18} /> Open in Google Maps
            </CTA>
          </Surface>

          {request.pickup_address && (
            <Surface className="p-4 animate-slide-up">
              <div className="mb-2 flex items-center gap-2">
                <Store size={16} style={{ color: pg.lime }} />
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: pg.text3 }}>Pickup Location</p>
              </div>
              <p className="text-sm" style={{ color: pg.text2 }}>{request.pickup_address}</p>
            </Surface>
          )}

          {currentStep && (
            <Surface className="p-4 animate-slide-up">
              <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: pg.text3 }}>Update Status</p>
              <CTA type="button" onClick={() => updateStatus(currentStep.to, currentStep.notifTitle, currentStep.notifBody)} className="w-full">
                <currentStep.icon size={18} /> {currentStep.label}
              </CTA>
            </Surface>
          )}

          {isDelivered && (
            <Surface className="p-4 animate-slide-up">
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
            <Surface className="p-4 text-center animate-slide-up">
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
