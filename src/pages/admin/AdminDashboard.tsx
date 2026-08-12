import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatTime } from '../../lib/utils'
import { Users, Bike, Package, IndianRupee, TrendingUp, Clock, CheckCircle, XCircle, Activity, Download, Bell, UserPlus, Bike as BikeIcon, CreditCard, X, Star, Zap, AlertCircle, CalendarClock, Repeat, BarChart3 } from 'lucide-react'
import * as XLSX from 'xlsx'
import { CountUp, SkeletonList } from '../../components/ui'

type Stats = {
  totalUsers: number; totalDps: number; pendingDps: number; approvedDps: number; onlineDps: number;
  todayRequests: number; todayDeliveries: number; liveOrders: number; completedOrders: number;
  cancelledOrders: number; commissionCollected: number; pendingCommission: number; todayRevenue: number; monthRevenue: number;
}
type AdminNotification = { id: string; type: string; title: string; body: string | null; related_id: string | null; is_read: boolean; created_at: string }

const NOTIF_ICONS: Record<string, any> = {
  new_user: UserPlus, new_dp: BikeIcon, payment: CreditCard, payment_receipt: CreditCard,
  receipt_confirmed: CheckCircle, receipt_rejected: XCircle, order_completed: CheckCircle, order_cancelled: XCircle,
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
      const liveOrders = allOrders.filter((o: any) => !['completed','cancelled'].includes(o.status)).length
      const completedOrders = allOrders.filter((o: any) => o.status === 'completed').length
      const cancelledOrders = allOrders.filter((o: any) => o.status === 'cancelled').length
      const commissionCollected = (payments.data || []).reduce((s: number, p: any) => s + (p.amount || 0), 0)
      const totalCommissionEarned = allOrders.filter((o: any) => o.status === 'completed').reduce((s: number, o: any) => s + (o.commission_amount || 0), 0)
      const pendingCommission = Math.max(0, totalCommissionEarned - commissionCollected)
      const todayRevenue = allOrders.filter((o: any) => o.status === 'completed' && o.completed_at && o.completed_at >= today).reduce((s: number, o: any) => s + Number(o.delivery_charge || 0), 0)
      const monthRevenue = allOrders.filter((o: any) => o.status === 'completed' && o.completed_at && o.completed_at >= monthStart).reduce((s: number, o: any) => s + Number(o.delivery_charge || 0), 0)
      setStats({ totalUsers: users.count || 0, totalDps: dps.count || 0, pendingDps: dpsPending.count || 0, approvedDps: dpsApproved.count || 0, onlineDps: dpsOnline.count || 0, todayRequests: reqs.count || 0, todayDeliveries, liveOrders, completedOrders, cancelledOrders, commissionCollected, pendingCommission, todayRevenue, monthRevenue })
      setRecentOrders(allOrders.filter((o: any) => o.status === 'completed').sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5))
      const dpIds = [...new Set(allOrders.map((o: any) => o.dp_id))]
      const dpStats = dpIds.map((id: string) => {
        const dpOrders = allOrders.filter((o: any) => o.dp_id === id && o.status === 'completed')
        return { dp_id: id, deliveries: dpOrders.length, earnings: dpOrders.reduce((s: number, o: any) => s + (o.dp_earnings || 0), 0) }
      }).sort((a, b) => b.deliveries - a.deliveries).slice(0, 5)
      if (dpStats.length > 0) {
        const { data: dpProfiles } = await supabase.from('profiles').select('id, full_name').in('id', dpStats.map(d => d.dp_id))
        const pm = new Map((dpProfiles || []).map((p: any) => [p.id, p.full_name]))
        setTopDps(dpStats.map(d => ({ ...d, name: pm.get(d.dp_id) || 'Unknown' })))
      }
      const nd = (notifs.data || []) as AdminNotification[]
      setNotifications(nd); setUnreadCount(nd.filter(n => !n.is_read).length); setLoading(false)
    }
    fetchAll()
    const refreshTimer = setInterval(fetchAll, 30000)
    const nc = supabase.channel('admin-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_notifications' }, (p: any) => { setNotifications(prev => [p.new as AdminNotification, ...prev]); setUnreadCount(c => c + 1) })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'admin_notifications' }, () => { supabase.from('admin_notifications').select('id', { count: 'exact', head: true }).eq('is_read', false).then(({ count }) => setUnreadCount(count || 0)) })
      .subscribe()
    const dc = supabase.channel('admin-realtime-data')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_partners' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commission_payments' }, () => fetchAll())
      .subscribe()
    return () => { clearInterval(refreshTimer); supabase.removeChannel(nc); supabase.removeChannel(dc) }
  }, [])

  const markAllRead = async () => {
    await supabase.from('admin_notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('is_read', false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true }))); setUnreadCount(0)
  }
  const openNotifPanel = () => { setShowNotifPanel(true); if (unreadCount > 0) markAllRead() }
  const markRead = async (id: string) => {
    await supabase.from('admin_notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    setUnreadCount(c => Math.max(0, c - 1))
  }
  const exportReport = () => {
    if (!stats) return
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { Metric: 'Total Users', Value: stats.totalUsers }, { Metric: 'Total Partners', Value: stats.totalDps },
      { Metric: 'Pending Approval', Value: stats.pendingDps }, { Metric: 'Online DPs', Value: stats.onlineDps },
      { Metric: "Today's Requests", Value: stats.todayRequests }, { Metric: "Today's Deliveries", Value: stats.todayDeliveries },
      { Metric: "Today's Revenue", Value: stats.todayRevenue }, { Metric: "Month Revenue", Value: stats.monthRevenue },
      { Metric: 'Live Orders', Value: stats.liveOrders }, { Metric: 'Completed Orders', Value: stats.completedOrders },
      { Metric: 'Cancelled Orders', Value: stats.cancelledOrders }, { Metric: 'Commission Collected', Value: stats.commissionCollected },
      { Metric: 'Pending Commission', Value: stats.pendingCommission },
    ]), 'Summary')
    if (topDps.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topDps.map(d => ({ Name: d.name, Deliveries: d.deliveries, 'Total Earnings': d.earnings }))), 'Top Partners')
    if (recentOrders.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(recentOrders.map(o => ({ Summary: o.items_summary || 'Delivery', 'Delivery Charge': o.delivery_charge, Commission: o.commission_amount, 'DP Earnings': o.dp_earnings, Date: formatTime(o.created_at) }))), 'Recent Orders')
    XLSX.writeFile(wb, `pingget-dashboard-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  if (loading || !stats) return (
    <div className="p-4 md:p-8">
      <div className="mb-6 skeleton h-8 w-48 rounded-xl" />
      <SkeletonList count={8} lines={2} />
    </div>
  )

  const kpiCards = [
    { label: 'Total Users',     value: stats.totalUsers,       icon: Users,        bg: 'rgba(59,130,246,0.15)',   color: '#60a5fa' },
    { label: 'Total Partners',  value: stats.totalDps,         icon: Bike,         bg: 'rgba(196,214,0,0.15)',    color: '#0C8A3E' },
    { label: "Today Requests",  value: stats.todayRequests,    icon: Package,      bg: 'rgba(245,158,11,0.15)',   color: '#fbbf24' },
    { label: "Today Delivered", value: stats.todayDeliveries,  icon: CheckCircle,  bg: 'rgba(16,185,129,0.15)',   color: '#34d399' },
    { label: 'Live Orders',     value: stats.liveOrders,       icon: Activity,     bg: 'rgba(196,214,0,0.15)',    color: '#0C8A3E' },
    { label: 'Completed',       value: stats.completedOrders,  icon: TrendingUp,   bg: 'rgba(16,185,129,0.15)',   color: '#34d399' },
    { label: 'Cancelled',       value: stats.cancelledOrders,  icon: XCircle,      bg: 'rgba(239,68,68,0.15)',    color: '#f87171' },
    { label: 'Online DPs',      value: stats.onlineDps,        icon: Bike,         bg: 'rgba(16,185,129,0.15)',   color: '#34d399' },
  ]

  return (
    <div className="p-4 md:p-8" style={{ background: '#050505', minHeight: '100%' }}>
      <div className="mb-7 flex items-center justify-between animate-fade-in-up">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em]" style={{ color: '#0C8A3E' }}>Operations</p>
          <h1 className="text-[28px] font-extrabold tracking-tight text-[#F5F7F6]">Dashboard</h1>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Live overview</span>
            <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold"
              style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' }}>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" /> LIVE
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openNotifPanel}
            className="relative flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-sm font-semibold transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)' }}>
            <Bell size={16} /> Alerts
            {unreadCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-[#F5F7F6] animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          <button onClick={exportReport}
            className="flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-sm font-semibold transition-all active:scale-95"
            style={{ background: 'rgba(196,214,0,0.15)', border: '1px solid rgba(196,214,0,0.25)', color: '#0C8A3E' }}>
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      {/* Pending DPs warning */}
      {stats.pendingDps > 0 && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl px-4 py-3.5 animate-slide-up"
          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <AlertCircle size={18} className="text-yellow-400 shrink-0" />
          <p className="text-sm font-semibold text-yellow-300">{stats.pendingDps} delivery partner{stats.pendingDps !== 1 ? 's' : ''} awaiting approval</p>
        </div>
      )}

      {/* KPI Grid */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpiCards.map((s, i) => {
          const Icon = s.icon
          return (
            <div key={i} className="card p-4 animate-slide-up" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: s.bg }}>
                <Icon size={18} style={{ color: s.color }} />
              </div>
              <p className="text-2xl font-bold text-[#F5F7F6]"><CountUp value={s.value} /></p>
              <p className="mt-0.5 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Revenue Row */}
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="relative overflow-hidden rounded-3xl p-5 animate-slide-up"
          style={{ background: 'linear-gradient(135deg,rgba(16,185,129,0.15),rgba(16,185,129,0.07))', border: '1px solid rgba(16,185,129,0.2)', animationDelay: '320ms' }}>
          <div className="flex items-center gap-2 mb-2">
            <IndianRupee size={16} className="text-green-400" />
            <p className="text-xs font-semibold text-green-400">Today's Revenue</p>
          </div>
          <p className="text-3xl font-bold text-[#F5F7F6]"><CountUp value={stats.todayRevenue} prefix="₹" /></p>
        </div>
        <div className="relative overflow-hidden rounded-3xl p-5 animate-slide-up"
          style={{ background: 'linear-gradient(135deg,rgba(196,214,0,0.15),rgba(196,214,0,0.07))', border: '1px solid rgba(196,214,0,0.2)', animationDelay: '360ms' }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} style={{ color: '#0C8A3E' }} />
            <p className="text-xs font-semibold" style={{ color: '#0C8A3E' }}>Month Revenue</p>
          </div>
          <p className="text-3xl font-bold text-[#F5F7F6]"><CountUp value={stats.monthRevenue} prefix="₹" /></p>
        </div>
      </div>

      {/* Commission Row */}
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="card p-5 animate-slide-up" style={{ animationDelay: '400ms' }}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={16} className="text-green-400" />
            <p className="text-xs font-semibold text-green-400">Commission Collected</p>
          </div>
          <p className="text-2xl font-bold text-[#F5F7F6]">{formatCurrency(stats.commissionCollected)}</p>
        </div>
        <div className="card p-5 animate-slide-up" style={{ animationDelay: '440ms' }}>
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-yellow-400" />
            <p className="text-xs font-semibold text-yellow-400">Pending Commission</p>
          </div>
          <p className="text-2xl font-bold text-[#F5F7F6]">{formatCurrency(stats.pendingCommission)}</p>
          {stats.pendingCommission === 0 && stats.completedOrders > 0 && (
            <p className="mt-1 text-xs text-green-400">All collected!</p>
          )}
        </div>
      </div>

      {/* Advance Request Analytics */}
      <AdvanceAnalytics />

      {/* Top DPs + Recent Orders */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="card p-5 animate-slide-up" style={{ animationDelay: '480ms' }}>
          <div className="mb-4 flex items-center gap-2">
            <Star size={15} style={{ color: '#fbbf24' }} />
            <h3 className="text-sm font-bold text-[#F5F7F6]">Top Delivery Partners</h3>
          </div>
          {topDps.length === 0 ? (
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>No data yet.</p>
          ) : (
            <div className="space-y-2">
              {topDps.map((dp, i) => (
                <div key={i} className="flex items-center justify-between rounded-2xl px-3 py-2.5"
                  style={{ background: i === 0 ? 'rgba(196,214,0,0.08)' : 'rgba(255,255,255,0.03)' }}>
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                      style={i === 0 ? { background: '#0C8A3E', color: '#0B0B0B' } : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-[#F5F7F6]">{dp.name}</span>
                  </div>
                  <span className="text-sm font-bold" style={{ color: '#0C8A3E' }}>{dp.deliveries} <span className="text-xs font-normal" style={{ color: 'rgba(255,255,255,0.4)' }}>orders</span></span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5 animate-slide-up" style={{ animationDelay: '520ms' }}>
          <div className="mb-4 flex items-center gap-2">
            <Zap size={15} style={{ color: '#0C8A3E' }} />
            <h3 className="text-sm font-bold text-[#F5F7F6]">Recent Orders</h3>
          </div>
          {recentOrders.length === 0 ? (
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>No completed orders yet.</p>
          ) : (
            <div className="space-y-2">
              {recentOrders.map((o) => (
                <div key={o.id} className="flex items-center justify-between rounded-2xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#F5F7F6] truncate">{o.items_summary || 'Delivery'}</p>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{formatTime(o.created_at)}</p>
                  </div>
                  <span className="text-sm font-bold text-green-400">{formatCurrency(o.delivery_charge)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Notification Slide Panel */}
      {showNotifPanel && (
        <div className="fixed inset-0 z-50 animate-fade-in" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => setShowNotifPanel(false)}>
          <div className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto animate-slide-in-right"
            style={{ background: '#181818', borderLeft: '1px solid rgba(255,255,255,0.08)', boxShadow: '-8px 0 40px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4"
              style={{ background: 'rgba(18,18,18,0.95)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2">
                <Bell size={18} style={{ color: '#0C8A3E' }} />
                <h2 className="text-base font-bold text-[#F5F7F6]">Notifications</h2>
                {unreadCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-[#F5F7F6]">{unreadCount}</span>}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && <button onClick={markAllRead} className="text-xs font-semibold" style={{ color: '#0C8A3E' }}>Mark all read</button>}
                <button onClick={() => setShowNotifPanel(false)} className="btn-icon h-8 w-8 rounded-xl"><X size={15} style={{ color: 'rgba(255,255,255,0.5)' }} /></button>
              </div>
            </div>
            <div className="px-4 py-3 space-y-2">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <Bell size={36} style={{ color: 'rgba(255,255,255,0.2)' }} />
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>No notifications yet</p>
                </div>
              ) : notifications.map(n => {
                const Icon = NOTIF_ICONS[n.type] || Bell
                return (
                  <div key={n.id} onClick={() => markRead(n.id)} className="flex gap-3 rounded-2xl p-3.5 cursor-pointer transition-all"
                    style={n.is_read
                      ? { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }
                      : { background: 'rgba(196,214,0,0.07)', border: '1px solid rgba(196,214,0,0.18)' }}>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                      style={n.is_read ? { background: 'rgba(255,255,255,0.06)' } : { background: 'rgba(196,214,0,0.15)' }}>
                      <Icon size={16} style={{ color: n.is_read ? 'rgba(255,255,255,0.35)' : '#0C8A3E' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: n.is_read ? 'rgba(255,255,255,0.55)' : '#fff' }}>{n.title}</p>
                      {n.body && <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{n.body}</p>}
                      <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.28)' }}>{formatTime(n.created_at)}</p>
                    </div>
                    {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AdvanceAnalytics() {
  const [advanceStats, setAdvanceStats] = useState<any>(null)
  const [loadingAdv, setLoadingAdv] = useState(true)

  useEffect(() => {
    const fetchAdvanceStats = async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
      const next7 = new Date(today); next7.setDate(next7.getDate() + 7)

      const { data: allAdvance } = await supabase
        .from('requests')
        .select('id, status, scheduled_date, scheduled_timestamp, estimated_total_charge, recurring_type, cancellation_fee, created_at, charge_breakdown')
        .eq('order_type', 'advance')
        .order('created_at', { ascending: false })
        .limit(500)

      const rows = allAdvance || []
      const todayStr = today.toISOString().slice(0, 10)
      const tomorrowStr = tomorrow.toISOString().slice(0, 10)

      const todayCount = rows.filter((r: any) => r.scheduled_date === todayStr).length
      const tomorrowCount = rows.filter((r: any) => r.scheduled_date === tomorrowStr).length
      const next7Count = rows.filter((r: any) => {
        if (!r.scheduled_date) return false
        const d = new Date(r.scheduled_date); d.setHours(0, 0, 0, 0)
        return d >= today && d <= next7
      }).length
      const waiting = rows.filter((r: any) => r.status === 'scheduled' || r.status === 'pending').length
      const accepted = rows.filter((r: any) => r.status === 'accepted' || r.status === 'confirmed').length
      const completed = rows.filter((r: any) => r.status === 'completed').length
      const expired = rows.filter((r: any) => r.status === 'expired').length
      const recurring = rows.filter((r: any) => r.recurring_type && r.recurring_type !== 'none').length
      const revenue = rows.filter((r: any) => r.status === 'completed').reduce((s: number, r: any) => s + Number(r.estimated_total_charge || 0), 0)
      const bookingRevenue = rows.reduce((s: number, r: any) => s + Number(r.estimated_total_charge || 0), 0)
      const cancellationRevenue = rows.filter((r: any) => r.status === 'cancelled').reduce((s: number, r: any) => s + Number(r.cancellation_fee || 0), 0)

      setAdvanceStats({ todayCount, tomorrowCount, next7Count, waiting, accepted, completed, expired, recurring, revenue, bookingRevenue, cancellationRevenue, total: rows.length })
      setLoadingAdv(false)
    }
    fetchAdvanceStats()
    const channel = supabase.channel('admin-advance-analytics')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, fetchAdvanceStats)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  if (loadingAdv || !advanceStats) return null

  const cards = [
    { label: "Today's Scheduled", value: advanceStats.todayCount, icon: CalendarClock, color: '#0C8A3E' },
    { label: 'Tomorrow', value: advanceStats.tomorrowCount, icon: CalendarClock, color: '#818cf8' },
    { label: 'Next 7 Days', value: advanceStats.next7Count, icon: CalendarClock, color: '#60a5fa' },
    { label: 'Waiting', value: advanceStats.waiting, icon: Clock, color: '#fbbf24' },
    { label: 'Accepted', value: advanceStats.accepted, icon: CheckCircle, color: '#34d399' },
    { label: 'Completed', value: advanceStats.completed, icon: CheckCircle, color: '#0C8A3E' },
    { label: 'Expired', value: advanceStats.expired, icon: XCircle, color: '#6b7280' },
    { label: 'Recurring', value: advanceStats.recurring, icon: Repeat, color: '#c084fc' },
  ]

  const revenueCards = [
    { label: 'Advance Revenue', value: advanceStats.revenue, icon: IndianRupee, color: '#0C8A3E' },
    { label: 'Booking Revenue', value: advanceStats.bookingRevenue, icon: TrendingUp, color: '#60a5fa' },
    { label: 'Cancellation Revenue', value: advanceStats.cancellationRevenue, icon: XCircle, color: '#f87171' },
  ]

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={20} style={{ color: '#0C8A3E' }} />
        <h2 className="text-lg font-bold text-[#F5F7F6]">Advance Request Analytics</h2>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {cards.map((c, i) => {
          const Icon = c.icon
          return (
            <div key={i} className="card p-4 animate-slide-up" style={{ animationDelay: `${i * 30}ms` }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${c.color}1a` }}>
                  <Icon size={16} style={{ color: c.color }} />
                </div>
                <span className="text-2xl font-bold text-[#F5F7F6]">{c.value}</span>
              </div>
              <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>{c.label}</p>
            </div>
          )
        })}
      </div>

      {/* Revenue Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        {revenueCards.map((c, i) => {
          const Icon = c.icon
          return (
            <div key={i} className="card p-4 animate-slide-up" style={{ animationDelay: `${i * 30}ms` }}>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${c.color}1a` }}>
                  <Icon size={18} style={{ color: c.color }} />
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{c.label}</p>
                  <p className="text-lg font-bold" style={{ color: c.color }}>₹{c.value.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Simple Bar Chart */}
      <div className="card p-5">
        <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#0C8A3E' }}>Status Distribution</p>
        <div className="space-y-3">
          {[
            { label: 'Waiting', count: advanceStats.waiting, color: '#fbbf24' },
            { label: 'Accepted', count: advanceStats.accepted, color: '#34d399' },
            { label: 'Completed', count: advanceStats.completed, color: '#0C8A3E' },
            { label: 'Expired', count: advanceStats.expired, color: '#6b7280' },
            { label: 'Recurring', count: advanceStats.recurring, color: '#c084fc' },
          ].map((bar, i) => {
            const max = Math.max(advanceStats.total, 1)
            const pct = (bar.count / max) * 100
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="w-24 text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>{bar.label}</span>
                <div className="flex-1 h-6 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: bar.color }} />
                </div>
                <span className="w-8 text-right text-xs font-bold text-[#F5F7F6]">{bar.count}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
