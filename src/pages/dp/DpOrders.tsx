import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase, DeliveryRequest } from '../../lib/supabase'
import { StatusBadge, SkeletonList } from '../../components/ui'
import { formatTime, formatCurrency } from '../../lib/utils'
import { Screen, PageTitle, Surface, CTA, Chip, EmptyBlock } from '../../design/primitives'
import { pg } from '../../design/tokens'
import {
  Clock, MessageCircle, Lock, Camera, Wallet, Navigation,
  Play, CalendarClock, CreditCard, ChevronRight, Handshake,
} from 'lucide-react'
import DeliveryProofUploader from '../../components/DeliveryProofUploader'

type Tab = 'active' | 'reserved' | 'completed' | 'cancelled'

const TABS: { key: Tab; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'reserved', label: 'Reserved' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
]

const INSTANT_ACTIVE = [
  'accepted', 'confirmed', 'shopping', 'purchased', 'on_the_way', 'arrived', 'delivered', 'cash_received',
]

const ADVANCE_RESERVED = [
  'searching_dp', 'scheduled', 'rescheduled', 'dp_reserved', 'waiting_payment', 'payment_verified',
  'booking_confirmed', 'task_started', 'confirmed', 'shopping', 'purchased', 'on_the_way', 'arrived',
  'delivered', 'cash_received',
]

export default function DpOrders() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('active')
  const [orders, setOrders] = useState<DeliveryRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [proofReqId, setProofReqId] = useState<string | null>(null)
  const [pendingCommission, setPendingCommission] = useState(0)

  const fetchOrders = useCallback(async () => {
    let query = supabase.from('requests').select('*')
      .or(`accepted_dp_id.eq.${profile!.id},reserved_dp_id.eq.${profile!.id}`)

    if (tab === 'active' || tab === 'reserved') {
      const statuses = tab === 'active' ? INSTANT_ACTIVE : ADVANCE_RESERVED
      query = query.in('status', statuses)
    } else if (tab === 'completed') {
      query = query.eq('status', 'completed')
    } else {
      query = query.eq('status', 'cancelled')
    }

    const { data } = await query.order('created_at', { ascending: false })
    let rows = (data as DeliveryRequest[]) || []
    if (tab === 'active') {
      rows = rows.filter(r => r.order_type !== 'advance')
    } else if (tab === 'reserved') {
      rows = rows.filter(r => r.order_type === 'advance')
    }
    setOrders(rows)
    setLoading(false)
  }, [profile, tab])

  useEffect(() => {
    setLoading(true)
    fetchOrders()
  }, [fetchOrders])

  useEffect(() => {
    const channel = supabase
      .channel('dp-orders-live')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'requests',
        filter: `accepted_dp_id=eq.${profile!.id}`,
      }, () => fetchOrders())
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'requests',
        filter: `reserved_dp_id=eq.${profile!.id}`,
      }, () => fetchOrders())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile, fetchOrders])

  useEffect(() => {
    const checkCommission = async () => {
      const [ordersRes, confirmedRes] = await Promise.all([
        supabase.from('orders').select('commission_amount').eq('dp_id', profile!.id).eq('status', 'completed'),
        supabase.from('dp_commission_receipts').select('amount').eq('dp_user_id', profile!.id).eq('status', 'confirmed'),
      ])
      const totalOwed = (ordersRes.data || []).reduce((s: number, o: any) => s + Number(o.commission_amount || 0), 0)
      const totalPaid = (confirmedRes.data || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0)
      setPendingCommission(Math.max(0, totalOwed - totalPaid))
    }
    checkCommission()
  }, [profile, orders])

  const requestMutualCancel = async (req: DeliveryRequest) => {
    const pendingFromUser = req.cancel_requested_by === 'user'
    const msg = pendingFromUser
      ? 'Agree to cancel this advance booking with the customer?'
      : 'Request cancel? Advance bookings need both sides to agree. The customer must confirm.'
    if (!confirm(msg)) return
    setUpdating(req.id)
    const { data, error } = await supabase.rpc('request_mutual_cancel', {
      p_request_id: req.id,
      p_reason: pendingFromUser ? 'DP agreed to cancel' : 'DP requested cancel',
    })
    if (error) alert(error.message)
    else if (data && !(data as any).success) alert((data as any).error || 'Could not update cancel request')
    setUpdating(null)
    fetchOrders()
  }

  const goToChat = async (req: DeliveryRequest) => {
    const { data: rooms } = await supabase
      .from('chat_rooms').select('id').eq('request_id', req.id)
      .order('created_at', { ascending: true }).limit(1)
    if (rooms && rooms.length > 0) { navigate(`/dp/chat/${rooms[0].id}`); return }
    const { data: newRoom } = await supabase.from('chat_rooms')
      .insert({ request_id: req.id, user_id: req.user_id, dp_id: profile!.id })
      .select('id').single()
    if (newRoom) navigate(`/dp/chat/${newRoom.id}`)
  }

  const emptyBody =
    tab === 'active' ? 'Instant orders you accept show up here.'
      : tab === 'reserved' ? 'Advance bookings you reserve appear here until completed.'
        : undefined

  return (
    <Screen className="mx-auto max-w-lg animate-fade-in-up">
      <PageTitle eyebrow="Partner" title="My deliveries" />

      {pendingCommission > 0 && (
        <button
          type="button"
          onClick={() => navigate('/dp/wallet')}
          className="mb-5 flex w-full items-center gap-3 rounded-[22px] px-4 py-3.5 text-left transition active:scale-[0.99]"
          style={{ background: 'rgba(245,165,36,0.12)', border: '1px solid rgba(245,165,36,0.25)' }}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: 'rgba(245,165,36,0.16)' }}>
            <Wallet size={20} className="text-amber-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-amber-200">Commission due: {formatCurrency(pendingCommission)}</p>
            <p className="text-xs" style={{ color: pg.text3 }}>Tap to pay admin via UPI</p>
          </div>
          <ChevronRight size={18} style={{ color: pg.text4 }} />
        </button>
      )}

      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className="rounded-full px-4 py-2 text-sm font-extrabold transition active:scale-95"
            style={tab === t.key
              ? { background: pg.limeDim, border: `1px solid rgba(196,214,0,0.35)`, color: pg.lime }
              : { background: pg.surface2, border: `1px solid ${pg.line}`, color: pg.text3 }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonList count={3} lines={4} />
      ) : orders.length === 0 ? (
        <EmptyBlock title={`No ${tab} deliveries`} body={emptyBody} />
      ) : (
        <div className="space-y-3 pb-4">
          {orders.map(req => {
            const chatClosed = ['delivered', 'cash_received', 'completed'].includes(req.status)
            const canNavigate = ['confirmed', 'shopping', 'purchased', 'on_the_way', 'arrived', 'delivered', 'task_started'].includes(req.status)
            const canUploadProof = ['arrived', 'delivered', 'cash_received'].includes(req.status)
            const awaitingUser = req.status === 'delivered' || req.status === 'cash_received'
            const isAdvance = req.order_type === 'advance'
            const cancelPendingFromUser = isAdvance && req.cancel_requested_by === 'user'
            const cancelPendingFromDp = isAdvance && req.cancel_requested_by === 'dp'
            const canMutualCancel = isAdvance && !['cancelled', 'completed', 'expired'].includes(req.status)

            return (
              <Surface key={req.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-extrabold">
                      {req.description?.split('\n')[0]?.trim() || 'Delivery Request'}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs" style={{ color: pg.text3 }}>{req.delivery_address}</p>
                  </div>
                  <StatusBadge status={req.status} />
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs" style={{ color: pg.text4 }}>
                  <span className="flex items-center gap-1"><Clock size={12} /> {formatTime(req.created_at)}</span>
                  {req.max_budget != null && (
                    <span className="font-extrabold" style={{ color: pg.text2 }}>{formatCurrency(req.max_budget)}</span>
                  )}
                  {isAdvance && <Chip tone="info">Advance</Chip>}
                  {!isAdvance && <Chip>Instant</Chip>}
                </div>

                {req.status === 'accepted' && !isAdvance && (
                  <div
                    className="mt-3 rounded-2xl px-3.5 py-2.5 text-xs font-extrabold"
                    style={{ background: pg.limeDim, border: `1px solid rgba(196,214,0,0.22)`, color: pg.lime }}
                  >
                    Open chat to agree on price — tracking starts after customer accepts quotation
                  </div>
                )}

                {isAdvance && ['dp_reserved', 'waiting_payment', 'payment_verified', 'booking_confirmed'].includes(req.status) && (
                  <div
                    className="mt-3 flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-xs font-medium"
                    style={{ background: pg.limeDim, border: `1px solid rgba(196,214,0,0.2)`, color: pg.lime }}
                  >
                    <CalendarClock size={14} />
                    {req.request_category} · {req.scheduled_date} at {req.scheduled_slot || req.scheduled_time}
                  </div>
                )}

                {isAdvance && req.status === 'waiting_payment' && (
                  <div
                    className="mt-2 flex items-center gap-2 rounded-2xl px-3 py-2 text-xs"
                    style={{ background: 'rgba(245,165,36,0.1)', border: '1px solid rgba(245,165,36,0.22)', color: '#FCD34D' }}
                  >
                    <CreditCard size={12} />
                    Waiting for customer's advance payment confirmation
                  </div>
                )}

                {cancelPendingFromUser && (
                  <div
                    className="mt-3 rounded-2xl px-3.5 py-2.5 text-xs font-extrabold"
                    style={{ background: 'rgba(255,92,92,0.12)', border: '1px solid rgba(255,92,92,0.25)', color: '#FCA5A5' }}
                  >
                    Customer requested cancel — tap Agree to cancel to confirm
                  </div>
                )}
                {cancelPendingFromDp && (
                  <div
                    className="mt-3 rounded-2xl px-3.5 py-2.5 text-xs font-extrabold"
                    style={{ background: 'rgba(245,165,36,0.1)', border: '1px solid rgba(245,165,36,0.22)', color: '#FCD34D' }}
                  >
                    Waiting for customer to agree to cancel
                  </div>
                )}

                {awaitingUser && (
                  <div
                    className="mt-3 flex items-center justify-center rounded-2xl px-3 py-2.5 text-xs font-extrabold animate-pulse"
                    style={{ background: 'rgba(245,165,36,0.1)', color: '#FCD34D', border: '1px solid rgba(245,165,36,0.2)' }}
                  >
                    Waiting for customer to confirm delivery…
                  </div>
                )}

                {canUploadProof && !req.delivery_proof_url && (
                  <CTA
                    variant="secondary"
                    className="mt-3 w-full min-h-[44px] border-2 border-dashed text-sm"
                    style={{ borderColor: 'rgba(196,214,0,0.35)' }}
                    onClick={() => setProofReqId(req.id)}
                  >
                    <Camera size={16} /> Upload delivery proof
                  </CTA>
                )}

                {req.delivery_proof_url && (
                  <div
                    className="mt-3 flex items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-xs font-extrabold"
                    style={{ background: 'rgba(34,197,94,0.12)', color: '#86EFAC', border: '1px solid rgba(34,197,94,0.25)' }}
                  >
                    <Camera size={14} /> Delivery proof uploaded
                  </div>
                )}

                {req.status !== 'completed' && req.status !== 'cancelled' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {chatClosed ? (
                      <div
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl px-3 py-2.5 text-xs font-extrabold"
                        style={{ background: pg.surface2, border: `1px solid ${pg.line}`, color: pg.text4 }}
                      >
                        <Lock size={13} /> Chat closed
                      </div>
                    ) : (
                      <CTA
                        className="min-h-[44px] flex-1 text-sm"
                        variant={req.status === 'accepted' || req.status === 'dp_reserved' ? undefined : 'secondary'}
                        onClick={() => goToChat(req)}
                      >
                        <MessageCircle size={15} /> Chat
                      </CTA>
                    )}

                    {canNavigate && (
                      <CTA className="min-h-[44px] flex-1 text-sm" onClick={() => navigate(`/dp/navigate/${req.id}`)}>
                        <Navigation size={15} /> Track order
                      </CTA>
                    )}

                    {isAdvance && req.status === 'booking_confirmed' && (
                      <CTA
                        className="min-h-[44px] flex-1 text-sm"
                        onClick={async () => {
                          setUpdating(req.id)
                          const now = new Date().toISOString()
                          const { data: existingOrder } = await supabase
                            .from('orders')
                            .select('id')
                            .eq('request_id', req.id)
                            .maybeSingle()
                          if (!existingOrder) {
                            const deliveryCharge = Number(req.max_budget || 0)
                            const commissionPct = 10
                            const commissionAmount = Math.round(deliveryCharge * commissionPct / 100)
                            await supabase.from('orders').insert({
                              request_id: req.id,
                              user_id: req.user_id,
                              dp_id: profile!.id,
                              items_summary: req.description?.split('\n')[0]?.trim() || req.request_category || 'Advance booking',
                              item_cost: 0,
                              delivery_charge: deliveryCharge,
                              commission_pct: commissionPct,
                              commission_amount: commissionAmount,
                              dp_earnings: deliveryCharge - commissionAmount,
                              status: 'confirmed',
                            })
                          }
                          await supabase.from('requests').update({
                            status: 'confirmed',
                            task_started_at: now,
                          }).eq('id', req.id)
                          await supabase.from('notifications').insert({
                            user_id: req.user_id,
                            title: 'Task Started',
                            body: 'Your delivery partner has started the task. Live tracking is now enabled.',
                            type: 'task_started',
                            related_id: req.id,
                          })
                          setUpdating(null)
                          navigate(`/dp/navigate/${req.id}`, { replace: true })
                        }}
                        disabled={updating === req.id}
                      >
                        <Play size={14} /> Start task
                      </CTA>
                    )}

                    {isAdvance && req.status === 'task_started' && (
                      <CTA className="min-h-[44px] flex-1 text-sm" onClick={() => navigate(`/dp/navigate/${req.id}`)}>
                        <Navigation size={15} /> Live tracking
                      </CTA>
                    )}

                    {canMutualCancel && (
                      <CTA
                        variant={cancelPendingFromUser ? 'danger' : 'secondary'}
                        className="min-h-[44px] w-full text-sm"
                        disabled={updating === req.id || cancelPendingFromDp}
                        onClick={() => requestMutualCancel(req)}
                      >
                        <Handshake size={14} />
                        {cancelPendingFromUser ? 'Agree to cancel' : cancelPendingFromDp ? 'Cancel requested…' : 'Request cancel'}
                      </CTA>
                    )}
                  </div>
                )}
              </Surface>
            )
          })}
        </div>
      )}

      {proofReqId && (
        <DeliveryProofUploader
          requestId={proofReqId}
          userId={profile!.id}
          onUploaded={() => fetchOrders()}
          onClose={() => setProofReqId(null)}
        />
      )}
    </Screen>
  )
}
