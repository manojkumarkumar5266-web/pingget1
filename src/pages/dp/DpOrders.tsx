import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase, DeliveryRequest } from '../../lib/supabase'
import { EmptyState, StatusBadge, SkeletonCard, Tabs } from '../../components/ui'
import { formatTime, formatCurrency } from '../../lib/utils'
import { ClipboardList, Clock, MapPin, MessageCircle, Lock, Package, Camera, Wallet, Navigation, XCircle, Play, CalendarClock, CreditCard, CheckCircle2 } from 'lucide-react'
import DeliveryProofUploader from '../../components/DeliveryProofUploader'

type Tab = 'active' | 'completed' | 'cancelled'

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
    if (tab === 'active') {
      query = query.in('status', ['accepted', 'confirmed', 'shopping', 'purchased', 'on_the_way', 'arrived', 'delivered', 'cash_received', 'dp_reserved', 'waiting_payment', 'payment_verified', 'booking_confirmed', 'task_started'])
    } else if (tab === 'completed') {
      query = query.eq('status', 'completed')
    } else {
      query = query.eq('status', 'cancelled')
    }
    const { data } = await query.order('created_at', { ascending: false })
    setOrders((data as DeliveryRequest[]) || [])
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

  const cancelOrder = async (req: DeliveryRequest) => {
    if (!confirm('Cancel this order? This cannot be undone.')) return
    setUpdating(req.id)
    await supabase.from('requests').update({ status: 'cancelled' }).eq('id', req.id)
    await supabase.from('orders').update({ status: 'cancelled' }).eq('request_id', req.id)
    await supabase.from('notifications').insert({
      user_id: req.user_id, title: 'Order Cancelled',
      body: 'Your delivery partner had to cancel this order.',
      type: 'order_status', related_id: req.id,
    })
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

  return (
    <div className="mx-auto max-w-md px-4 py-4">
      <h1 className="mb-4 text-xl font-bold text-white">My Deliveries</h1>

      {pendingCommission > 0 && (
        <button onClick={() => navigate('/dp/wallet')}
          className="mb-4 flex w-full items-center gap-3 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-left dark:border-warning-900/40 dark:bg-warning-950/30">
          <Wallet size={20} className="shrink-0 text-warning-600 dark:text-warning-400" />
          <div className="flex-1">
            <p className="text-sm font-bold text-warning-700 dark:text-warning-300">Commission Due: {formatCurrency(pendingCommission)}</p>
            <p className="text-xs text-warning-600 dark:text-warning-400">Tap to pay admin via UPI</p>
          </div>
        </button>
      )}

      <div className="mb-4">
        <Tabs
          tabs={[
            { key: 'active', label: 'Active' },
            { key: 'completed', label: 'Completed' },
            { key: 'cancelled', label: 'Cancelled' },
          ]}
          active={tab}
          onChange={(k) => setTab(k as Tab)}
        />
      </div>

      {loading ? (
        <div className="space-y-3"><SkeletonCard lines={4} /><SkeletonCard lines={4} /></div>
      ) : orders.length === 0 ? (
        <EmptyState icon={<ClipboardList size={48} />} title={`No ${tab} deliveries`} />
      ) : (
        <div className="space-y-3">
          {orders.map((req, i) => {
            const chatClosed = ['delivered', 'cash_received', 'completed'].includes(req.status)
            const canNavigate = ['confirmed', 'shopping', 'purchased', 'on_the_way', 'arrived', 'delivered'].includes(req.status)
            const canUploadProof = ['arrived', 'delivered', 'cash_received'].includes(req.status)
            const awaitingUser = req.status === 'delivered' || req.status === 'cash_received'

            return (
              <div key={req.id} className="card p-4 animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white">{req.description?.split('\n')[0]?.trim() || 'Delivery Request'}</p>
                    <p className="mt-0.5 line-clamp-1 text-sm text-white/50">{req.delivery_address}</p>
                  </div>
                  <StatusBadge status={req.status} />
                </div>

                <div className="mt-2 flex items-center gap-4 text-xs text-white/40">
                  <span className="flex items-center gap-1"><Clock size={12} /> {formatTime(req.created_at)}</span>
                  {req.max_budget && <span className="font-medium text-gray-600 dark:text-gray-300">{formatCurrency(req.max_budget)}</span>}
                  <span className="flex items-center gap-1"><MapPin size={12} /> {req.delivery_address?.slice(0, 20)}</span>
                </div>

                {req.status === 'accepted' && (
                  <div className="mt-3 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2.5 dark:border-primary-900/40 dark:bg-primary-950/30">
                    <p className="text-xs font-semibold text-primary-700 dark:text-primary-300">Open Chat to agree on price with the customer</p>
                  </div>
                )}
                {req.order_type === 'advance' && ['dp_reserved','waiting_payment','payment_verified','booking_confirmed'].includes(req.status) && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: 'rgba(166,179,0,0.08)', border: '1px solid rgba(166,179,0,0.2)' }}>
                    <CalendarClock size={14} style={{ color: '#A6B300' }} />
                    <p className="text-xs font-medium" style={{ color: '#A6B300' }}>
                      {req.request_category} · {req.scheduled_date} at {req.scheduled_slot || req.scheduled_time}
                    </p>
                  </div>
                )}
                {req.order_type === 'advance' && req.status === 'waiting_payment' && (
                  <div className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <CreditCard size={12} style={{ color: '#f59e0b' }} />
                    <p className="text-xs" style={{ color: '#f59e0b' }}>Waiting for customer's advance payment confirmation</p>
                  </div>
                )}

                {awaitingUser && (
                  <div className="mt-3 flex items-center justify-center rounded-xl bg-warning-50 px-3 py-2.5 text-xs font-medium text-warning-700 dark:bg-warning-950/30 dark:text-warning-300 animate-pulse-soft">
                    Waiting for customer to confirm delivery...
                  </div>
                )}

                {canUploadProof && !req.delivery_proof_url && (
                  <button
                    onClick={() => setProofReqId(req.id)}
                    className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary-300 bg-primary-50 py-2.5 text-sm font-semibold text-primary-700 transition-all active:scale-[0.98] dark:border-primary-700 dark:bg-primary-900/20 dark:text-primary-300"
                  >
                    <Camera size={16} /> Upload Delivery Proof
                  </button>
                )}
                {req.delivery_proof_url && (
                  <div className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-success-50 px-3 py-2.5 text-xs font-medium text-success-700 dark:bg-success-950/30 dark:text-success-300">
                    <Camera size={14} /> Delivery proof uploaded
                  </div>
                )}

                {req.status !== 'completed' && req.status !== 'cancelled' && (
                  <div className="mt-3 flex gap-2">
                    {req.status === 'accepted' && (
                      <button onClick={() => cancelOrder(req)} disabled={updating === req.id}
                        className="rounded-xl border border-error-200 bg-error-50 px-3 py-2.5 text-xs font-semibold text-error-700 transition-all active:scale-[0.98] disabled:opacity-60 dark:border-error-900/40 dark:bg-error-950/30 dark:text-error-300">
                        <XCircle size={14} />
                      </button>
                    )}
                    {chatClosed ? (
                      <div className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-gray-100 px-3 py-2.5 text-xs font-medium text-white/40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-600">
                        <Lock size={13} /> Chat Closed
                      </div>
                    ) : (
                      <button onClick={() => goToChat(req)} className="btn-secondary flex-1 gap-1.5 text-sm">
                        <MessageCircle size={15} /> Chat
                      </button>
                    )}
                    {canNavigate && (
                      <button onClick={() => navigate(`/dp/navigate/${req.id}`)} className="btn-primary flex-1 gap-1.5 text-sm">
                        <Navigation size={15} /> Navigate
                      </button>
                    )}
                    {req.order_type === 'advance' && req.status === 'booking_confirmed' && (
                      <button onClick={async () => {
                        setUpdating(req.id)
                        await supabase.from('requests').update({ status: 'task_started', task_started_at: new Date().toISOString() }).eq('id', req.id)
                        await supabase.from('notifications').insert({ user_id: req.user_id, title: 'Task Started', body: 'Your delivery partner has started the task. Live tracking is now enabled.', type: 'task_started', related_id: req.id })
                        setUpdating(null)
                        fetchOrders()
                      }} disabled={updating === req.id}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg, #A6B300, #808000)', color: '#0B0B0B' }}>
                        <Play size={14} /> Start Task
                      </button>
                    )}
                    {req.order_type === 'advance' && req.status === 'task_started' && (
                      <button onClick={() => navigate(`/dp/navigate/${req.id}`)} className="btn-primary flex-1 gap-1.5 text-sm">
                        <Navigation size={15} /> Live Tracking
                      </button>
                    )}
                    {req.order_type === 'advance' && req.status === 'task_started' && (
                      <button onClick={async () => {
                        setUpdating(req.id)
                        await supabase.from('requests').update({ status: 'task_completed', task_completed_at: new Date().toISOString() }).eq('id', req.id)
                        await supabase.from('notifications').insert({ user_id: req.user_id, title: 'Task Completed', body: 'Your delivery partner has completed the task.', type: 'task_completed', related_id: req.id })
                        setUpdating(null)
                        fetchOrders()
                      }} disabled={updating === req.id}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
                        style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }}>
                        <CheckCircle2 size={14} /> Complete Task
                      </button>
                    )}
                  </div>
                )}
              </div>
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
    </div>
  )
}
