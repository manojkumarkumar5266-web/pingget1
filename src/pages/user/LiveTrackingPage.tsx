import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, type DeliveryRequest, type Profile, type DeliveryPartner } from '../../lib/supabase'
import { useAuth } from '../../context'
import { STATUS_LABELS } from '../../lib/utils'
import VisualTracking, { STATUS_PROGRESS, STATUS_ETA } from '../../components/VisualTracking'
import { ArrowLeft, Phone, MessageCircle, Star, MapPin, Clock, Bike, CheckCircle2, Package, PackageCheck, ShoppingBag, Store, Home } from 'lucide-react'

const TRACKING_STEPS = [
  { key: 'accepted', label: 'Order Accepted', icon: CheckCircle2 },
  { key: 'confirmed', label: 'Quotation Confirmed', icon: CheckCircle2 },
  { key: 'shopping', label: 'Partner Shopping', icon: ShoppingBag },
  { key: 'purchased', label: 'Items Purchased', icon: Package },
  { key: 'on_the_way', label: 'Partner On The Way', icon: Bike },
  { key: 'arrived', label: 'Partner Arrived', icon: MapPin },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
]

export default function LiveTrackingPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [request, setRequest] = useState<DeliveryRequest | null>(null)
  const [dpProfile, setDpProfile] = useState<Profile | null>(null)
  const [dpData, setDpData] = useState<DeliveryPartner | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!requestId) return
    let dpId: string | null = null

    const fetchData = async () => {
      const { data: req } = await supabase
        .from('requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle()
      if (!req) { setLoading(false); return }
      setRequest(req as DeliveryRequest)
      dpId = req.accepted_dp_id

      if (req.accepted_dp_id) {
        const { data: dpProf } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', req.accepted_dp_id)
          .maybeSingle()
        setDpProfile(dpProf as Profile | null)

        const { data: dp } = await supabase
          .from('delivery_partners')
          .select('*')
          .eq('user_id', req.accepted_dp_id)
          .maybeSingle()
        setDpData(dp as DeliveryPartner | null)
      }
      setLoading(false)
    }
    fetchData()

    const channel = supabase
      .channel(`tracking-${requestId}`)
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="animate-pulse text-white/40">Loading tracking...</div>
      </div>
    )
  }

  if (!request) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black">
        <p className="text-white/50">Order not found</p>
        <button onClick={() => navigate('/app')} className="btn-primary">Back Home</button>
      </div>
    )
  }

  const currentStepIndex = TRACKING_STEPS.findIndex(s => s.key === request.status)
  const isCancelled = request.status === 'cancelled'
  const isPending = request.status === 'pending'
  const isDelivered = request.status === 'delivered' || request.status === 'cash_received'
  const progress = STATUS_PROGRESS[request.status] ?? 0
  const eta = STATUS_ETA[request.status] ?? '--'

  const confirmDelivery = async () => {
    await supabase.from('requests').update({ status: 'completed' }).eq('id', requestId)
    await supabase.from('orders').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('request_id', requestId)
    await supabase.from('notifications').insert({
      user_id: request.accepted_dp_id,
      title: 'Delivery Confirmed',
      body: 'Customer confirmed receipt. The order is now complete.',
      type: 'order_completed',
      related_id: requestId,
    })
    navigate('/app')
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Top bar */}
      <div className="absolute left-0 right-0 top-0 z-[1000] px-4 pt-12">
        <div className="map-glass-panel flex items-center gap-3 p-3">
          <button onClick={() => navigate('/app')} className="map-control-btn map-control-dark">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <p className="text-xs text-white/50">Order Tracking</p>
            <p className="text-sm font-bold text-white">{STATUS_LABELS[request.status] || request.status}</p>
          </div>
          {dpProfile && (
            <div className="flex items-center gap-2">
              <button onClick={() => window.location.href = `tel:${dpProfile.phone || ''}`}
                className="map-control-btn map-control-dark">
                <Phone size={18} />
              </button>
              <button onClick={async () => {
                const { data } = await supabase.from('chat_rooms').select('id').eq('request_id', requestId).maybeSingle()
                if (data) navigate(`/app/chat/${data.id}`)
              }} className="map-control-btn map-control-dark">
                <MessageCircle size={18} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Top half: Visual tracking */}
      <div className="relative flex-shrink-0" style={{ height: '52vh', minHeight: '320px' }}>
        {isPending ? (
          <div className="flex h-full flex-col items-center justify-center bg-black px-6">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10">
              <Clock size={28} className="animate-pulse text-amber-400" />
            </div>
            <p className="text-lg font-bold text-white">Waiting for partner</p>
            <p className="mt-1 text-center text-sm text-white/40">Your request is live. Chat will open automatically when a partner accepts.</p>
          </div>
        ) : isCancelled ? (
          <div className="flex h-full flex-col items-center justify-center bg-black px-6">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10">
              <PackageCheck size={28} className="text-red-400" />
            </div>
            <p className="text-lg font-bold text-white">Order Cancelled</p>
            <button onClick={() => navigate('/app')} className="btn-primary mt-4">Back Home</button>
          </div>
        ) : (
          <VisualTracking
            progress={progress}
            status={request.status}
            dpName={dpProfile?.full_name}
            pickupLabel={request.pickup_address?.split(',')[0] || 'Store'}
            deliveryLabel={request.delivery_address?.split(',')[0] || 'You'}
            eta={eta}
          />
        )}
      </div>

      {/* Bottom half: Status updates panel */}
      <div className="flex-1 overflow-y-auto bg-black px-4 py-4">
        <div className="mx-auto max-w-md">
          {/* Pending state */}
          {isPending && (
            <button onClick={async () => {
              await supabase.from('requests').update({ status: 'cancelled' }).eq('id', requestId)
              navigate('/app')
            }} className="w-full rounded-2xl py-3 text-sm font-semibold text-red-400 active:scale-95"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              Cancel Request
            </button>
          )}

          {/* DP info card */}
          {dpProfile && !isCancelled && !isPending && (
            <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4 animate-slide-up">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-2xl bg-white/5">
                  {dpProfile.photo_url ? (
                    <img src={dpProfile.photo_url} alt={dpProfile.full_name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/30">
                      <Bike size={24} />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-white">{dpProfile.full_name}</p>
                  <div className="flex items-center gap-2 text-xs text-white/40">
                    <span className="flex items-center gap-0.5">
                      <Star size={12} className="text-yellow-400" />
                      {dpData?.rating_avg?.toFixed(1) || '0.0'}
                    </span>
                    <span>·</span>
                    <span className="capitalize">{dpData?.vehicle_type || 'Bike'}</span>
                  </div>
                </div>
                <button onClick={async () => {
                  const { data } = await supabase.from('chat_rooms').select('id').eq('request_id', requestId).maybeSingle()
                  if (data) navigate(`/app/chat/${data.id}`)
                }} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-black active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #a8c020, #808000)' }}>
                  <MessageCircle size={16} /> Chat
                </button>
              </div>
            </div>
          )}

          {/* Accept Delivery button */}
          {isDelivered && (
            <div className="mb-4 rounded-2xl border border-green-500/20 bg-green-500/5 p-4 animate-slide-up">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-green-500/15">
                  <PackageCheck size={20} className="text-green-400" />
                </div>
                <div>
                  <p className="font-bold text-white">Order has been delivered!</p>
                  <p className="text-xs text-white/40">Confirm receipt to complete the order</p>
                </div>
              </div>
              <button
                onClick={confirmDelivery}
                className="w-full rounded-2xl py-3.5 text-sm font-bold text-white active:scale-95 transition-transform"
                style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}
              >
                Accept Delivery
              </button>
            </div>
          )}

          {/* Timeline removed — status shown at top */}

          {/* Cancelled state */}
          {isCancelled && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-center">
              <p className="font-semibold text-red-400">Order Cancelled</p>
              <button onClick={() => navigate('/app')} className="btn-primary mt-3">Back Home</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
