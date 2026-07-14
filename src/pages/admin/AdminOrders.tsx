import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatTime } from '../../lib/utils'
import { StatusBadge, EmptyState, SkeletonCard } from '../../components/ui'
import { ClipboardList, Search, Download, X, User, Bike, MapPin, Package, IndianRupee } from 'lucide-react'
import * as XLSX from 'xlsx'

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<any | null>(null)

  useEffect(() => {
    const fetchOrders = async () => {
      const { data } = await supabase
        .from('orders')
        .select('*, _request:requests(title, description, delivery_address, pickup_address, preferred_shop, user_id, accepted_dp_id)')
        .order('created_at', { ascending: false })
        .limit(200)
      setOrders(data || [])
      setLoading(false)
    }
    fetchOrders()
  }, [])

  const filtered = orders.filter(o =>
    !search ||
    o._request?.title?.toLowerCase().includes(search.toLowerCase()) ||
    o.items_summary?.toLowerCase().includes(search.toLowerCase()) ||
    o.id.toLowerCase().includes(search.toLowerCase())
  )

  const exportOrders = () => {
    const rows = filtered.map(o => ({
      'Order ID': o.id,
      Title: o._request?.title || 'Delivery',
      Summary: o.items_summary || '',
      Status: o.status,
      'Delivery Address': o._request?.delivery_address || '',
      'Item Cost': o.item_cost || '',
      'Delivery Charge': o.delivery_charge,
      'Commission %': o.commission_pct,
      'Commission Amount': o.commission_amount,
      'DP Earnings': o.dp_earnings,
      'Created At': formatTime(o.created_at),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Orders')
    XLSX.writeFile(wb, 'orders.xlsx')
  }

  if (loading) return (
    <div className="p-4 md:p-8">
      <div className="mb-6 h-8 w-48 skeleton rounded-xl" />
      <div className="space-y-3">{[1, 2, 3].map(i => <SkeletonCard key={i} lines={3} />)}</div>
    </div>
  )

  return (
    <div className="p-4 md:p-8">
      <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">All Orders</h1>

      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by title or order ID..." className="input pl-10" />
        </div>
        <button onClick={exportOrders} className="btn-secondary shrink-0 text-sm flex items-center gap-1.5">
          <Download size={16} /> Export
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<ClipboardList size={48} />} title="No orders found" />
      ) : (
        <div className="space-y-3">
          {filtered.map((o, i) => (
            <div key={o.id} className="card card-hover p-4 animate-slide-up cursor-pointer"
              style={{ animationDelay: `${i * 30}ms` }}
              onClick={() => setSelected(o)}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white truncate">
                    {o._request?.title || o.items_summary || 'Delivery'}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">ID: {o.id.slice(0, 12)}...</p>
                </div>
                <StatusBadge status={o.status} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-gray-400">Delivery Charge</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(o.delivery_charge)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Commission</p>
                  <p className="font-semibold text-success-600 dark:text-success-400">{formatCurrency(o.commission_amount)}</p>
                </div>
                <div>
                  <p className="text-gray-400">DP Earnings</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(o.dp_earnings)}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-400">{formatTime(o.created_at)}</p>
            </div>
          ))}
        </div>
      )}

      {selected && <OrderDetailDrawer order={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function OrderDetailDrawer({ order, onClose }: { order: any; onClose: () => void }) {
  const [userProfile, setUserProfile] = useState<any>(null)
  const [dpProfile, setDpProfile] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])

  useEffect(() => {
    const uid = order._request?.user_id
    const dpId = order._request?.accepted_dp_id || order.dp_id
    if (uid) supabase.from('profiles').select('full_name, phone').eq('id', uid).maybeSingle()
      .then(({ data }) => setUserProfile(data))
    if (dpId) supabase.from('profiles').select('full_name, phone').eq('id', dpId).maybeSingle()
      .then(({ data }) => setDpProfile(data))
    supabase.from('chat_rooms').select('id').eq('request_id', order.request_id).maybeSingle()
      .then(({ data: room }) => {
        if (room?.id) {
          supabase.from('messages').select('content, sender_id, message_type, created_at')
            .eq('chat_room_id', room.id).order('created_at', { ascending: false }).limit(20)
            .then(({ data }) => setMessages(data || []))
        }
      })
  }, [order])

  const req = order._request || {}

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="absolute bottom-0 left-0 right-0 max-h-[90vh] overflow-y-auto rounded-t-3xl bg-white dark:bg-gray-900 bottom-sheet"
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1.5 w-12 rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="px-5 pb-10 pt-4 space-y-5">
          {/* Status + ID */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Order ID</p>
              <p className="font-mono text-sm text-gray-700 dark:text-gray-300">{order.id}</p>
            </div>
            <StatusBadge status={order.status} />
          </div>

          {/* Title */}
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">{req.title || order.items_summary || 'Delivery'}</p>
            {req.description && (
              <ul className="mt-1.5 space-y-0.5">
                {req.description.split('\n').map((line: string, i: number) => line.trim() && (
                  <li key={i} className="flex items-start gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />
                    {line.trim()}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Addresses */}
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 p-4 space-y-2">
            {req.preferred_shop && (
              <div className="flex items-start gap-2 text-sm">
                <Package size={14} className="mt-0.5 shrink-0 text-accent-500" />
                <span className="text-gray-600 dark:text-gray-400">Shop: <span className="font-medium text-gray-900 dark:text-white">{req.preferred_shop}</span></span>
              </div>
            )}
            {req.pickup_address && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin size={14} className="mt-0.5 shrink-0 text-warning-500" />
                <span className="text-gray-600 dark:text-gray-400">Pickup: <span className="font-medium text-gray-900 dark:text-white">{req.pickup_address}</span></span>
              </div>
            )}
            <div className="flex items-start gap-2 text-sm">
              <MapPin size={14} className="mt-0.5 shrink-0 text-error-500" />
              <span className="text-gray-600 dark:text-gray-400">Deliver to: <span className="font-medium text-gray-900 dark:text-white">{req.delivery_address}</span></span>
            </div>
          </div>

          {/* Financials */}
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Financials</p>
            <div className="space-y-2 text-sm">
              {order.item_cost > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Item Cost</span>
                  <span className="font-semibold">{formatCurrency(order.item_cost)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Delivery Charge</span>
                <span className="font-semibold">{formatCurrency(order.delivery_charge)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Commission ({order.commission_pct}%)</span>
                <span className="font-semibold text-success-600">{formatCurrency(order.commission_amount)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-2 dark:border-gray-800">
                <span className="text-gray-500">DP Earnings</span>
                <span className="font-bold text-primary-600">{formatCurrency(order.dp_earnings)}</span>
              </div>
            </div>
          </div>

          {/* People */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
              <div className="flex items-center gap-1.5 mb-1 text-xs text-gray-400"><User size={12} /> Customer</div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{userProfile?.full_name || '...'}</p>
              <p className="text-xs text-gray-500">{userProfile?.phone || ''}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
              <div className="flex items-center gap-1.5 mb-1 text-xs text-gray-400"><Bike size={12} /> Delivery Partner</div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{dpProfile?.full_name || '...'}</p>
              <p className="text-xs text-gray-500">{dpProfile?.phone || ''}</p>
            </div>
          </div>

          {/* Chat messages */}
          {messages.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Chat (last 20 messages)</p>
              <div className="space-y-1.5 max-h-64 overflow-y-auto rounded-2xl border border-gray-100 p-3 dark:border-gray-800">
                {[...messages].reverse().map((m, i) => (
                  <div key={i} className="text-xs">
                    <span className="font-semibold text-gray-500">{m.sender_id === req.user_id ? 'User' : 'DP'}: </span>
                    <span className="text-gray-700 dark:text-gray-300">
                      {m.message_type === 'text' ? m.content : `[${m.message_type}]`}
                    </span>
                    <span className="ml-1 text-gray-400">{formatTime(m.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-center text-xs text-gray-400">Created {formatTime(order.created_at)}</p>
        </div>
      </div>
    </div>
  )
}
