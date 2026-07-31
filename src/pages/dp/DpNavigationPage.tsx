import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, type DeliveryRequest, type Profile, type DeliveryPartner } from '../../lib/supabase'
import { useAuth } from '../../context'
import { STATUS_LABELS } from '../../lib/utils'
import { ArrowLeft, Navigation, MapPin, MessageCircle, Package, CheckCircle2, ShoppingBag, Bike, Phone, Camera, X, Clock, Star } from 'lucide-react'

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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Top bar */}
      <div className="absolute left-0 right-0 top-0 z-[1000] px-4 pt-12">
        <div className="map-glass-panel flex items-center gap-3 p-3">
          <button onClick={() => navigate('/dp')} className="map-control-btn map-control-dark">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <p className="text-xs text-white/50">Navigation</p>
            <p className="text-sm font-bold text-white">{STATUS_LABELS[request.status] || request.status}</p>
          </div>
          {userProfile && (
            <button onClick={() => window.location.href = `tel:${userProfile.phone || ''}`} className="map-control-btn map-control-dark">
              <Phone size={18} />
            </button>
          )}
          <button onClick={async () => {
            const { data } = await supabase.from('chat_rooms').select('id').eq('request_id', requestId).maybeSingle()
            if (data) navigate(`/dp/chat/${data.id}`)
          }} className="map-control-btn map-control-dark">
            <MessageCircle size={18} />
          </button>
        </div>
      </div>

      {/* Top section: Delivery location summary (no map) */}
      <div className="flex-shrink-0 pt-20 px-4 pb-4" style={{ background: 'linear-gradient(180deg, #0B0B0B, #111)' }}>
        <div className="mx-auto max-w-md">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex items-center gap-2">
              <MapPin size={16} className="text-red-400" />
              <p className="text-sm font-bold text-white">Delivery Location</p>
            </div>
            <p className="text-sm text-white/70 mb-3">{request.delivery_address || 'Not specified'}</p>
            <button onClick={openGoogleMaps}
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', boxShadow: '0 4px 16px rgba(59,130,246,0.3)' }}>
              <Navigation size={18} /> Navigate with Google Maps
            </button>
          </div>

          {/* ETA update */}
          {['confirmed', 'shopping', 'purchased', 'on_the_way'].includes(request.status) && (
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">Update ETA</p>
              <div className="flex gap-2">
                <input type="number" min={1} max={120} value={etaMinutes ?? ''} onChange={e => setEtaMinutes(e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Minutes" className="input flex-1" />
                <button onClick={updateEta} disabled={!etaMinutes || updatingEta}
                  className="btn-primary disabled:opacity-40" style={{ background: '#A6B300', color: '#0B0B0B' }}>
                  {updatingEta ? '...' : 'Update'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom section: Customer + delivery details + status controls */}
      <div className="flex-1 overflow-y-auto bg-black px-4 py-4">
        <div className="mx-auto max-w-md space-y-4">
          {/* Customer info */}
          {userProfile && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 animate-slide-up">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">Customer Details</div>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 overflow-hidden rounded-2xl bg-white/5">
                  {userProfile.photo_url ? (
                    <img src={userProfile.photo_url} alt={userProfile.full_name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/30"><MapPin size={20} /></div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-white">{userProfile.full_name}</p>
                  <p className="text-xs text-white/40">{userProfile.phone || 'No phone'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Delivery Details */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">Delivery Details</div>
            <div className="space-y-3">
              {request.pickup_address && (
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: 'rgba(168,192,32,0.1)' }}>
                    <ShoppingBag size={14} style={{ color: '#a8c020' }} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-white/40">Pickup</p>
                    <p className="text-sm text-white/80">{request.pickup_address}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: 'rgba(239,68,68,0.1)' }}>
                  <MapPin size={14} className="text-red-400" />
                </div>
                <div>
                  <p className="text-[10px] uppercase text-white/40">Destination</p>
                  <p className="text-sm text-white/80">{request.delivery_address || 'Not specified'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Status update buttons */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">Update Delivery Status</div>
            <div className="space-y-2">
              {request.status === 'accepted' && (
                <button onClick={() => updateStatus('confirmed', 'Order Confirmed', 'Your delivery partner confirmed. They will start shopping soon.')}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white active:scale-95 transition-transform"
                  style={{ background: 'linear-gradient(135deg, #808000, #606000)' }}>
                  <Package size={18} /> Confirm Order
                </button>
              )}
              {request.status === 'confirmed' && (
                <button onClick={() => updateStatus('shopping', 'Shopping Started', 'Your delivery partner is now shopping for your items.')}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white active:scale-95 transition-transform"
                  style={{ background: 'linear-gradient(135deg, #808000, #606000)' }}>
                  <ShoppingBag size={18} /> Start Shopping
                </button>
              )}
              {request.status === 'shopping' && (
                <button onClick={() => updateStatus('purchased', 'Items Purchased', 'Items purchased! Your delivery partner is heading your way soon.')}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white active:scale-95 transition-transform"
                  style={{ background: 'linear-gradient(135deg, #808000, #606000)' }}>
                  <Package size={18} /> Items Purchased
                </button>
              )}
              {request.status === 'purchased' && (
                <button onClick={() => updateStatus('on_the_way', 'On The Way!', 'Your delivery partner is heading to your location.')}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white active:scale-95 transition-transform"
                  style={{ background: 'linear-gradient(135deg, #808000, #606000)' }}>
                  <Bike size={18} /> On The Way
                </button>
              )}
              {request.status === 'on_the_way' && (
                <button onClick={() => updateStatus('arrived', 'Partner Arrived', 'Your delivery partner has arrived. Please be ready to receive.')}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white active:scale-95 transition-transform"
                  style={{ background: 'linear-gradient(135deg, #808000, #606000)' }}>
                  <MapPin size={18} /> Mark Arrived
                </button>
              )}
              {request.status === 'arrived' && (
                <button onClick={() => updateStatus('delivered', 'Order Delivered', 'Your order has been delivered. Please confirm receipt in the app.')}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white active:scale-95 transition-transform"
                  style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>
                  <CheckCircle2 size={18} /> Mark Delivered
                </button>
              )}
            </div>
          </div>

          {/* Delivery Photo Upload */}
          {isDelivered && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
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

          {isDelivered && (
            <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4 text-center">
              <Clock size={24} className="mx-auto mb-2 text-yellow-400 animate-pulse" />
              <p className="font-bold text-white">Waiting for customer to accept delivery</p>
              <p className="mt-1 text-xs text-white/40">You'll be able to go home once the customer confirms receipt</p>
            </div>
          )}

          {isCompleted && (
            <button onClick={() => navigate('/dp')}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white active:scale-95 transition-transform"
              style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>
              <CheckCircle2 size={18} /> Delivery Confirmed — Go Home
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
