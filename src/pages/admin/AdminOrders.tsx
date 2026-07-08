import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { EmptyState, StatusBadge } from '../../components/ui'
import { formatTime, formatCurrency } from '../../lib/utils'
import { ClipboardList, Search, Download } from 'lucide-react'
import * as XLSX from 'xlsx'

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const fetchOrders = async () => {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      setOrders(data || [])
      setLoading(false)
    }
    fetchOrders()
  }, [])

  const filtered = orders.filter(o =>
    !search ||
    o.items_summary?.toLowerCase().includes(search.toLowerCase()) ||
    o.id.toLowerCase().includes(search.toLowerCase())
  )

  const exportOrders = () => {
    const rows = filtered.map(o => ({
      'Order ID': o.id,
      Summary: o.items_summary || 'Delivery',
      Status: o.status,
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

  if (loading) return <div className="p-8 text-center text-sm text-gray-400">Loading orders...</div>

  return (
    <div className="p-4 md:p-8">
      <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">All Orders</h1>

      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by item or order ID..."
            className="input pl-10"
          />
        </div>
        <button onClick={exportOrders} className="btn-secondary shrink-0 text-sm"><Download size={16} /> Export</button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<ClipboardList size={48} />} title="No orders found" />
      ) : (
        <div className="space-y-3">
          {filtered.map(o => (
            <div key={o.id} className="card p-4 animate-slide-up">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 dark:text-white">{o.items_summary || 'Delivery'}</p>
                  <p className="mt-0.5 text-xs text-gray-400">ID: {o.id.slice(0, 8)}</p>
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
    </div>
  )
}
