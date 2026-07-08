import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase, DeliveryRequest } from '../../lib/supabase'
import { EmptyState, StatusBadge } from '../../components/ui'
import { formatTime, formatCurrency, STATUS_LABELS } from '../../lib/utils'
import { ClipboardList, Clock, MapPin, Repeat, MessageCircle, PackageCheck, Lock } from 'lucide-react'

type Tab = 'active' | 'completed' | 'cancelled'

const ORDER_FLOW = ['confirmed', 'shopping', 'purchased', 'on_the_way', 'arrived', 'delivered', 'completed']

export default function UserOrders() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('active')
  const [orders, setOrders] = useState<DeliveryRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    let query = supabase.from('requests').select('*').eq('user_id', profile!.id)
    if (tab === 'active') {
      query = query.in('status', ['pending', 'accepted', 'confirmed', 'shopping', 'purchased', 'on_the_way', 'arrived', 'delivered', 'cash_received'])
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

  // Live updates when DP changes order status
  useEffect(() => {
    const channel = supabase
      .channel('user-orders-live')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'requests',
        filter: `user_id=eq.${profile!.id}`,
      }, () => fetchOrders())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile, fetchOrders])

  const confirmDelivery = async (req: DeliveryRequest) => {
    if (!req.accepted_dp_id) return
    setConfirming(req.id)
    await supabase.from('requests').update({ status: 'completed' }).eq('id', req.id)
    await supabase.from('orders')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('request_id', req.id)
    await supabase.from('notifications').insert({
      user_id: req.accepted_dp_id,
      title: 'Delivery Confirmed',
      body: 'Customer confirmed receipt. The order is now complete.',
      type: 'order_completed',
      related_id: req.id,
    })
    setConfirming(null)
    fetchOrders()
  }

  const goToChat = async (req: DeliveryRequest) => {
    if (!req.accepted_dp_id) return
    const { data: rooms, error } = await supabase
      .from('chat_rooms').select('id').eq('request_id', req.id)
      .order('created_at', { ascending: true }).limit(1)
    if (error) { alert('Failed to open chat. Please try again.'); return }
    if (rooms && rooms.length > 0) { navigate(`/app/chat/${rooms[0].id}`); return }
    const { data: newRoom, error: createError } = await supabase
      .from('chat_rooms')
      .insert({ request_id: req.id, user_id: profile!.id, dp_id: req.accepted_dp_id })
      .select('id').single()
    if (createError || !newRoom) { alert('Unable to open chat. Please try again.'); return }
    navigate(`/app/chat/${newRoom.id}`)
  }

  const repeatRequest = async (req: DeliveryRequest) => {
    const { error } = await supabase.from('requests').insert({
      user_id: profile!.id,
      title: req.title,
      description: req.description,
      preferred_shop: req.preferred_shop,
      pickup_address: req.pickup_address,
      delivery_address: req.delivery_address,
      delivery_lat: req.delivery_lat,
      delivery_lng: req.delivery_lng,
      max_budget: req.max_budget,
      special_instructions: req.special_instructions,
      radius_meters: req.radius_meters,
      status: 'pending',
    })
    if (!error) navigate('/app/orders')
  }

  return (
    <div className="mx-auto max-w-md px-4 py-4">
      <h1 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">My Orders</h1>

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
          {[1, 2, 3].map(i => <div key={i} className="h-40 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />)}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState icon={<ClipboardList size={48} />} title={`No ${tab} orders`} />
      ) : (
        <div className="space-y-3">
          {orders.map(req => {
            const displayStatus = req.status === 'cash_received' ? 'delivered' : req.status
            const statusIdx = ORDER_FLOW.indexOf(displayStatus)
            const showTracker = statusIdx !== -1
            const isDelivered = req.status === 'delivered' || req.status === 'cash_received'
            const isConfirming = confirming === req.id

            return (
              <div key={req.id} className="card overflow-hidden animate-slide-up">
                {/* Delivered banner */}
                {isDelivered && (
                  <div className="bg-success-500 px-4 py-2 text-center">
                    <p className="text-xs font-bold text-white">Your order has been delivered — please confirm receipt</p>
                  </div>
                )}

                <div className="p-4">
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

                  {/* Live progress tracker */}
                  {showTracker && (
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

                  {/* Status-aware hint for the user */}
                  {req.status === 'confirmed' && (
                    <p className="mt-2 text-center text-xs text-gray-400 dark:text-gray-500">
                      Your delivery partner is preparing to shop — updates will appear above.
                    </p>
                  )}
                  {req.status === 'shopping' && (
                    <p className="mt-2 text-center text-xs text-accent-600 dark:text-accent-400 font-medium">
                      Your delivery partner is shopping for your items right now.
                    </p>
                  )}
                  {req.status === 'purchased' && (
                    <p className="mt-2 text-center text-xs text-accent-600 dark:text-accent-400 font-medium">
                      Items purchased! Your partner is heading your way soon.
                    </p>
                  )}
                  {req.status === 'on_the_way' && (
                    <p className="mt-2 text-center text-xs text-warning-600 dark:text-warning-400 font-medium">
                      Your delivery partner is on the way to you!
                    </p>
                  )}
                  {req.status === 'arrived' && (
                    <p className="mt-2 text-center text-xs text-warning-600 dark:text-warning-400 font-medium">
                      Your delivery partner has arrived — please be ready to receive.
                    </p>
                  )}

                  {/* Confirm delivery */}
                  {isDelivered && (
                    <button
                      onClick={() => confirmDelivery(req)}
                      disabled={isConfirming}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-success-600 py-3 text-sm font-bold text-white transition-all active:scale-[0.98] hover:bg-success-700 disabled:opacity-60"
                    >
                      <PackageCheck size={18} />
                      {isConfirming ? 'Confirming...' : 'Confirm & Accept Delivery'}
                    </button>
                  )}

                  {/* Bottom action row */}
                  <div className="mt-3 flex gap-2">
                    {req.accepted_dp_id && req.status !== 'cancelled' && (() => {
                      const chatClosed = req.status === 'delivered' || req.status === 'cash_received' || req.status === 'completed'
                      return chatClosed ? (
                        <div className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-gray-100 px-3 py-2.5 text-xs font-medium text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-600">
                          <Lock size={13} /> Chat Closed
                        </div>
                      ) : (
                        <button onClick={() => goToChat(req)} className="btn-secondary flex-1 gap-1.5 text-xs">
                          <MessageCircle size={14} /> Open Chat
                        </button>
                      )
                    })()}
                    {tab !== 'active' && (
                      <button onClick={() => repeatRequest(req)} className="btn-ghost flex-1 text-xs">
                        <Repeat size={14} /> Repeat
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
