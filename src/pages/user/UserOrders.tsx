import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase, DeliveryRequest, Profile } from '../../lib/supabase'
import { EmptyState, StatusBadge, Avatar } from '../../components/ui'
import { formatTime } from '../../lib/utils'
import { ClipboardList, Clock, MapPin, Repeat, MessageCircle, Lock, Bike, XCircle, Navigation } from 'lucide-react'

type Tab = 'active' | 'completed' | 'cancelled'
type RequestWithDp = DeliveryRequest & { _dp?: Profile }

export default function UserOrders() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('active')
  const [orders, setOrders] = useState<RequestWithDp[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

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
    const requests = (data as DeliveryRequest[]) || []

    const dpIds = [...new Set(requests.map(r => r.accepted_dp_id).filter(Boolean))] as string[]
    let dpMap = new Map<string, Profile>()
    if (dpIds.length > 0) {
      const { data: dps } = await supabase.from('profiles').select('id, full_name, photo_url, phone').in('id', dpIds)
      dps?.forEach((p: any) => dpMap.set(p.id, p as Profile))
    }
    setOrders(requests.map(r => ({ ...r, _dp: r.accepted_dp_id ? dpMap.get(r.accepted_dp_id) : undefined })))
    setLoading(false)
  }, [profile, tab])

  useEffect(() => {
    setLoading(true)
    fetchOrders()
  }, [fetchOrders])

  useEffect(() => {
    const channel = supabase
      .channel(`user-orders-${profile!.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'requests',
        filter: `user_id=eq.${profile!.id}`,
      }, async (payload) => {
        fetchOrders()
        if ((payload.new as any).status === 'accepted' && (payload.new as any).accepted_dp_id) {
          const reqId = (payload.new as any).id
          const dpId = (payload.new as any).accepted_dp_id
          const findOrCreateRoom = async (retries = 5): Promise<string | null> => {
            const { data: rooms } = await supabase.from('chat_rooms').select('id').eq('request_id', reqId).limit(1)
            if (rooms && rooms.length > 0) return rooms[0].id
            if (retries === 0) {
              const { data: nr } = await supabase.from('chat_rooms')
                .insert({ request_id: reqId, user_id: profile!.id, dp_id: dpId })
                .select('id').single()
              return nr?.id ?? null
            }
            await new Promise(res => setTimeout(res, 600))
            return findOrCreateRoom(retries - 1)
          }
          const roomId = await findOrCreateRoom()
          if (roomId) navigate(`/app/chat/${roomId}`)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile, fetchOrders, navigate])

  const cancelRequest = async (req: DeliveryRequest) => {
    if (!confirm('Cancel this request? This cannot be undone.')) return
    setUpdating(req.id)
    await supabase.from('requests').update({ status: 'cancelled' }).eq('id', req.id)
    setUpdating(null)
    fetchOrders()
  }

  const goToChat = async (req: DeliveryRequest) => {
    if (!req.accepted_dp_id) return
    const { data: rooms } = await supabase
      .from('chat_rooms').select('id').eq('request_id', req.id)
      .order('created_at', { ascending: true }).limit(1)
    if (rooms && rooms.length > 0) { navigate(`/app/chat/${rooms[0].id}`); return }
    const { data: newRoom } = await supabase.from('chat_rooms')
      .insert({ request_id: req.id, user_id: profile!.id, dp_id: req.accepted_dp_id })
      .select('id').single()
    if (newRoom) navigate(`/app/chat/${newRoom.id}`)
  }

  const repeatRequest = async (req: DeliveryRequest) => {
    await supabase.from('requests').insert({
      user_id: profile!.id, description: req.description,
      preferred_shop: req.preferred_shop, pickup_address: req.pickup_address,
      delivery_address: req.delivery_address, delivery_lat: req.delivery_lat,
      delivery_lng: req.delivery_lng, max_budget: req.max_budget,
      special_instructions: req.special_instructions,
      radius_meters: req.radius_meters, status: 'pending',
    })
    navigate('/app/orders')
  }

  return (
    <div className="mx-auto max-w-md px-4 py-4">
      <h1 className="mb-4 text-xl font-bold text-white">My Orders</h1>

      <div className="mb-4 flex rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
        {(['active', 'completed', 'cancelled'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold capitalize transition-all ${tab === t ? 'bg-white text-primary-600 shadow-sm dark:bg-gray-700 dark:text-primary-300' : 'text-gray-500'}`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-36 animate-pulse rounded-2xl glass" />)}</div>
      ) : orders.length === 0 ? (
        <EmptyState icon={<ClipboardList size={48} />} title={`No ${tab} orders`} />
      ) : (
        <div className="space-y-3">
          {orders.map(req => {
            const chatClosed = ['delivered', 'cash_received', 'completed'].includes(req.status)
            const canTrack = !!req.accepted_dp_id && !['cancelled', 'completed'].includes(req.status)

            return (
              <div key={req.id} className="card p-4 animate-slide-up">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white">{req.description?.split('\n')[0]?.trim() || 'Delivery Request'}</p>
                    <p className="mt-0.5 line-clamp-1 text-sm text-white/50">{req.delivery_address}</p>
                  </div>
                  <StatusBadge status={req.status} />
                </div>

                <div className="mt-2 flex items-center gap-4 text-xs text-white/40">
                  <span className="flex items-center gap-1"><Clock size={12} /> {formatTime(req.created_at)}</span>
                  <span className="flex items-center gap-1"><MapPin size={12} /> {req.delivery_address?.slice(0, 30)}</span>
                </div>

                {req.accepted_dp_id && req._dp && req.status !== 'cancelled' && (
                  <div className="mt-3 flex items-center gap-3 rounded-xl bg-primary-50 px-3 py-2.5 dark:bg-primary-900/20">
                    <Avatar url={req._dp.photo_url} name={req._dp.full_name || 'DP'} size={40} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{req._dp.full_name}</p>
                      {req._dp.phone && <p className="text-xs text-gray-500">{req._dp.phone}</p>}
                      <p className="text-xs text-primary-600 dark:text-primary-400 font-medium">Your delivery partner</p>
                    </div>
                    <Bike size={18} className="shrink-0 text-primary-600 dark:text-primary-400" />
                  </div>
                )}

                {req.status === 'pending' && (
                  <button
                    onClick={() => cancelRequest(req)}
                    disabled={updating === req.id}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-error-200 bg-error-50 py-2.5 text-sm font-semibold text-error-700 transition-all active:scale-[0.98] disabled:opacity-60 dark:border-error-900/40 dark:bg-error-950/30 dark:text-error-300"
                  >
                    <XCircle size={16} />
                    {updating === req.id ? 'Cancelling...' : 'Cancel Request'}
                  </button>
                )}

                <div className="mt-3 flex gap-2">
                  {req.accepted_dp_id && req.status !== 'cancelled' && (
                    chatClosed ? (
                      <div className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-gray-100 px-3 py-2.5 text-xs font-medium text-white/40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-600">
                        <Lock size={13} /> Chat Closed
                      </div>
                    ) : (
                      <button onClick={() => goToChat(req)} className="btn-secondary flex-1 gap-1.5 text-xs">
                        <MessageCircle size={14} /> Chat
                      </button>
                    )
                  )}
                  {canTrack && (
                    <button onClick={() => navigate(`/app/track/${req.id}`)} className="btn-secondary flex-1 gap-1.5 text-xs">
                      <Navigation size={14} /> Track
                    </button>
                  )}
                  {tab !== 'active' && (
                    <button onClick={() => repeatRequest(req)} className="btn-ghost flex-1 text-xs">
                      <Repeat size={14} /> Repeat
                    </button>
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
