import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, type DeliveryRequest, type Profile } from '../../lib/supabase'
import { useAuth } from '../../context'
import { STATUS_LABELS } from '../../lib/utils'
import VisualTracking, { STATUS_PROGRESS, STATUS_ETA } from '../../components/VisualTracking'
import { ArrowLeft, Navigation, MapPin, MessageCircle, Package, CheckCircle2, ShoppingBag, Bike, Phone } from 'lucide-react'

const TRACKING_STEPS = [
  { key: 'accepted', label: 'Order Accepted', icon: CheckCircle2 },
  { key: 'confirmed', label: 'Quotation Confirmed', icon: CheckCircle2 },
  { key: 'shopping', label: 'Shopping', icon: ShoppingBag },
  { key: 'purchased', label: 'Items Purchased', icon: Package },
  { key: 'on_the_way', label: 'On The Way', icon: Bike },
  { key: 'arrived', label: 'Arrived', icon: MapPin },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
]

export default function DpNavigationPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [request, setRequest] = useState<DeliveryRequest | null>(null)
  const [userProfile, setUserProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!requestId) return
    const fetchData = async () => {
      const { data: req } = await supabase
        .from('requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle()
      if (!req) { setLoading(false); return }
      setRequest(req as DeliveryRequest)

      if (req.user_id) {
        const { data: userProf } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', req.user_id)
          .maybeSingle()
        setUserProfile(userProf as Profile | null)
      }
      setLoading(false)
    }
    fetchData()

    const channel = supabase
      .channel(`dp-nav-${requestId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'requests',
        filter: `id=eq.${requestId}`,
      }, (payload: any) => {
        setRequest(payload.new as DeliveryRequest)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [requestId])

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-black text-white/40">Loading...</div>
  }

  if (!request) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black">
        <p className="text-white/50">Order not found</p>
        <button onClick={() => navigate('/dp')} className="btn-primary">Back</button>
      </div>
    )
  }

  const currentStepIndex = TRACKING_STEPS.findIndex(s => s.key === request.status)
  const progress = STATUS_PROGRESS[request.status] ?? 0
  const eta = STATUS_ETA[request.status] ?? '--'

  const updateStatus = async (newStatus: string, notifTitle: string, notifBody: string) => {
    await supabase.from('requests').update({ status: newStatus }).eq('id', requestId)
    await supabase.from('orders').update({ status: newStatus }).eq('request_id', requestId)
    await supabase.from('notifications').insert({
      user_id: request.user_id,
      title: notifTitle,
      body: notifBody,
      type: 'order_status',
      related_id: requestId,
    })
  }

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
            <button onClick={() => window.location.href = `tel:${userProfile.phone || ''}`}
              className="map-control-btn map-control-dark">
              <Phone size={18} />
            </button>
          )}
          <button onClick={async () => {
            const { data } = await supabase.from('chat_rooms').select('id').eq('request_id', requestId).maybeSingle()
            if (data) navigate(`/dp/chat/${data.id}`)
          }} className="map-control-btn map-control-dark">
            <MessageCircle size={18} />
          </button>
          <button onClick={() => {
            if (request.delivery_lat && request.delivery_lng) {
              window.open(`https://www.openstreetmap.org/directions?to=${request.delivery_lat},${request.delivery_lng}`, '_blank')
            }
          }} className="map-control-btn map-control-active">
            <Navigation size={18} />
          </button>
        </div>
      </div>

      {/* Top half: Visual tracking */}
      <div className="relative flex-shrink-0" style={{ height: '52vh', minHeight: '320px' }}>
        <VisualTracking
          progress={progress}
          status={request.status}
          dpName={profile?.full_name}
          pickupLabel={request.pickup_address?.split(',')[0] || 'Store'}
          deliveryLabel={request.delivery_address?.split(',')[0] || 'Customer'}
          eta={eta}
        />
      </div>

      {/* Bottom half: Status updates panel */}
      <div className="flex-1 overflow-y-auto bg-black px-4 py-4">
        <div className="mx-auto max-w-md">
          {/* Customer info */}
          {userProfile && (
            <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4 animate-slide-up">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 overflow-hidden rounded-2xl bg-white/5">
                  {userProfile.photo_url ? (
                    <img src={userProfile.photo_url} alt={userProfile.full_name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/30">
                      <MapPin size={20} />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-white">{userProfile.full_name}</p>
                  <p className="text-xs text-white/40">{userProfile.phone || 'No phone'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Delivery addresses */}
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4">
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

          {/* Timeline */}
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">Live Updates</div>
            <div className="space-y-0">
              {TRACKING_STEPS.map((step, idx) => {
                const Icon = step.icon
                const isCompleted = idx < currentStepIndex
                const isActive = idx === currentStepIndex
                const isLast = idx === TRACKING_STEPS.length - 1
                return (
                  <div key={step.key} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                        isCompleted ? 'bg-green-500/15' : isActive ? 'bg-amber-500/15' : 'bg-white/5'
                      }`}>
                        <Icon size={14} className={
                          isCompleted ? 'text-green-400' : isActive ? 'text-amber-400 animate-pulse' : 'text-white/30'
                        } />
                      </div>
                      {!isLast && <div className={`w-0.5 ${isCompleted ? 'bg-green-500/30' : 'bg-white/10'}`} style={{ minHeight: 28 }} />}
                    </div>
                    <div className="pb-4 pt-1.5">
                      <p className={`text-sm font-medium ${
                        isActive ? 'text-white' : isCompleted ? 'text-white/70' : 'text-white/40'
                      }`}>
                        {step.label}
                      </p>
                      {isActive && <p className="text-xs text-amber-400/80 mt-0.5">In progress...</p>}
                    </div>
                  </div>
                )
              })}
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
              {(request.status === 'delivered' || request.status === 'completed') && (
                <button onClick={async () => {
                  if (request.status === 'delivered') {
                    await supabase.from('requests').update({ status: 'completed' }).eq('id', requestId)
                    await supabase.from('orders').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('request_id', requestId)
                  }
                  navigate('/dp')
                }} className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white active:scale-95 transition-transform"
                  style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>
                  <CheckCircle2 size={18} /> {request.status === 'completed' ? 'Back to Dashboard' : 'Complete & Go Home'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
