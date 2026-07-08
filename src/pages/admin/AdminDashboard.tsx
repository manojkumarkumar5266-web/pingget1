import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatTime } from '../../lib/utils'
import { Users, Bike, Package, IndianRupee, TrendingUp, Clock, CheckCircle, XCircle, Activity, Download } from 'lucide-react'
import * as XLSX from 'xlsx'

type Stats = {
  totalUsers: number
  totalDps: number
  pendingDps: number
  approvedDps: number
  onlineDps: number
  todayRequests: number
  todayDeliveries: number
  liveOrders: number
  completedOrders: number
  cancelledOrders: number
  commissionCollected: number
  pendingCommission: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [topDps, setTopDps] = useState<any[]>([])

  useEffect(() => {
    const fetchAll = async () => {
      const [users, dps, dpsPending, dpsApproved, dpsOnline, reqs, orders, payments, wallets] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'user'),
        supabase.from('delivery_partners').select('id', { count: 'exact', head: true }),
        supabase.from('delivery_partners').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('delivery_partners').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('delivery_partners').select('id', { count: 'exact', head: true }).eq('is_online', true),
        supabase.from('requests').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 86400000).toISOString()),
        supabase.from('orders').select('*'),
        supabase.from('commission_payments').select('amount'),
        supabase.from('wallets').select('commission_due, outstanding_balance'),
      ])

      const allOrders = orders.data || []
      const today = new Date(Date.now() - 86400000).toISOString()
      const todayDeliveries = allOrders.filter((o: any) => o.status === 'completed' && o.completed_at && o.completed_at >= today).length
      const liveOrders = allOrders.filter((o: any) => !['completed', 'cancelled'].includes(o.status)).length
      const completedOrders = allOrders.filter((o: any) => o.status === 'completed').length
      const cancelledOrders = allOrders.filter((o: any) => o.status === 'cancelled').length
      const commissionCollected = (payments.data || []).reduce((sum: number, p: any) => sum + p.amount, 0)
      const pendingCommission = (wallets.data || []).reduce((sum: number, w: any) => sum + (w.outstanding_balance || 0), 0)

      setStats({
        totalUsers: users.count || 0,
        totalDps: dps.count || 0,
        pendingDps: dpsPending.count || 0,
        approvedDps: dpsApproved.count || 0,
        onlineDps: dpsOnline.count || 0,
        todayRequests: reqs.count || 0,
        todayDeliveries,
        liveOrders,
        completedOrders,
        cancelledOrders,
        commissionCollected,
        pendingCommission,
      })

      const recent = allOrders
        .filter((o: any) => o.status === 'completed')
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
      setRecentOrders(recent)

      const dpIds = [...new Set(allOrders.map((o: any) => o.dp_id))]
      const dpStats = dpIds.map((id: string) => {
        const dpOrders = allOrders.filter((o: any) => o.dp_id === id && o.status === 'completed')
        return { dp_id: id, deliveries: dpOrders.length, earnings: dpOrders.reduce((s: number, o: any) => s + o.dp_earnings, 0) }
      }).sort((a, b) => b.deliveries - a.deliveries).slice(0, 5)

      if (dpStats.length > 0) {
        const { data: dpProfiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', dpStats.map(d => d.dp_id))
        const profileMap = new Map((dpProfiles || []).map((p: any) => [p.id, p.full_name]))
        setTopDps(dpStats.map(d => ({ ...d, name: profileMap.get(d.dp_id) || 'Unknown' })))
      }
    }
    fetchAll()
  }, [])

  if (!stats) return <div className="p-8 text-center text-sm text-gray-400">Loading dashboard...</div>

  const exportReport = () => {
    const wb = XLSX.utils.book_new()

    // Sheet 1: Summary
    const summaryRows = [
      { Metric: 'Total Users', Value: stats.totalUsers },
      { Metric: 'Total Partners', Value: stats.totalDps },
      { Metric: 'Pending Approval', Value: stats.pendingDps },
      { Metric: 'Approved Partners', Value: stats.approvedDps },
      { Metric: 'Online DPs', Value: stats.onlineDps },
      { Metric: "Today's Requests", Value: stats.todayRequests },
      { Metric: "Today's Deliveries", Value: stats.todayDeliveries },
      { Metric: 'Live Orders', Value: stats.liveOrders },
      { Metric: 'Completed Orders', Value: stats.completedOrders },
      { Metric: 'Cancelled Orders', Value: stats.cancelledOrders },
      { Metric: 'Commission Collected', Value: stats.commissionCollected },
      { Metric: 'Pending Commission', Value: stats.pendingCommission },
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Summary')

    // Sheet 2: Top DPs
    if (topDps.length > 0) {
      const dpRows = topDps.map(d => ({ Name: d.name, Deliveries: d.deliveries, 'Total Earnings': d.earnings }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dpRows), 'Top Partners')
    }

    // Sheet 3: Recent completed orders
    if (recentOrders.length > 0) {
      const orderRows = recentOrders.map(o => ({
        Summary: o.items_summary || 'Delivery',
        'Delivery Charge': o.delivery_charge,
        'Commission Amount': o.commission_amount,
        'DP Earnings': o.dp_earnings,
        Date: formatTime(o.created_at),
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(orderRows), 'Recent Orders')
    }

    XLSX.writeFile(wb, `pingget-dashboard-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-primary-600 bg-primary-50 dark:bg-primary-900/30' },
    { label: 'Total Partners', value: stats.totalDps, icon: Bike, color: 'text-accent-600 bg-accent-50 dark:bg-accent-900/30' },
    { label: "Today's Requests", value: stats.todayRequests, icon: Package, color: 'text-warning-600 bg-warning-50 dark:bg-warning-900/30' },
    { label: "Today's Deliveries", value: stats.todayDeliveries, icon: CheckCircle, color: 'text-success-600 bg-success-50 dark:bg-success-900/30' },
    { label: 'Live Orders', value: stats.liveOrders, icon: Activity, color: 'text-primary-600 bg-primary-50 dark:bg-primary-900/30' },
    { label: 'Completed', value: stats.completedOrders, icon: TrendingUp, color: 'text-success-600 bg-success-50 dark:bg-success-900/30' },
    { label: 'Cancelled', value: stats.cancelledOrders, icon: XCircle, color: 'text-error-600 bg-error-50 dark:bg-error-900/30' },
    { label: 'Online DPs', value: stats.onlineDps, icon: Bike, color: 'text-success-600 bg-success-50 dark:bg-success-900/30' },
  ]

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <button onClick={exportReport} className="btn-secondary flex items-center gap-1.5 text-sm">
          <Download size={16} /> Export Report
        </button>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {statCards.map((s, i) => {
          const Icon = s.icon
          return (
            <div key={i} className="card p-4 animate-slide-up">
              <div className={`mb-2 flex h-10 w-10 items-center justify-center rounded-xl ${s.color}`}>
                <Icon size={20} />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{s.value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Commission summary */}
      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-center gap-2 text-success-600 dark:text-success-400">
            <IndianRupee size={20} />
            <span className="text-sm font-medium">Commission Collected</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats.commissionCollected)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-error-600 dark:text-error-400">
            <Clock size={20} />
            <span className="text-sm font-medium">Pending Commission</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats.pendingCommission)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Top DPs */}
        <div className="card p-5">
          <h3 className="mb-3 text-sm font-bold text-gray-900 dark:text-white">Top Delivery Partners</h3>
          {topDps.length === 0 ? (
            <p className="text-sm text-gray-400">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {topDps.map((dp, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">{i + 1}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{dp.name}</span>
                  </div>
                  <span className="text-sm text-gray-500">{dp.deliveries} deliveries</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent completed orders */}
        <div className="card p-5">
          <h3 className="mb-3 text-sm font-bold text-gray-900 dark:text-white">Recent Completed Orders</h3>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-gray-400">No completed orders yet.</p>
          ) : (
            <div className="space-y-2">
              {recentOrders.map((o, i) => (
                <div key={o.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{o.items_summary || 'Delivery'}</p>
                    <p className="text-xs text-gray-400">{formatTime(o.created_at)}</p>
                  </div>
                  <span className="text-sm font-bold text-success-600 dark:text-success-400">{formatCurrency(o.delivery_charge)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
