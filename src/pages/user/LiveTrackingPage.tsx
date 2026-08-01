import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, type DeliveryRequest, type Profile, type DeliveryPartner } from '../../lib/supabase'
import { useAuth } from '../../context'
import { STATUS_LABELS } from '../../lib/utils'
import VisualTracking, { STATUS_PROGRESS, STATUS_ETA } from '../../components/VisualTracking'
import { ArrowLeft, Phone, MessageCircle, Star, Clock, Bike, PackageCheck, MapPin, Car, Truck, Navigation } from 'lucide-react'

function vehicleIcon(v: string | null | undefined) {
  const s = (v || '').toLowerCase()
  if (s === 'bicycle' || s === 'motorbike' || s === 'scooter' || s === 'auto') return Bike
  if (s === 'car') return Car
  return Truck
}

export default function LiveTrackingPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [request, setRequest] = useState<DeliveryRequest | null>(null)
  const [dpProfile, setDpProfile] = useState<Profile | null>(null)
  const [dpData, setDpData] = useState<DeliveryPartner | null>(null)
  const [loading, setLoading] = useState(true)
  const [showRating, setShowRating] = useState(false)
  const [ratingStars, setRatingStars] = useState(0)
  const [ratingFeedback, setRatingFeedback] = useState('')
  const [ratingSubmitting, setRatingSubmitting] = useState(false)

  useEffect(() => {
    if (!requestId) return
    const fetchData = async () => {
      const { data: req } = await supabase.from('requests').select('*').eq('id', requestId).maybeSingle()
      if (!req) { setLoading(false); return }
      setRequest(req as DeliveryRequest)
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
          setRequest(payload.new as DeliveryRequest)
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

  const confirmDelivery = async () => {
    await supabase.from('requests').update({ status: 'completed' }).eq('id', requestId)
    await supabase.from('orders').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('request_id', requestId)
    await supabase.from('notifications').insert({
      user_id: request?.accepted_dp_id,
      title: 'Delivery Confirmed',
      body: 'Customer confirmed receipt. The order is now complete.',
      type: 'order_completed',
      related_id: requestId,
    })
    setShowRating(true)
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
      }
    } catch {
      // ignore
    } finally {
      setRatingSubmitting(false)
      navigate('/app')
    }
  }

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

  const isCancelled = request.status === 'cancelled'
  const isPending = request.status === 'pending'
  const isCompleted = request.status === 'completed' || request.status === 'delivered' || request.status === 'cash_received'
  const isDelivered = request.status === 'delivered' || request.status === 'cash_received'
  const progress = STATUS_PROGRESS[request.status] ?? 0
  const etaLabel = STATUS_ETA[request.status] ?? '--'
  const etaMinutes = (request as any).eta_minutes
  const VehicleIcon = vehicleIcon(dpData?.vehicle_type)

  // Mandatory rating overlay
  if (showRating) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black px-6">
        <div className="w-full max-w-sm animate-slide-up">
          <div className="rounded-3xl p-7 text-center" style={{ background: '#181818', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl" style={{ background: 'rgba(166,179,0,0.12)', border: '1px solid rgba(166,179,0,0.25)' }}>
              <Star size={30} style={{ color: '#A6B300' }} />
            </div>
            <h2 className="mb-1 text-xl font-bold text-white">Rate Your Delivery</h2>
            <p className="mb-6 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              How was {dpProfile?.full_name?.split(' ')[0] || 'your partner'}'s service?
            </p>

            <div className="mb-5 flex items-center justify-center gap-3">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setRatingStars(n)} className="transition-transform active:scale-90">
                  <Star size={36} fill={n <= ratingStars ? '#FBBF24' : 'none'}
                    className={n <= ratingStars ? 'text-[#A6B300]' : 'text-white/20'} />
                </button>
              ))}
            </div>

            <textarea
              value={ratingFeedback}
              onChange={e => setRatingFeedback(e.target.value)}
              placeholder="Write a comment (optional)..."
              rows={3}
              className="input mb-5 w-full resize-none text-sm"
            />

            <button
              onClick={submitRating}
              disabled={ratingStars === 0 || ratingSubmitting}
              className="btn-primary w-full disabled:opacity-40"
            >
              {ratingSubmitting ? 'Submitting...' : 'Submit Rating'}
            </button>
            <p className="mt-3 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Rating is mandatory — feedback is optional</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Top bar with phone + chat — in normal flow so it doesn't cover tracking */}
      <div className="flex-shrink-0 px-4 pt-12 pb-2" style={{ background: 'linear-gradient(180deg, #0B0B0B, transparent)' }}>
        <div className="map-glass-panel flex items-center gap-3 p-3">
          <button onClick={() => navigate('/app')} className="map-control-btn map-control-dark">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/50">Order Tracking</p>
            <p className="truncate text-sm font-bold text-white">{STATUS_LABELS[request.status] || request.status}</p>
          </div>
          {dpProfile && !isCompleted && (
            <button onClick={() => window.location.href = `tel:${dpProfile.phone || ''}`}
              className="map-control-btn map-control-dark">
              <Phone size={18} />
            </button>
          )}
          {dpProfile && !isCompleted && (
            <button onClick={async () => {
              const { data } = await supabase.from('chat_rooms').select('id').eq('request_id', requestId).maybeSingle()
              if (data) navigate(`/app/chat/${data.id}`)
            }} className="map-control-btn map-control-dark">
              <MessageCircle size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Top section: Visual tracking wave */}
      <div className="relative flex-shrink-0" style={{ height: '48vh', minHeight: '300px' }}>
        {isPending ? (
          <div className="flex h-full flex-col items-center justify-center bg-black px-6">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <Clock size={28} className="animate-pulse" style={{ color: '#A6B300' }} />
            </div>
            <p className="text-lg font-bold text-white">Waiting for partner</p>
            <p className="mt-1 text-center text-sm text-white/40">Your request is live. A partner will accept shortly.</p>
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
            eta={etaMinutes ? `${etaMinutes} min` : etaLabel}
          />
        )}
      </div>

      {/* Bottom section: DP info + delivery details */}
      <div className="flex-1 overflow-y-auto bg-black px-4 py-4">
        <div className="mx-auto max-w-md">
          {/* DP rating, vehicle, ETA row */}
          {dpProfile && !isCancelled && !isPending && (
            <>
              {/* Stats row: rating | vehicle | ETA */}
              <div className="mb-3 grid grid-cols-3 gap-2.5 animate-slide-up">
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
                  <p className="text-base font-bold text-white">{etaMinutes ? `${etaMinutes}m` : etaLabel}</p>
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>ETA</p>
                </div>
              </div>

              {/* DP photo + name + call/chat */}
              <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4 animate-slide-up">
                <div className="flex items-center gap-3">
                  <div className="relative h-16 w-16 overflow-hidden rounded-2xl bg-white/5 shrink-0">
                    {dpProfile.photo_url ? (
                      <img src={dpProfile.photo_url} alt={dpProfile.full_name || ''} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-white/30">
                        <Bike size={24} />
                      </div>
                    )}
                    <div className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-black" style={{ background: '#22c55e' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white truncate">{dpProfile.full_name}</p>
                    <p className="text-xs text-white/40 capitalize">{dpData?.vehicle_type || 'Bike'} Partner</p>
                  </div>
                  {!isCompleted && (
                    <button onClick={() => window.location.href = `tel:${dpProfile.phone || ''}`}
                      className="flex h-11 w-11 items-center justify-center rounded-xl active:scale-95 transition-transform shrink-0"
                      style={{ background: 'rgba(166,179,0,0.12)', border: '1px solid rgba(166,179,0,0.25)', color: '#A6B300' }}>
                      <Phone size={18} />
                    </button>
                  )}
                  {!isCompleted && (
                    <button onClick={async () => {
                      const { data } = await supabase.from('chat_rooms').select('id').eq('request_id', requestId).maybeSingle()
                      if (data) navigate(`/app/chat/${data.id}`)
                    }} className="flex h-11 w-11 items-center justify-center rounded-xl text-black active:scale-95 transition-transform shrink-0"
                      style={{ background: 'linear-gradient(135deg, #a8c020, #808000)' }}>
                      <MessageCircle size={18} />
                    </button>
                  )}
                </div>
              </div>

              {/* Delivery address card */}
              <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4 animate-slide-up">
                <div className="mb-2 flex items-center gap-2">
                  <MapPin size={16} className="text-red-400" />
                  <p className="text-xs font-bold uppercase tracking-wider text-white/60">Delivery Address</p>
                </div>
                <p className="text-sm text-white/80 leading-relaxed">{request.delivery_address || 'Not specified'}</p>
              </div>
            </>
          )}

          {/* Pending: cancel button */}
          {isPending && (
            <button onClick={async () => {
              await supabase.from('requests').update({ status: 'cancelled' }).eq('id', requestId)
              navigate('/app')
            }} className="w-full rounded-2xl py-3 text-sm font-semibold text-red-400 active:scale-95"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              Cancel Request
            </button>
          )}

          {/* Delivered: delivery proof photos + accept delivery */}
          {isDelivered && (
            <div className="mb-4 rounded-2xl border border-green-500/20 bg-green-500/5 p-4 animate-slide-up">
              {(request as any)?.delivery_proof_photos && (request as any).delivery_proof_photos.length > 0 && (
                <div className="mb-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">Delivery Proof Photos</p>
                  <div className="flex flex-wrap gap-2">
                    {(request as any).delivery_proof_photos.map((url: string, i: number) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt={`Proof ${i + 1}`} className="h-20 w-20 rounded-xl object-cover border border-white/10" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-green-500/15">
                  <PackageCheck size={20} className="text-green-400" />
                </div>
                <div>
                  <p className="font-bold text-white">Order has been delivered!</p>
                  <p className="text-xs text-white/40">Confirm receipt to complete the order</p>
                </div>
              </div>
              <button onClick={confirmDelivery}
                className="w-full rounded-2xl py-3.5 text-sm font-bold text-white active:scale-95 transition-transform"
                style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>
                Accept Delivery
              </button>
            </div>
          )}

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
