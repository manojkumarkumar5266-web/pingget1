import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase, DeliveryRequest } from '../../lib/supabase'
import { EmptyState, StatusBadge, SkeletonCard, Tabs } from '../../components/ui'
import { formatTime, formatCurrency, STATUS_LABELS } from '../../lib/utils'
import { ClipboardList, Clock, MapPin, MessageCircle, Lock, Package, Camera, Wallet } from 'lucide-react'
import DeliveryProofUploader from '../../components/DeliveryProofUploader'

type Tab = 'active' | 'completed' | 'cancelled'

const ORDER_FLOW = ['confirmed', 'shopping', 'purchased', 'on_the_way', 'arrived', 'delivered', 'completed']
const DP_ACTION_STATUSES = ['confirmed', 'shopping', 'purchased', 'on_the_way', 'arrived']

const STEP_NOTIFICATIONS: Record<string, { title: string; body: string }> = {
  shopping: { title: 'Shopping Started', body: 'Your delivery partner is now shopping for your items.' },
  purchased: { title: 'Items Purchased', body: 'Items purchased! Delivery is on the way soon.' },
  on_the_way: { title: 'On The Way!', body: 'Your delivery partner is heading to your location.' },
  arrived: { title: 'Partner Arrived', body: 'Your delivery partner has arrived. Please be ready to receive.' },
  delivered: { title: 'Order Delivered', body: 'Your order has been delivered. Please confirm receipt in the app.' },
}

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
    let query = supabase.from('requests').select('*').eq('accepted_dp_id', profile!.id)
    if (tab === 'active') {
      query = query.in('status', ['accepted', 'confirmed', 'shopping', 'purchased', 'on_the_way', 'arrived', 'delivered', 'cash_received'])
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

  const cancelOrder = async (req: DeliveryRequest, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Cancel this order? This cannot be undone.')) return
    setUpdating(req.id)
    await supabase.from('requests').update({ status: 'cancelled' }).eq('id', req.id)
    await supabase.from('orders').update({ status: 'cancelled' }).eq('request_id', req.id)
    await supabase.from('notifications').insert({
      user_id: req.user_id,
      title: 'Order Cancelled',
      body: 'Your delivery partner had to cancel this order.',
      type: 'order_status',
      related_id: req.id,
    })
    setUpdating(null)
    fetchOrders()
  }

  const advanceStatus = async (req: DeliveryRequest, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!DP_ACTION_STATUSES.includes(req.status)) return
    const currentIdx = ORDER_FLOW.indexOf(req.status)
    const nextStatus = ORDER_FLOW[currentIdx + 1]
    if (!nextStatus) return
    setUpdating(req.id)
    await supabase.from('requests').update({ status: nextStatus }).eq('id', req.id)
    await supabase.from('orders').update({ status: nextStatus }).eq('request_id', req.id)
    if (STEP_NOTIFICATIONS[nextStatus]) {
      const n = STEP_NOTIFICATIONS[nextStatus]
      await supabase.from('notifications').insert({
        user_id: req.user_id, title: n.title, body: n.body,
        type: 'order_status', related_id: req.id,
      })
    }
    setUpdating(null)
    fetchOrders()
  }

  const goToChat = async (req: DeliveryRequest, e: React.MouseEvent) => {
    e.stopPropagation()
    const { data: rooms, error } = await supabase
      .from('chat_rooms').select('id').eq('request_id', req.id)
      .order('created_at', { ascending: true }).limit(1)
    if (error) { alert('Failed to open chat. Please try again.'); return }
    if (rooms && rooms.length > 0) { navigate(`/dp/chat/${rooms[0].id}`); return }
    const { data: newRoom, error: createError } = await supabase
      .from('chat_rooms')
      .insert({ request_id: req.id, user_id: req.user_id, dp_id: profile!.id })
      .select('id').single()
    if (createError || !newRoom) { alert('Unable to open chat. Please try again.'); return }
    navigate(`/dp/chat/${newRoom.id}`)
  }

  return (
    <div className="mx-auto max-w-md px-4 py-4">
      <h1 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">My Deliveries</h1>

      {pendingCommission > 0 && (
        <button onClick={() => navigate('/dp/wallet')} className="mb-4 flex w-full items-center gap-3 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-left dark:border-warning-900/40 dark:bg-warning-950/30 animate-slide-up">
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
        <div className="space-y-3">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
        </div>
      ) : orders.length === 0 ? (
        <EmptyState icon={<ClipboardList size={48} />} title={`No ${tab} deliveries`} />
      ) : (
        <div className="space-y-3">
          {orders.map((req, i) => {
            const displayStatus = req.status === 'cash_received' ? 'delivered' : req.status
            const statusIdx = ORDER_FLOW.indexOf(displayStatus)
            const isActionable = DP_ACTION_STATUSES.includes(req.status)
            const nextStatus = isActionable ? ORDER_FLOW[ORDER_FLOW.indexOf(req.status) + 1] : null
            const isUpdating = updating === req.id
            const awaitingUser = req.status === 'delivered' || req.status === 'cash_received'
            const chatClosed = req.status === 'delivered' || req.status === 'cash_received'
            const canUploadProof = req.status === 'arrived' || req.status === 'delivered' || req.status === 'cash_received'

            return (
              <div key={req.id} className="card p-4 animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white">{req.title}</p>
                    <p className="mt-0.5 line-clamp-1 text-sm text-gray-500 dark:text-gray-400">{req.delivery_address}</p>
                  </div>
                  <StatusBadge status={req.status} />
                </div>

                <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Clock size={12} /> {formatTime(req.created_at)}</span>
                  {req.max_budget && <span className="font-medium text-gray-600 dark:text-gray-300">{formatCurrency(req.max_budget)}</span>}
                  <span className="flex items-center gap-1"><MapPin size={12} /> {req.radius_meters}m</span>
                </div>

                {req.status === 'accepted' && (
                  <div className="mt-3 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2.5 dark:border-primary-900/40 dark:bg-primary-950/30">
                    <p className="text-xs font-semibold text-primary-700 dark:text-primary-300">Next step</p>
                    <p className="mt-0.5 text-xs text-primary-600 dark:text-primary-400">
                      Open Chat, agree on price with the customer. Once they confirm the order, tracking controls will appear here.
                    </p>
                  </div>
                )}

                {req.status === 'confirmed' && (
                  <div className="mt-3 rounded-xl border border-accent-200 bg-accent-50 px-3 py-2.5 dark:border-accent-900/40 dark:bg-accent-950/30">
                    <p className="text-xs font-semibold text-accent-700 dark:text-accent-300">Customer confirmed — start shopping!</p>
                  </div>
                )}

                {statusIdx !== -1 && (
                  <div className="mt-3 rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-800/50">
                    <div className="flex items-center">
                      {ORDER_FLOW.map((s, i) => (
                        <div key={s} className="flex flex-1 items-center">
                          <div className={`h-2.5 w-2.5 shrink-0 rounded-full border-2 transition-all ${
                            i < statusIdx ? 'border-primary-500 bg-primary-500' :
                            i === statusIdx ? 'border-primary-500 bg-white dark:bg-gray-800' :
                            'border-gray-300 bg-gray-200 dark:border-gray-600 dark:bg-gray-700'
                          }`} />
                          {i < ORDER_FLOW.length - 1 && (
                            <div className={`h-0.5 flex-1 transition-all ${i < statusIdx ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="mt-1.5 flex">
                      {ORDER_FLOW.map((s, i) => (
                        <span key={s} className={`flex-1 text-center text-[9px] font-semibold ${
                          i === statusIdx ? 'text-primary-600 dark:text-primary-400' :
                          i < statusIdx ? 'text-primary-500' : 'text-gray-400'
                        }`}>
                          {STATUS_LABELS[s]?.split(' ')[0]}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 space-y-2">
                  {req.status === 'accepted' && (
                    <button
                      onClick={(e) => cancelOrder(req, e)}
                      disabled={isUpdating}
                      className="w-full rounded-xl border border-error-200 bg-error-50 py-2.5 text-sm font-semibold text-error-700 transition-all active:scale-[0.98] disabled:opacity-60 dark:border-error-900/40 dark:bg-error-950/30 dark:text-error-300"
                    >
                      {isUpdating ? 'Cancelling...' : 'Cancel Order'}
                    </button>
                  )}

                  {isActionable && nextStatus && (
                    <button
                      onClick={(e) => advanceStatus(req, e)}
                      disabled={isUpdating}
                      className="btn-primary w-full text-sm disabled:opacity-60"
                    >
                      {isUpdating ? 'Updating...' : `Mark as ${STATUS_LABELS[nextStatus]}`}
                    </button>
                  )}

                  {canUploadProof && !req.delivery_proof_url && (
                    <button
                      onClick={() => setProofReqId(req.id)}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary-300 bg-primary-50 py-2.5 text-sm font-semibold text-primary-700 transition-all active:scale-[0.98] dark:border-primary-700 dark:bg-primary-900/20 dark:text-primary-300"
                    >
                      <Camera size={16} /> Upload Delivery Proof
                    </button>
                  )}
                  {req.delivery_proof_url && (
                    <div className="flex items-center justify-center gap-2 rounded-xl bg-success-50 px-3 py-2.5 text-xs font-medium text-success-700 dark:bg-success-950/30 dark:text-success-300">
                      <Camera size={14} /> Delivery proof uploaded
                    </div>
                  )}

                  {awaitingUser && (
                    <div className="flex items-center justify-center rounded-xl bg-warning-50 px-3 py-2.5 text-xs font-medium text-warning-700 dark:bg-warning-950/30 dark:text-warning-300 animate-pulse-soft">
                      Waiting for customer to confirm delivery...
                    </div>
                  )}

                  {req.status !== 'completed' && req.status !== 'cancelled' && (
                    chatClosed ? (
                      <div className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-gray-100 px-3 py-2.5 text-sm font-medium text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-600">
                        <Lock size={14} /> Chat Closed
                      </div>
                    ) : (
                      <button onClick={(e) => goToChat(req, e)} className="btn-secondary w-full gap-1.5 text-sm">
                        <MessageCircle size={15} /> Open Chat
                      </button>
                    )
                  )}
                </div>
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
