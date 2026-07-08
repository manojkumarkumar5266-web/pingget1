import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase, DeliveryRequest } from '../../lib/supabase'
import { EmptyState, StatusBadge, ServiceStatusBanner } from '../../components/ui'
import { formatTime, formatCurrency } from '../../lib/utils'
import { Package, Plus, Search, Clock, MapPin } from 'lucide-react'

export default function UserHome() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [activeOrders, setActiveOrders] = useState<DeliveryRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchOrders = async () => {
      const { data } = await supabase
        .from('requests')
        .select('*')
        .eq('user_id', profile!.id)
        .in('status', ['pending', 'accepted', 'confirmed', 'shopping', 'purchased', 'on_the_way', 'arrived', 'delivered', 'cash_received'])
        .order('created_at', { ascending: false })
      setActiveOrders((data as DeliveryRequest[]) || [])
      setLoading(false)
    }
    fetchOrders()

    const channel = supabase
      .channel('user-home-requests')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'requests',
        filter: `user_id=eq.${profile!.id}`,
      }, () => fetchOrders()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile])

  return (
    <div className="mx-auto max-w-md px-4 py-4">
      <ServiceStatusBanner cityName={profile?.city} />
      {/* Hero */}
      <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 p-5 text-white shadow-lg shadow-primary-600/20 animate-slide-up">
        <p className="text-sm font-medium text-primary-100">Need something?</p>
        <h2 className="mt-1 text-xl font-bold">Get it delivered by a local partner</h2>
        <button
          onClick={() => navigate('/app/create')}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-primary-700 transition-transform active:scale-95 hover:scale-105"
        >
          <Plus size={18} /> New Delivery Request
        </button>
      </div>

      {/* Active Orders */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-bold text-gray-900 dark:text-white">Active Orders</h3>
        <button onClick={() => navigate('/app/orders')} className="text-sm font-medium text-primary-600 dark:text-primary-400">View All</button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />)}
        </div>
      ) : activeOrders.length === 0 ? (
        <EmptyState
          icon={<Package size={48} />}
          title="No active orders"
          description="Create a request to get items delivered to you."
        />
      ) : (
        <div className="space-y-3">
          {activeOrders.map(req => (
            <button
              key={req.id}
              onClick={() => {
                if (req.accepted_dp_id) {
                  navigateToChat(navigate, req.id)
                } else {
                  navigate(`/app/orders`)
                }
              }}
              className="card w-full p-4 text-left transition-all hover:shadow-md active:scale-[0.98] animate-slide-up"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 dark:text-white">{req.title}</p>
                  <p className="mt-0.5 line-clamp-1 text-sm text-gray-500 dark:text-gray-400">{req.delivery_address}</p>
                </div>
                <StatusBadge status={req.status} />
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1"><Clock size={14} /> {formatTime(req.created_at)}</span>
                {req.max_budget && <span className="flex items-center gap-1">{formatCurrency(req.max_budget)}</span>}
                <span className="flex items-center gap-1"><MapPin size={14} /> {req.radius_meters}m radius</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

async function navigateToChat(navigate: any, requestId: string) {
  const { data } = await supabase
    .from('chat_rooms')
    .select('id')
    .eq('request_id', requestId)
    .maybeSingle()
  if (data) navigate(`/app/chat/${data.id}`)
}
