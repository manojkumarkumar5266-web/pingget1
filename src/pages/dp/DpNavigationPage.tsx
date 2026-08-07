import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, type DeliveryRequest, type Profile, type DeliveryPartner } from '../../lib/supabase'
import { useAuth } from '../../context'
import { STATUS_LABELS } from '../../lib/utils'
import {
  ArrowLeft, Navigation, MapPin, MessageCircle, Package, CheckCircle2,
  ShoppingBag, Bike, Phone, Camera, X, Clock, Star, User as UserIcon, Store,
  TrendingUp, IndianRupee,
} from 'lucide-react'

const STATUS_FLOW: { from: string; to: string; label: string; notifTitle: string; notifBody: string; icon: any }[] = [
  { from: 'accepted', to: 'confirmed', label: 'Confirm Order', notifTitle: 'Order Confirmed', notifBody: 'Your delivery partner confirmed. They will start shopping soon.', icon: CheckCircle2 },
  { from: 'confirmed', to: 'shopping', label: 'Start Shopping', notifTitle: 'Shopping Started', notifBody: 'Your delivery partner is now shopping for your items.', icon: ShoppingBag },
  { from: 'shopping', to: 'purchased', label: 'Items Purchased', notifTitle: 'Items Purchased', notifBody: 'Items purchased! Your delivery partner is heading your way soon.', icon: Package },
  { from: 'purchased', to: 'on_the_way', label: 'On The Way', notifTitle: 'On The Way!', notifBody: 'Your delivery partner is heading to your location.', icon: Bike },
  { from: 'on_the_way', to: 'arrived', label: 'Mark Arrived', notifTitle: 'Partner Arrived', notifBody: 'Your delivery partner has arrived. Please be ready to receive.', icon: MapPin },
  { from: 'arrived', to: 'delivered', label: 'Mark Delivered', notifTitle: 'Order Delivered', notifBody: 'Your order has been delivered. Please confirm receipt in the app.', icon: CheckCircle2 },
]

export default function DpNavigationPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [request, setRequest] = useState<DeliveryRequest | null>(null)
  const [userProfile, setUserProfile] = useState<Profile | null>(null)
  const [dpData, setDpData] = useState<DeliveryPartner | null>(null)
  const [loading, setLoading] = useState(true)
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null)
  const [updatingEta, setUpdatingEta] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

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
        const { data: dp } = await supabase.from('delivery_partners').select('*').eq('user_id', profile.id).maybeSingle()
        setDpData(dp as DeliveryPartner | null)
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

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-black text-white/40">Loading...</div>
  if (!request) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black">
      <p className="text-white/50">Order not found</p>
      <button onClick={() => navigate('/dp')} className="btn-primary">Back</button>
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

  return (
    <div className="min-h-screen flex flex-col bg-black">
      {/* Top bar with phone + chat */}
      <div className="flex-shrink-0 px-4 pt-12 pb-2" style={{ background: 'linear-gradient(180deg, #0B0B0B, transparent)' }}>
        <div className="map-glass-panel flex items-center gap-3 p-3">
          <button onClick={() => navigate('/dp')} className="map-control-btn map-control-dark">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/50">Order Tracking</p>
            <p className="truncate text-sm font-bold text-white">{STATUS_LABELS[request.status] || request.status}</p>
          </div>

        </div>
      </div>

      {/* Top section: Progress milestones */}
      <div className="flex-shrink-0 px-4 pb-3" style={{ background: 'linear-gradient(180deg, #0B0B0B, #111)' }}>
        <div className="mx-auto max-w-md">
          {/* Horizontal progress steps */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider" style={{ color: '#C4D600' }}>Delivery Progress</p>
            <div className="flex items-center justify-between">
              {STATUS_FLOW.map((step, i) => {
                const reached = stepIndex > i || isDelivered || isCompleted
                const isCurrent = step.from === request.status
                const Icon = step.icon
                return (
                  <div key={i} className="flex flex-1 flex-col items-center relative">
                    {i > 0 && (
                      <div className="absolute right-1/2 top-3 h-0.5 w-full" style={{
                        background: reached ? '#C4D600' : 'rgba(255,255,255,0.1)',
                        transition: 'background 0.5s ease',
                      }} />
                    )}
                    <div className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full transition-all"
                      style={{
                        background: reached ? '#C4D600' : isCurrent ? 'rgba(196,214,0,0.2)' : 'rgba(255,255,255,0.05)',
                        border: isCurrent ? '2px solid #C4D600' : '2px solid transparent',
                        boxShadow: isCurrent ? '0 0 12px rgba(196,214,0,0.4)' : 'none',
                      }}>
                      {reached ? <Icon size={13} className="text-black" /> : <div className="h-2 w-2 rounded-full bg-white/20" />}
                    </div>
                    <span className="mt-1 text-[8px] font-medium text-center leading-tight"
                      style={{ color: reached || isCurrent ? '#C4D600' : 'rgba(255,255,255,0.25)' }}>
                      {step.label.replace('Mark ', '').replace('Start ', '').replace('Items ', '')}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ETA update */}
          {['confirmed', 'shopping', 'purchased', 'on_the_way'].includes(request.status) && (
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: '#C4D600' }}>Update ETA (minutes)</p>
              <div className="flex gap-2">
                <input type="number" min={1} max={120} value={etaMinutes ?? ''} onChange={e => setEtaMinutes(e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Enter minutes" className="input flex-1" style={{ borderColor: 'rgba(196,214,0,0.35)' }} />
                <button onClick={updateEta} disabled={!etaMinutes || updatingEta}
                  className="btn-primary disabled:opacity-40 px-5 font-bold" style={{ background: '#C4D600', color: '#0B0B0B' }}>
                  {updatingEta ? '...' : 'Update'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom section: scrollable - customer + address + status */}
      <div className="flex-1 overflow-y-auto bg-black px-4 py-4 pb-24">
        <div className="mx-auto max-w-md space-y-4">
          {/* Customer info card */}
          {userProfile && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 animate-slide-up">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">Customer</div>
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
                <button onClick={() => window.location.href = `tel:${userProfile.phone || ''}`}
                  className="flex h-10 w-10 items-center justify-center rounded-xl active:scale-95 transition-transform shrink-0 disabled:opacity-30"
                  style={{ background: 'rgba(166,179,0,0.12)', border: '1px solid rgba(166,179,0,0.25)', color: '#A6B300' }}
                  disabled={isCompleted}>
                  <Phone size={16} />
                </button>
                <button onClick={async () => {
                  const { data } = await supabase.from('chat_rooms').select('id').eq('request_id', requestId).maybeSingle()
                  if (data) navigate(`/dp/chat/${data.id}`)
                }} className="flex h-10 w-10 items-center justify-center rounded-xl text-black active:scale-95 transition-transform shrink-0 disabled:opacity-30"
                  style={{ background: '#A6B300' }}
                  disabled={isCompleted}>
                  <MessageCircle size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Delivery address with map */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 animate-slide-up">
            <div className="mb-3 flex items-center gap-2">
              <MapPin size={16} className="text-red-400" />
              <p className="text-sm font-bold text-white">Delivery Address</p>
            </div>
            <p className="text-sm text-white/80 mb-3 leading-relaxed">{request.delivery_address || 'Not specified'}</p>
            <button onClick={openGoogleMaps}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all active:scale-95"
              style={{ background: '#A6B300', color: '#0B0B0B' }}>
              <Navigation size={18} /> Open in Google Maps
            </button>
          </div>

          {/* Pickup details */}
          {request.pickup_address && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 animate-slide-up">
              <div className="mb-2 flex items-center gap-2">
                <Store size={16} style={{ color: '#A6B300' }} />
                <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Pickup Location</p>
              </div>
              <p className="text-sm text-white/80">{request.pickup_address}</p>
            </div>
          )}

          {/* Current status action button */}
          {currentStep && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 animate-slide-up">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">Update Status</p>
              <button onClick={() => updateStatus(currentStep.to, currentStep.notifTitle, currentStep.notifBody)}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white active:scale-95 transition-transform"
                style={{
                  background: currentStep.to === 'delivered' ? '#A6B300' : '#808000',
                  color: currentStep.to === 'delivered' ? '#0B0B0B' : '#fff',
                }}>
                <currentStep.icon size={18} /> {currentStep.label}
              </button>
            </div>
          )}

          {/* Delivery Photo Upload */}
          {isDelivered && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 animate-slide-up">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">Delivery Proof Photos</div>
              <input ref={photoInputRef} type="file" className="hidden" accept="image/*" multiple onChange={handlePhotosSelect} />
              {photoPreviews.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {photoPreviews.map((preview, idx) => (
                    <div key={idx} className="relative">
                      <img src={preview} alt={`Proof ${idx + 1}`} className="h-20 w-20 rounded-xl object-cover" />
                      <button onClick={() => removePhoto(idx)} className="absolute -right-1 -top-1 rounded-full bg-red-500 p-1 text-white shadow">
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => photoInputRef.current?.click()}
                className="w-full rounded-xl border-2 border-dashed py-3 text-sm font-medium text-white/50"
                style={{ borderColor: 'rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)' }}>
                <Camera size={18} className="mx-auto mb-1 text-white/60" />
                {photoPreviews.length > 0 ? 'Add More Photos' : 'Take Delivery Photos'}
              </button>
              {photoFiles.length > 0 && (
                <button onClick={uploadDeliveryPhotos} disabled={uploading} className="btn-primary mt-2 w-full disabled:opacity-40">
                  {uploading ? 'Uploading...' : `Save ${photoFiles.length} Photo${photoFiles.length === 1 ? '' : 's'}`}
                </button>
              )}
            </div>
          )}

          {isDelivered && !isCompleted && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center animate-slide-up">
              <Clock size={24} className="mx-auto mb-2 animate-pulse" style={{ color: '#A6B300' }} />
              <p className="font-bold text-white">Waiting for customer to accept delivery</p>
              <p className="mt-1 text-xs text-white/40">You'll be able to go home once the customer confirms receipt</p>
            </div>
          )}

          {/* Accept Payment after customer marks Payment Completed */}
          {(request as any).payment_completed_at && !(request as any).payment_accepted_at && (
            <div className="rounded-2xl p-4" style={{ border: '1px solid rgba(196,214,0,0.35)', background: 'rgba(196,214,0,0.08)' }}>
              <p className="mb-3 text-sm font-bold" style={{ color: '#C4D600' }}>Customer marked payment completed</p>
              <button
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
                  navigate('/dp')
                }}
                className="w-full rounded-2xl py-3.5 text-sm font-bold"
                style={{ background: '#C4D600', color: '#0B0B0B' }}
              >
                Accept Payment
              </button>
            </div>
          )}

          {isCompleted && (
            <button onClick={() => navigate('/dp')}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold active:scale-95 transition-transform"
              style={{ background: '#A6B300', color: '#0B0B0B' }}>
              <CheckCircle2 size={18} /> Delivery Confirmed — Go Home
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
