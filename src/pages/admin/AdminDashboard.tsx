import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatTime } from '../../lib/utils'
import { Users, Bike, Package, IndianRupee, TrendingUp, Clock, CheckCircle, XCircle, Activity, Download, Bell, UserPlus, Bike as BikeIcon, CreditCard, X } from 'lucide-react'
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

type AdminNotification = {
  id: string
  type: string
  title: string
  body: string | null
  related_id: string | null
  is_read: boolean
  created_at: string
}

const NOTIF_ICONS: Record<string, any> = {
  new_user: UserPlus,
  new_dp: BikeIcon,
  payment: CreditCard,
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [topDps, setTopDps] = useState<any[]>([])
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifPanel, setShowNotifPanel] = useState(false)

  useEffect(() => {
    const fetchAll = async () => {
      const [users, dps, dpsPending, dpsApproved, dpsOnline, reqs, orders, payments, notifs] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'user'),
        supabase.from('delivery_partners').select('id', { count: 'exact', head: true }),
        supabase.from('delivery_partners').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('delivery_partners').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('delivery_partners').select('id', { count: 'exact', head: true }).eq('is_online', true),
        supabase.from('requests').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 86400000).toISOString()),
        supabase.from('orders').select('*'),
        supabase.from('commission_payments').select('amount'),
        supabase.from('admin_notifications').select('*').order('created_at', { ascending: false }).limit(50),
      ])

      const allOrders = orders.data || []
      const today = new Date(Date.now() - 86400000).toISOString()
      const todayDeliveries = allOrders.filter((o: any) => o.status === 'completed' && o.completed_at && o.completed_at >= today).length
      const liveOrders = allOrders.filter((o: any) => !['completed', 'cancelled'].includes(o.status)).length
      const completedOrders = allOrders.filter((o: any) => o.status === 'completed').length
      const cancelledOrders = allOrders.filter((o: any) => o.status === 'cancelled').length
      const commissionCollected = (payments.data || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0)
      const totalCommissionEarned = allOrders
        .filter((o: any) => o.status === 'completed')
        .reduce((sum: number, o: any) => sum + (o.commission_amount || 0), 0)
      const pendingCommission = Math.max(0, totalCommissionEarned - commissionCollected)

      setStats({
        totalUsers: users.count || 0, totalDps: dps.count || 0,
        pendingDps: dpsPending.count || 0, approvedDps: dpsApproved.count || 0,
        onlineDps: dpsOnline.count || 0, todayRequests: reqs.count || 0,
        todayDeliveries, liveOrders, completedOrders, cancelledOrders,
        commissionCollected, pendingCommission,
      })

      const recent = allOrders
        .filter((o: any) => o.status === 'completed')
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
      setRecentOrders(recent)

      const dpIds = [...new Set(allOrders.map((o: any) => o.dp_id))]
      const dpStats = dpIds.map((id: string) => {
        const dpOrders = allOrders.filter((o: any) => o.dp_id === id && o.status === 'completed')
        return { dp_id: id, deliveries: dpOrders.length, earnings: dpOrders.reduce((s: number, o: any) => s + (o.dp_earnings || 0), 0) }
      }).sort((a, b) => b.deliveries - a.deliveries).slice(0, 5)

      if (dpStats.length > 0) {
        const { data: dpProfiles } = await supabase
          .from('profiles').select('id, full_name').in('id', dpStats.map(d => d.dp_id))
        const profileMap = new Map((dpProfiles || []).map((p: any) => [p.id, p.full_name]))
        setTopDps(dpStats.map(d => ({ ...d, name: profileMap.get(d.dp_id) || 'Unknown' })))
      }

      const notifData = (notifs.data || []) as AdminNotification[]
      setNotifications(notifData)
      setUnreadCount(notifData.filter(n => !n.is_read).length)
    }
    fetchAll()

    const channel = supabase.channel('admin-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_notifications' },
        (payload: any) => {
          setNotifications(prev => [payload.new as AdminNotification, ...prev])
          setUnreadCount(c => c + 1)
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const markAllRead = async () => {
    await supabase.from('admin_notifications').update({ is_read: true }).eq('is_read', false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  const markRead = async (id: string) => {
    await supabase.from('admin_notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    setUnreadCount(c => Math.max(0, c - 1))
  }

  if (!stats) return <div className="p-8 text-center text-sm text-gray-400">Loading dashboard...</div>

  const exportReport = () => {
    const wb = XLSX.utils.book_new()
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
    if (topDps.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topDps.map(d => ({ Name: d.name, Deliveries: d.deliveries, 'Total Earnings': d.earnings }))), 'Top Partners')
    }
    if (recentOrders.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(recentOrders.map(o => ({
        Summary: o.items_summary || 'Delivery',
        'Delivery Charge': o.delivery_charge,
        'Commission Amount': o.commission_amount,
        'DP Earnings': o.dp_earnings,
        Date: formatTime(o.created_at),
      }))), 'Recent Orders')
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
        <div className="flex items-center gap-2">
          <button onClick={() => setShowNotifPanel(true)} className="relative btn-secondary flex items-center gap-1.5 text-sm">
            <Bell size={16} /> Notifications
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-error-500 px-1 text-[10px] font-bold text-white animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          <button onClick={exportReport} className="btn-secondary flex items-center gap-1.5 text-sm">
            <Download size={16} /> Export
          </button>
        </div>
      </div>

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
          {stats.pendingCommission === 0 && stats.completedOrders > 0 && (
            <p className="mt-1 text-xs text-success-600">All collected!</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

        <div className="card p-5">
          <h3 className="mb-3 text-sm font-bold text-gray-900 dark:text-white">Recent Completed Orders</h3>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-gray-400">No completed orders yet.</p>
          ) : (
            <div className="space-y-2">
              {recentOrders.map((o) => (
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

      {showNotifPanel && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setShowNotifPanel(false)}>
          <div className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-white dark:bg-gray-900 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center gap-2">
                <Bell size={20} className="text-primary-600" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Notifications</h2>
                {unreadCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-error-500 px-1.5 text-[10px] font-bold text-white">{unreadCount}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs font-semibold text-primary-600 hover:text-primary-700">Mark all read</button>
                )}
                <button onClick={() => setShowNotifPanel(false)} className="btn-ghost p-1.5"><X size={18} /></button>
              </div>
            </div>
            <div className="px-5 py-3">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <Bell size={40} className="text-gray-300" />
                  <p className="text-sm text-gray-400">No notifications yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {notifications.map(n => {
                    const Icon = NOTIF_ICONS[n.type] || Bell
                    return (
                      <div key={n.id} onClick={() => markRead(n.id)} className={`flex gap-3 rounded-xl border p-3 cursor-pointer transition-all ${n.is_read ? 'border-gray-100 dark:border-gray-800' : 'border-primary-200 bg-primary-50 dark:border-primary-800 dark:bg-primary-900/20'}`}>
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${n.is_read ? 'bg-gray-100 dark:bg-gray-800' : 'bg-primary-100 dark:bg-primary-900/40'}`}>
                          <Icon size={16} className={n.is_read ? 'text-gray-400' : 'text-primary-600'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${n.is_read ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>{n.title}</p>
                          {n.body && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{n.body}</p>}
                          <p className="text-[10px] text-gray-400 mt-1">{formatTime(n.created_at)}</p>
                        </div>
                        {!n.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-error-500" />}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
