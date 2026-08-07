import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, type DeliveryRequest, type Profile, type DeliveryPartner } from '../../lib/supabase'
import { useAuth } from '../../context'
import { STATUS_LABELS } from '../../lib/utils'
import VisualTracking, { STATUS_PROGRESS, STATUS_ETA } from '../../components/VisualTracking'
import { Images } from '../../lib/customImages'
import { ArrowLeft, Phone, MessageCircle, Star, Clock, Bike, PackageCheck, MapPin, Car, Truck } from 'lucide-react'

function vehicleIcon(v: string | null | undefined) {
  const s = (v || '').toLowerCase()
  if (s === 'bicycle' || s === 'motorbike' || s === 'scooter' || s === 'auto') return Bike
  if (s === 'car') return Car
  return Truck
}

type PayPhase = 'idle' | 'awaiting_user_payment' | 'awaiting_dp_accept' | 'rating' | 'thanks'

export default function LiveTrackingPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [request, setRequest] = useState<DeliveryRequest | null>(null)
  const [dpProfile, setDpProfile] = useState<Profile | null>(null)
  const [dpData, setDpData] = useState<DeliveryPartner | null>(null)
  const [loading, setLoading] = useState(true)
  const [payPhase, setPayPhase] = useState<PayPhase>('idle')
  const [ratingStars, setRatingStars] = useState(0)
  const [ratingFeedback, setRatingFeedback] = useState('')
  const [ratingSubmitting, setRatingSubmitting] = useState(false)
  const [liveEta, setLiveEta] = useState<number | null>(null)
  const etaRef = useRef<number | null>(null)
  const etaStartRef = useRef<number>(Date.now())

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
          // DP accepted payment → user goes to rating
          if ((next as any).payment_accepted_at && payPhase !== 'rating' && payPhase !== 'thanks') {
            setPayPhase('rating')
          }
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

  useEffect(() => {
    const baseEta = (request as any)?.eta_minutes
    if (!baseEta || baseEta <= 0) { setLiveEta(null); return }
    if (etaRef.current !== baseEta) {
      etaRef.current = baseEta
      etaStartRef.current = Date.now()
      setLiveEta(baseEta)
    }
    const status = request?.status
    if (status === 'arrived' || status === 'delivered' || status === 'completed' || status === 'cash_received') {
      setLiveEta(0)
      return
    }
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - etaStartRef.current) / 60000)
      setLiveEta(Math.max(0, baseEta - elapsed))
    }, 5000)
    return () => clearInterval(interval)
  }, [(request as any)?.eta_minutes, request?.status])

  const confirmDelivery = async () => {
    await supabase.from('requests').update({ status: 'completed' }).eq('id', requestId)
    await supabase.from('orders').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('request_id', requestId)
    setPayPhase('awaiting_user_payment')
  }

  const markPaymentCompleted = async () => {
    // Soft-flag for DP (column may not exist — ignore error)
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
  const progress = STATUS_PROGRESS[request.status] ?? 0
  const etaLabel = STATUS_ETA[request.status] ?? '--'
  const VehicleIcon = vehicleIcon(dpData?.vehicle_type)

  if (payPhase === 'thanks') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black px-6">
        <img src={Images.thankYouRating} alt="Thank you for rating" className="w-full max-w-sm object-contain mb-4" draggable={false} />
        <p className="text-sm text-white/50">Returning home...</p>
      </div>
    )
  }

  if (payPhase === 'rating') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black px-6 overflow-y-auto py-8">
        <div className="w-full max-w-sm">
          <img src={Images.paymentReceived} alt="Thank you payment received" className="w-full object-contain mb-4 rounded-2xl" draggable={false} />
          <div className="rounded-3xl p-6 text-center" style={{ background: '#181818', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h2 className="mb-1 text-xl font-bold text-white">Rate Your Delivery</h2>
            <p className="mb-5 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              How was {dpProfile?.full_name?.split(' ')[0] || 'your partner'}'s service?
            </p>
            <div className="mb-5 flex items-center justify-center gap-3">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" onClick={() => setRatingStars(n)} className="active:scale-90">
                  <Star size={36} fill={n <= ratingStars ? '#FBBF24' : 'none'}
                    className={n <= ratingStars ? 'text-[#A6B300]' : 'text-white/20'} />
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
            <button type="button" onClick={submitRating} disabled={ratingStars === 0 || ratingSubmitting}
              className="btn-primary w-full disabled:opacity-40">
              {ratingSubmitting ? 'Submitting...' : 'Confirm Rating & Feedback'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-black">
      {/* Minimal top — no ribbon */}
      <div className="flex-shrink-0 px-4 pt-12 pb-2">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate('/app')} className="map-control-btn map-control-dark">
            <ArrowLeft size={18} />
          </button>
          <p className="text-sm font-semibold text-white/80">Order tracking</p>
        </div>
      </div>

      <div className="relative flex-shrink-0" style={{ height: '38vh', minHeight: '240px' }}>
        {isPending ? (
          <div className="flex h-full flex-col items-center justify-center bg-black px-6">
            <img src={Images.userWaiting} alt="" className="w-40 h-40 object-contain mb-3" />
            <p className="text-lg font-bold text-white">Waiting for partner</p>
          </div>
        ) : isCancelled ? (
          <div className="flex h-full flex-col items-center justify-center bg-black px-6">
            <p className="text-lg font-bold text-white">Order Cancelled</p>
            <button type="button" onClick={() => navigate('/app')} className="btn-primary mt-4">Back Home</button>
          </div>
        ) : (
          <VisualTracking
            progress={progress}
            status={request.status}
            dpName={dpProfile?.full_name}
            pickupLabel={request.pickup_address?.split(',')[0] || 'Store'}
            deliveryLabel={request.delivery_address?.split(',')[0] || 'You'}
          />
        )}
      </div>

      <div className="flex-1 overflow-y-auto bg-black px-4 py-4 pb-24">
        <div className="mx-auto max-w-md">
          {dpProfile && !isCancelled && !isPending && (
            <>
              <div className="mb-3 grid grid-cols-3 gap-2.5">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
                  <div className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'rgba(251,191,36,0.15)' }}>
                    <Star size={16} style={{ color: '#A6B300' }} fill="#A6B300" />
                  </div>
                  <p className="text-base font-bold text-white">{dpData?.rating_avg?.toFixed(1) || '0.0'}</p>
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{dpData?.rating_count || 0} reviews</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
                  <div className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'rgba(166,179,0,0.15)' }}>
                    <VehicleIcon size={16} style={{ color: '#A6B300' }} />
                  </div>
                  <p className="text-base font-bold text-white capitalize">{dpData?.vehicle_type || 'Bike'}</p>
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Vehicle</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
                  <div className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'rgba(59,130,246,0.15)' }}>
                    <Clock size={16} style={{ color: '#A6B300' }} />
                  </div>
                  <p className="text-base font-bold text-white">{liveEta !== null ? (liveEta === 0 ? '0m' : `${liveEta}m`) : etaLabel}</p>
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>ETA</p>
                </div>
              </div>

              <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4">
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
                        style={{ background: 'rgba(166,179,0,0.12)', border: '1px solid rgba(166,179,0,0.25)', color: '#A6B300' }}>
                        <Phone size={18} />
                      </button>
                      <button type="button" onClick={async () => {
                        const { data } = await supabase.from('chat_rooms').select('id').eq('request_id', requestId).maybeSingle()
                        if (data) navigate(`/app/chat/${data.id}`)
                      }} className="flex h-11 w-11 items-center justify-center rounded-xl text-black shrink-0"
                        style={{ background: 'linear-gradient(135deg, #a8c020, #808000)' }}>
                        <MessageCircle size={18} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <MapPin size={16} className="text-red-400" />
                  <p className="text-xs font-bold uppercase tracking-wider text-white/60">Delivery Address</p>
                </div>
                <p className="text-sm text-white/80 leading-relaxed">{request.delivery_address || 'Not specified'}</p>
              </div>
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
              <button type="button" onClick={confirmDelivery}
                className="w-full rounded-2xl py-3.5 text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>
                Accept Delivery
              </button>
            </div>
          )}

          {(payPhase === 'awaiting_user_payment' || (request.status === 'completed' && payPhase === 'idle')) && (
            <div className="mb-4 rounded-2xl p-4" style={{ border: '1px solid rgba(166,179,0,0.3)', background: 'rgba(166,179,0,0.08)' }}>
              <p className="mb-3 text-sm text-white/70">Confirm you have paid your partner.</p>
              <button type="button" onClick={markPaymentCompleted}
                className="w-full rounded-2xl py-3.5 text-sm font-bold"
                style={{ background: '#A6B300', color: '#0B0B0B' }}>
                Payment Completed
              </button>
            </div>
          )}

          {payPhase === 'awaiting_dp_accept' && (
            <div className="mb-4 rounded-2xl p-4 text-center" style={{ border: '1px solid rgba(166,179,0,0.25)', background: 'rgba(166,179,0,0.06)' }}>
              <p className="font-semibold text-white">Waiting for partner to Accept Payment…</p>
              <p className="mt-1 text-xs text-white/45">You will rate the delivery next</p>
            </div>
          )}

          {isCancelled && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-center">
              <p className="font-semibold text-red-400">Order Cancelled</p>
              <button type="button" onClick={() => navigate('/app')} className="btn-primary mt-3">Back Home</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
