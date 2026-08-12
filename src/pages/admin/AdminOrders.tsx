import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatTime } from '../../lib/utils'
import { StatusBadge, EmptyState, SkeletonCard, Avatar } from '../../components/ui'
import { ClipboardList, Search, Download, X, User, Bike, MapPin, Package, IndianRupee, MessageCircle, Star, Phone, Clock } from 'lucide-react'
import * as XLSX from 'xlsx'
import { AdminShell, AdminHeader, FilterPills } from './adminChrome'

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<any | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'cancelled' | 'pending'>('all')

  useEffect(() => {
    const fetchOrders = async () => {
      const { data: reqData, error: reqError } = await supabase
        .from('requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)
      if (reqError) { console.error('AdminOrders fetch error:', reqError); setLoading(false); return }
      const reqRows = reqData || []

      let orderMap: Record<string, any> = {}
      if (reqRows.length > 0) {
        const { data: orderData } = await supabase
          .from('orders')
          .select('request_id, delivery_charge, commission_amount, commission_pct, dp_earnings, item_cost, items_summary, completed_at, status, id')
          .in('request_id', reqRows.map((r: any) => r.id))
        if (orderData) {
          for (const o of orderData as any[]) { orderMap[o.request_id] = o }
        }
      }

      setOrders(reqRows.map((r: any) => {
        const o = orderMap[r.id] || {}
        return {
          ...r,
          order_id: o.id || null,
          delivery_charge: o.delivery_charge ?? null,
          commission_amount: o.commission_amount ?? null,
          commission_pct: o.commission_pct ?? null,
          dp_earnings: o.dp_earnings ?? null,
          item_cost: o.item_cost ?? null,
          items_summary: o.items_summary ?? r.description,
          completed_at: o.completed_at ?? null,
          _request: {
            description: r.description,
            delivery_address: r.delivery_address,
            pickup_address: r.pickup_address,
            preferred_shop: r.preferred_shop,
            user_id: r.user_id,
            accepted_dp_id: r.accepted_dp_id,
            photo_urls: r.photo_urls,
            delivery_proof_url: r.delivery_proof_url,
          },
        }
      }))
      setLoading(false)
    }
    fetchOrders()

    const channel = supabase.channel('admin-orders-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => fetchOrders())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const filtered = orders.filter(o => {
    if (statusFilter === 'active' && ['accepted', 'confirmed', 'shopping', 'purchased', 'on_the_way', 'arrived', 'delivered'].includes(o.status)) return true
    if (statusFilter === 'completed' && o.status === 'completed') return true
    if (statusFilter === 'cancelled' && o.status === 'cancelled') return true
    if (statusFilter === 'pending' && o.status === 'pending') return true
    if (statusFilter === 'all') return true
    return false
  }).filter(o =>
    !search ||
    (o.description || '').toLowerCase().includes(search.toLowerCase()) ||
    (o.items_summary || '').toLowerCase().includes(search.toLowerCase()) ||
    (o.delivery_address || '').toLowerCase().includes(search.toLowerCase()) ||
    o.id.toLowerCase().includes(search.toLowerCase())
  )

  const exportOrders = () => {
    const rows = filtered.map(o => ({
      'Request ID': o.id,
      'Order ID': o.order_id || '',
      Description: o._request?.description || 'Delivery',
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
    <AdminShell>
      <div className="mb-6 h-8 w-48 skeleton rounded-xl" />
      <div className="space-y-3">{[1, 2, 3].map(i => <SkeletonCard key={i} lines={3} />)}</div>
    </AdminShell>
  )

  return (
    <AdminShell>
      <AdminHeader title="All Orders" action={
        <button onClick={exportOrders} className="btn-secondary shrink-0 text-sm flex items-center gap-1.5">
          <Download size={16} /> Export
        </button>
      } />

      <div className="mb-4">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by description or order ID..." className="input pl-10" />
        </div>
      </div>

      <div className="mb-4">
        <FilterPills options={['all', 'active', 'pending', 'completed', 'cancelled']} value={statusFilter} onChange={setStatusFilter} />
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
                  <p className="font-semibold text-[#0F1A14] truncate">
                    {o._request?.description?.split('\n')[0]?.trim() || o.items_summary || 'Delivery'}
                  </p>
                  <p className="mt-0.5 text-xs text-black/40">ID: {o.id.slice(0, 12)}...</p>
                </div>
                <StatusBadge status={o.status} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-black/40">Delivery Charge</p>
                  <p className="font-semibold text-[#0F1A14]">{o.delivery_charge != null ? formatCurrency(o.delivery_charge) : '—'}</p>
                </div>
                <div>
                  <p className="text-black/40">Commission</p>
                  <p className="font-semibold text-success-600 dark:text-success-400">{o.commission_amount != null ? formatCurrency(o.commission_amount) : '—'}</p>
                </div>
                <div>
                  <p className="text-black/40">DP Earnings</p>
                  <p className="font-semibold text-[#0F1A14]">{o.dp_earnings != null ? formatCurrency(o.dp_earnings) : '—'}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-black/40">{formatTime(o.created_at)}</p>
            </div>
          ))}
        </div>
      )}

      {selected && <OrderDetailDrawer order={selected} onClose={() => setSelected(null)} />}
    </AdminShell>
  )
}

function OrderDetailDrawer({ order, onClose }: { order: any; onClose: () => void }) {
  const [userProfile, setUserProfile] = useState<any>(null)
  const [dpProfile, setDpProfile] = useState<any>(null)
  const [dpData, setDpData] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])

  useEffect(() => {
    const uid = order._request?.user_id
    const dpId = order._request?.accepted_dp_id || order.dp_id
    if (uid) supabase.from('profiles').select('full_name, phone, photo_url').eq('id', uid).maybeSingle()
      .then(({ data }) => setUserProfile(data))
    if (dpId) {
      supabase.from('profiles').select('full_name, phone, photo_url').eq('id', dpId).maybeSingle()
        .then(({ data }) => setDpProfile(data))
      supabase.from('delivery_partners').select('rating_avg, rating_count, vehicle_type').eq('user_id', dpId).maybeSingle()
        .then(({ data }) => setDpData(data))
    }
    supabase.from('chat_rooms').select('id').eq('request_id', order.id).maybeSingle()
      .then(({ data: room }) => {
        if (room?.id) {
          supabase.from('messages').select('content, sender_id, message_type, created_at, attachment_url, quotation_data')
            .eq('chat_room_id', room.id).order('created_at', { ascending: false }).limit(50)
            .then(({ data }) => setMessages(data || []))
        }
      })
  }, [order])

  const req = order._request || {}

  return (
    <div className="fixed inset-0 z-50 bg-[#000000]/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="absolute bottom-0 left-0 right-0 max-h-[90vh] overflow-y-auto rounded-t-3xl glass bottom-sheet"
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1.5 w-12 rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="px-5 pb-10 pt-4 space-y-5">
          {/* Status + ID */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-black/40">Order ID</p>
              <p className="font-mono text-sm text-black/75">{order.id}</p>
            </div>
            <StatusBadge status={order.status} />
          </div>

          {/* Title */}
          <div>
            <p className="text-sm font-bold text-[#0F1A14]">{req.description?.split('\n')[0]?.trim() || order.items_summary || 'Delivery'}</p>
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
          <div className="rounded-2xl border border-black/10 p-4 space-y-2">
            {req.preferred_shop && (
              <div className="flex items-start gap-2 text-sm">
                <Package size={14} className="mt-0.5 shrink-0 text-accent-500" />
                <span className="text-black/55">Shop: <span className="font-medium text-[#0F1A14]">{req.preferred_shop}</span></span>
              </div>
            )}
            {req.pickup_address && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin size={14} className="mt-0.5 shrink-0 text-warning-500" />
                <span className="text-black/55">Pickup: <span className="font-medium text-[#0F1A14]">{req.pickup_address}</span></span>
              </div>
            )}
            <div className="flex items-start gap-2 text-sm">
              <MapPin size={14} className="mt-0.5 shrink-0 text-error-500" />
              <span className="text-black/55">Deliver to: <span className="font-medium text-[#0F1A14]">{req.delivery_address}</span></span>
            </div>
          </div>

          {/* Delivery Proof Photos */}
          {req.photo_urls && req.photo_urls.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/40">Request Photos</p>
              <div className="flex flex-wrap gap-2">
                {(req.photo_urls as string[]).map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt={`Photo ${i + 1}`} className="h-24 w-24 rounded-xl object-cover border border-black/10" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Financials */}
          <div className="rounded-2xl border border-black/10 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-black/40">Financials</p>
            <div className="space-y-2 text-sm">
              {order.item_cost > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Item Cost</span>
                  <span className="font-semibold">{formatCurrency(order.item_cost)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Delivery Charge</span>
                <span className="font-semibold">{order.delivery_charge != null ? formatCurrency(order.delivery_charge) : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Commission ({order.commission_pct || 0}%)</span>
                <span className="font-semibold text-success-600">{order.commission_amount != null ? formatCurrency(order.commission_amount) : '—'}</span>
              </div>
              <div className="flex justify-between border-t border-black/10 pt-2 dark:border-gray-800">
                <span className="text-gray-500">DP Earnings</span>
                <span className="font-bold text-primary-600">{order.dp_earnings != null ? formatCurrency(order.dp_earnings) : '—'}</span>
              </div>
            </div>
          </div>

          {/* People */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
              <div className="flex items-center gap-1.5 mb-2 text-xs text-black/40"><User size={12} /> Customer</div>
              <div className="flex items-center gap-2">
                <Avatar url={userProfile?.photo_url} name={userProfile?.full_name || 'User'} size={32} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#0F1A14] truncate">{userProfile?.full_name || '...'}</p>
                  <p className="text-xs text-gray-500">{userProfile?.phone || ''}</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
              <div className="flex items-center gap-1.5 mb-2 text-xs text-black/40"><Bike size={12} /> Delivery Partner</div>
              {dpProfile ? (
                <div className="flex items-center gap-2">
                  <Avatar url={dpProfile?.photo_url} name={dpProfile?.full_name || 'DP'} size={32} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#0F1A14] truncate">{dpProfile?.full_name || '...'}</p>
                    <p className="text-xs text-gray-500">{dpProfile?.phone || ''}</p>
                    {dpData?.rating_count > 0 && (
                      <p className="text-xs text-yellow-500 flex items-center gap-0.5">
                        <Star size={10} fill="#fbbf24" className="text-yellow-400" /> {dpData.rating_avg.toFixed(1)} ({dpData.rating_count})
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-black/40">Not assigned</p>
              )}
            </div>
          </div>

          {/* Chat messages */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/40 flex items-center gap-1.5">
              <MessageCircle size={14} /> Chat History ({messages.length} messages)
            </p>
            {messages.length === 0 ? (
              <p className="text-sm text-black/40 rounded-2xl border border-black/10 p-4 text-center">No chat messages for this order</p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto rounded-2xl border border-black/10 p-3 dark:border-gray-800">
                {[...messages].reverse().map((m, i) => (
                  <div key={i} className="text-xs flex items-start gap-1.5">
                    <span className={`font-semibold shrink-0 ${m.sender_id === req.user_id ? 'text-blue-400' : 'text-yellow-400'}`}>
                      {m.sender_id === req.user_id ? 'User' : 'DP'}:
                    </span>
                    <span className="text-black/75 flex-1">
                      {m.message_type === 'text' ? m.content :
                       m.message_type === 'image' ? '[Photo]' :
                       m.message_type === 'voice' ? '[Voice]' :
                       m.message_type === 'location' ? '[Location]' :
                       m.message_type === 'quotation' ? '[Quotation]' :
                       `[${m.message_type}]`}
                    </span>
                    <span className="text-black/40 shrink-0 flex items-center gap-0.5">
                      <Clock size={9} />{formatTime(m.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-center text-xs text-black/40">Created {formatTime(order.created_at)}</p>
        </div>
      </div>
    </div>
  )
}
