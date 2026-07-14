import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatTime } from '../../lib/utils'
import { Users, Bike, Package, IndianRupee, TrendingUp, Clock, CheckCircle, XCircle, Activity, Download, Bell, UserPlus, Bike as BikeIcon, CreditCard, X, Star, Zap } from 'lucide-react'
import * as XLSX from 'xlsx'
import { SkeletonCard, CountUp } from '../../components/ui'

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
  todayRevenue: number
  monthRevenue: number
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
  payment_receipt: CreditCard,
  receipt_confirmed: CheckCircle,
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [topDps, setTopDps] = useState<any[]>([])
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const [loading, setLoading] = useState(true)

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
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      const todayDeliveries = allOrders.filter((o: any) => o.status === 'completed' && o.completed_at && o.completed_at >= today).length
      const liveOrders = allOrders.filter((o: any) => !['completed', 'cancelled'].includes(o.status)).length
      const completedOrders = allOrders.filter((o: any) => o.status === 'completed').length
      const cancelledOrders = allOrders.filter((o: any) => o.status === 'cancelled').length
      const commissionCollected = (payments.data || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0)
      const totalCommissionEarned = allOrders
        .filter((o: any) => o.status === 'completed')
        .reduce((sum: number, o: any) => sum + (o.commission_amount || 0), 0)
      const pendingCommission = Math.max(0, totalCommissionEarned - commissionCollected)
      const todayRevenue = allOrders
        .filter((o: any) => o.status === 'completed' && o.completed_at && o.completed_at >= today)
        .reduce((s: number, o: any) => s + Number(o.delivery_charge || 0), 0)
      const monthRevenue = allOrders
        .filter((o: any) => o.status === 'completed' && o.completed_at && o.completed_at >= monthStart)
        .reduce((s: number, o: any) => s + Number(o.delivery_charge || 0), 0)

      setStats({
        totalUsers: users.count || 0, totalDps: dps.count || 0,
        pendingDps: dpsPending.count || 0, approvedDps: dpsApproved.count || 0,
        onlineDps: dpsOnline.count || 0, todayRequests: reqs.count || 0,
        todayDeliveries, liveOrders, completedOrders, cancelledOrders,
        commissionCollected, pendingCommission, todayRevenue, monthRevenue,
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
      setLoading(false)
    }
    fetchAll()

    const refreshTimer = setInterval(fetchAll, 30000)

    const notifChannel = supabase.channel('admin-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_notifications' },
        (payload: any) => {
          setNotifications(prev => [payload.new as AdminNotification, ...prev])
          setUnreadCount(c => c + 1)
        })
      .subscribe()

    const dataChannel = supabase.channel('admin-realtime-data')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_partners' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commission_payments' }, () => fetchAll())
      .subscribe()

    return () => {
      clearInterval(refreshTimer)
      supabase.removeChannel(notifChannel)
      supabase.removeChannel(dataChannel)
    }
  }, [])

  const markAllRead = async () => {
    await supabase.from('admin_notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('is_read', false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  const openNotifPanel = () => {
    setShowNotifPanel(true)
    if (unreadCount > 0) markAllRead()
  }

  const markRead = async (id: string) => {
    await supabase.from('admin_notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    setUnreadCount(c => Math.max(0, c - 1))
  }

  const exportReport = () => {
    if (!stats) return
    const wb = XLSX.utils.book_new()
    const summaryRows = [
      { Metric: 'Total Users', Value: stats.totalUsers },
      { Metric: 'Total Partners', Value: stats.totalDps },
      { Metric: 'Pending Approval', Value: stats.pendingDps },
      { Metric: 'Approved Partners', Value: stats.approvedDps },
      { Metric: 'Online DPs', Value: stats.onlineDps },
      { Metric: "Today's Requests", Value: stats.todayRequests },
      { Metric: "Today's Deliveries", Value: stats.todayDeliveries },
      { Metric: "Today's Revenue", Value: stats.todayRevenue },
      { Metric: "Month Revenue", Value: stats.monthRevenue },
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

  if (loading || !stats) {
    return (
      <div className="p-4 md:p-8">
        <div className="mb-6 h-8 w-48 skeleton rounded-xl" />
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[1,2,3,4].map(i => <div key={i} className="card p-4"><div className="h-10 w-10 skeleton rounded-xl mb-2" /><div className="h-6 w-16 skeleton mb-1" /><div className="h-3 w-20 skeleton" /></div>)}
        </div>
        <div className="space-y-3"><SkeletonCard lines={3} /><SkeletonCard lines={3} /></div>
      </div>
    )
  }

  const kpiCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-primary-600 bg-primary-50 dark:bg-primary-900/30', delay: 0 },
    { label: 'Total Partners', value: stats.totalDps, icon: Bike, color: 'text-accent-600 bg-accent-50 dark:bg-accent-900/30', delay: 50 },
    { label: "Today's Requests", value: stats.todayRequests, icon: Package, color: 'text-warning-600 bg-warning-50 dark:bg-warning-900/30', delay: 100 },
    { label: "Today's Deliveries", value: stats.todayDeliveries, icon: CheckCircle, color: 'text-success-600 bg-success-50 dark:bg-success-900/30', delay: 150 },
    { label: 'Live Orders', value: stats.liveOrders, icon: Activity, color: 'text-primary-600 bg-primary-50 dark:bg-primary-900/30', delay: 200 },
    { label: 'Completed', value: stats.completedOrders, icon: TrendingUp, color: 'text-success-600 bg-success-50 dark:bg-success-900/30', delay: 250 },
    { label: 'Cancelled', value: stats.cancelledOrders, icon: XCircle, color: 'text-error-600 bg-error-50 dark:bg-error-900/30', delay: 300 },
    { label: 'Online DPs', value: stats.onlineDps, icon: Bike, color: 'text-success-600 bg-success-50 dark:bg-success-900/30', delay: 350 },
  ]

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <div className="mt-1 flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-sm text-white/50">
              Overview of PingGET operations
            </span>
            <span className="flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-bold text-success-600 dark:bg-success-900/30 dark:text-success-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success-500" /> LIVE
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openNotifPanel} className="relative btn-secondary flex items-center gap-1.5 text-sm">
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

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpiCards.map((s, i) => {
          const Icon = s.icon
          return (
            <div key={i} className="card card-hover p-4 animate-slide-up" style={{ animationDelay: `${s.delay}ms` }}>
              <div className={`mb-2 flex h-10 w-10 items-center justify-center rounded-xl ${s.color}`}>
                <Icon size={20} />
              </div>
              <p className="text-2xl font-bold text-white">
                <CountUp value={s.value} />
              </p>
              <p className="text-xs text-white/50">{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Revenue Cards */}
      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="card p-5 animate-slide-up" style={{ animationDelay: '400ms' }}>
          <div className="flex items-center gap-2 text-success-600 dark:text-success-400">
            <IndianRupee size={20} />
            <span className="text-sm font-medium">Today&apos;s Revenue</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-white">
            <CountUp value={stats.todayRevenue} prefix="₹" />
          </p>
        </div>
        <div className="card p-5 animate-slide-up" style={{ animationDelay: '450ms' }}>
          <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400">
            <TrendingUp size={20} />
            <span className="text-sm font-medium">This Month&apos;s Revenue</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-white">
            <CountUp value={stats.monthRevenue} prefix="₹" />
          </p>
        </div>
      </div>

      {/* Commission Cards */}
      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="card p-5 animate-slide-up" style={{ animationDelay: '500ms' }}>
          <div className="flex items-center gap-2 text-success-600 dark:text-success-400">
            <CheckCircle size={20} />
            <span className="text-sm font-medium">Commission Collected</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-white">{formatCurrency(stats.commissionCollected)}</p>
        </div>
        <div className="card p-5 animate-slide-up" style={{ animationDelay: '550ms' }}>
          <div className="flex items-center gap-2 text-error-600 dark:text-error-400">
            <Clock size={20} />
            <span className="text-sm font-medium">Pending Commission</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-white">{formatCurrency(stats.pendingCommission)}</p>
          {stats.pendingCommission === 0 && stats.completedOrders > 0 && (
            <p className="mt-1 text-xs text-success-600">All collected!</p>
          )}
        </div>
      </div>

      {/* Top Partners & Recent Orders */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="card p-5 animate-slide-up" style={{ animationDelay: '600ms' }}>
          <div className="mb-3 flex items-center gap-2">
            <Star size={16} className="text-accent-400" />
            <h3 className="text-sm font-bold text-white">Top Delivery Partners</h3>
          </div>
          {topDps.length === 0 ? (
            <p className="text-sm text-white/40">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {topDps.map((dp, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl px-2 py-1.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">{i + 1}</span>
                    <span className="text-sm font-medium text-white">{dp.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-white">{dp.deliveries}</span>
                    <span className="ml-1 text-xs text-white/40">deliveries</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5 animate-slide-up" style={{ animationDelay: '650ms' }}>
          <div className="mb-3 flex items-center gap-2">
            <Zap size={16} className="text-primary-500" />
            <h3 className="text-sm font-bold text-white">Recent Completed Orders</h3>
          </div>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-white/40">No completed orders yet.</p>
          ) : (
            <div className="space-y-2">
              {recentOrders.map((o) => (
                <div key={o.id} className="flex items-center justify-between rounded-xl px-2 py-1.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
                  <div>
                    <p className="text-sm font-medium text-white">{o.items_summary || 'Delivery'}</p>
                    <p className="text-xs text-white/40">{formatTime(o.created_at)}</p>
                  </div>
                  <span className="text-sm font-bold text-success-600 dark:text-success-400">{formatCurrency(o.delivery_charge)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Notification Panel */}
      {showNotifPanel && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setShowNotifPanel(false)}>
          <div className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto glass shadow-2xl animate-slide-in-right" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-white/95 px-5 py-4 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/95">
              <div className="flex items-center gap-2">
                <Bell size={20} className="text-primary-600" />
                <h2 className="text-lg font-bold text-white">Notifications</h2>
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
                  <p className="text-sm text-white/40">No notifications yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {notifications.map(n => {
                    const Icon = NOTIF_ICONS[n.type] || Bell
                    return (
                      <div key={n.id} onClick={() => markRead(n.id)} className={`flex gap-3 rounded-xl border p-3 cursor-pointer transition-all ${n.is_read ? 'border-white/10' : 'border-primary-200 bg-primary-50 dark:border-primary-800 dark:bg-primary-900/20'}`}>
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${n.is_read ? 'glass' : 'bg-primary-100 dark:bg-primary-900/40'}`}>
                          <Icon size={16} className={n.is_read ? 'text-white/40' : 'text-primary-600'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${n.is_read ? 'text-white/60' : 'text-white'}`}>{n.title}</p>
                          {n.body && <p className="text-xs text-white/50 mt-0.5">{n.body}</p>}
                          <p className="text-[10px] text-white/40 mt-1">{formatTime(n.created_at)}</p>
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
