import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase, DeliveryRequest } from '../../lib/supabase'
import { EmptyState, StatusBadge } from '../../components/ui'
import { formatTime, formatCurrency, STATUS_LABELS } from '../../lib/utils'
import { ClipboardList, Clock, MapPin, MessageCircle, Lock } from 'lucide-react'

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

      <div className="mb-4 flex rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
        {(['active', 'completed', 'cancelled'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold capitalize transition-all ${tab === t ? 'bg-white text-primary-600 shadow-sm dark:bg-gray-700 dark:text-primary-300' : 'text-gray-500'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-40 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />)}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState icon={<ClipboardList size={48} />} title={`No ${tab} deliveries`} />
      ) : (
        <div className="space-y-3">
          {orders.map(req => {
            const displayStatus = req.status === 'cash_received' ? 'delivered' : req.status
            const statusIdx = ORDER_FLOW.indexOf(displayStatus)
            const isActionable = DP_ACTION_STATUSES.includes(req.status)
            const nextStatus = isActionable ? ORDER_FLOW[ORDER_FLOW.indexOf(req.status) + 1] : null
            const isUpdating = updating === req.id
            const awaitingUser = req.status === 'delivered' || req.status === 'cash_received'
            const chatClosed = req.status === 'delivered' || req.status === 'cash_received'

            return (
              <div key={req.id} className="card p-4 animate-slide-up">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white">{req.title}</p>
                    <p className="mt-0.5 line-clamp-1 text-sm text-gray-500 dark:text-gray-400">{req.delivery_address}</p>
                  </div>
                  <StatusBadge status={req.status} />
                </div>

                <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Clock size={12} /> {formatTime(req.created_at)}</span>
                  {req.max_budget && <span>{formatCurrency(req.max_budget)}</span>}
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
                    <p className="mt-0.5 text-xs text-accent-600 dark:text-accent-400">
                      Tap the button below once you begin shopping for the items.
                    </p>
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
                          i < statusIdx ? 'text-primary-500 dark:text-primary-500' :
                          'text-gray-400'
                        }`}>
                          {STATUS_LABELS[s]?.split(' ')[0]}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 space-y-2">
                  {/* Cancel before confirming */}
                  {req.status === 'accepted' && (
                    <button
                      onClick={(e) => cancelOrder(req, e)}
                      disabled={isUpdating}
                      className="w-full rounded-xl border border-error-200 bg-error-50 py-2.5 text-sm font-semibold text-error-700 transition-all active:scale-[0.98] disabled:opacity-60 dark:border-error-900/40 dark:bg-error-950/30 dark:text-error-300"
                    >
                      {isUpdating ? 'Cancelling...' : 'Cancel Order'}
                    </button>
                  )}

                  {/* Advance status button */}
                  {isActionable && nextStatus && (
                    <button
                      onClick={(e) => advanceStatus(req, e)}
                      disabled={isUpdating}
                      className="btn-primary w-full text-sm disabled:opacity-60"
                    >
                      {isUpdating ? 'Updating...' : `Mark as ${STATUS_LABELS[nextStatus]}`}
                    </button>
                  )}

                  {awaitingUser && (
                    <div className="flex items-center justify-center rounded-xl bg-warning-50 px-3 py-2.5 text-xs font-medium text-warning-700 dark:bg-warning-950/30 dark:text-warning-300">
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
    </div>
  )
}
