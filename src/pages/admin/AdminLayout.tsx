import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase } from '../../lib/supabase'
import { LayoutDashboard, Users, MapPin, ClipboardList, LogOut, CreditCard, UserCheck, Bell, Activity, Menu, X, CalendarClock, Settings, Inbox, MessageCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { BrandWordmark } from '../../components/Brand'
import { pg } from '../../design/tokens'

/** Completely rebuilt Admin console chrome */
export default function AdminLayout() {
  const { profile, signOut } = useAuth()
  usePushNotifications()
  const navigate = useNavigate()
  const location = useLocation()
  const [unreadCount, setUnreadCount] = useState(0)
  const [pendingDps, setPendingDps] = useState(0)
  const [pendingReceipts, setPendingReceipts] = useState(0)
  const [supportUnread, setSupportUnread] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const fetchCounts = async () => {
      const [notifRes, dpRes, receiptRes, supportRes] = await Promise.all([
        supabase.from('admin_notifications').select('id', { count: 'exact', head: true }).eq('is_read', false),
        supabase.from('delivery_partners').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('dp_commission_receipts').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
        supabase.from('support_chats').select('admin_unread').gt('admin_unread', 0),
      ])
      setUnreadCount(notifRes.count || 0)
      setPendingDps(dpRes.count || 0)
      setPendingReceipts(receiptRes.count || 0)
      setSupportUnread((supportRes.data || []).reduce((s: number, r: { admin_unread?: number }) => s + (r.admin_unread || 0), 0))
    }
    fetchCounts()
    const channel = supabase.channel('admin-layout-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_notifications' }, fetchCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_partners' }, fetchCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dp_commission_receipts' }, fetchCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_chats' }, fetchCounts)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, fetchCounts)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    if (location.pathname === '/admin' && unreadCount > 0) {
      supabase.from('admin_notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('is_read', false)
        .then(() => setUnreadCount(0))
    }
  }, [location.pathname, unreadCount])
  useEffect(() => { if (location.pathname === '/admin/dps') setPendingDps(0) }, [location.pathname])
  useEffect(() => { if (location.pathname === '/admin/payments') setPendingReceipts(0) }, [location.pathname])
  useEffect(() => {
    if (location.pathname.startsWith('/admin/support') && supportUnread > 0) {
      // Mark support chats read when Support page is opened
      supabase.from('support_chats').update({ admin_unread: 0 }).gt('admin_unread', 0)
        .then(() => setSupportUnread(0))
    }
  }, [location.pathname, supportUnread])
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  const navItems = [
    { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, badge: unreadCount },
    { path: '/admin/dps', label: 'Partners', icon: Users, badge: pendingDps },
    { path: '/admin/users', label: 'Users', icon: UserCheck, badge: 0 },
    { path: '/admin/cities', label: 'Cities', icon: MapPin, badge: 0 },
    { path: '/admin/waitlist', label: 'Waitlist', icon: Inbox, badge: 0 },
    { path: '/admin/orders', label: 'Orders', icon: ClipboardList, badge: 0 },
    { path: '/admin/advance-requests', label: 'Advance', icon: CalendarClock, badge: 0 },
    { path: '/admin/advance-settings', label: 'Adv Settings', icon: Settings, badge: 0 },
    { path: '/admin/payments', label: 'Payments', icon: CreditCard, badge: pendingReceipts },
    { path: '/admin/support', label: 'Support', icon: MessageCircle, badge: supportUnread },
    { path: '/admin/notifications', label: 'Notify', icon: Bell, badge: 0 },
    { path: '/admin/operations', label: 'Live Ops', icon: Activity, badge: 0 },
  ]

  const isActive = (path: string) => path === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(path)

  const Sidebar = () => (
    <div className="flex h-full flex-col" style={{ background: pg.surface, color: pg.ink }}>
      <div className="flex items-center justify-between px-5 py-5" style={{ borderBottom: `1px solid ${pg.headerBorder}`, background: pg.headerElevated }}>
        <div>
          <BrandWordmark size="sm" showTagline={false} align="left" className="mb-1" />
          <p className="text-sm font-extrabold">Admin Console</p>
        </div>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold" style={{ background: 'rgba(255,77,79,0.16)', color: '#FCA5A5' }}>OPS</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map(item => {
          const Icon = item.icon
          const active = isActive(item.path)
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left"
              style={active
                ? { background: pg.limeDim, border: `1px solid rgba(196,214,0,0.28)` }
                : { border: '1px solid transparent' }}
            >
              <Icon size={18} style={{ color: active ? pg.lime : pg.text3 }} />
              <span className="flex-1 text-sm font-bold" style={{ color: active ? pg.lime : pg.text2 }}>{item.label}</span>
              {item.badge > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-[#F5F7F6]">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>
      <div className="p-4" style={{ borderTop: `1px solid ${pg.line}` }}>
        <div className="mb-3 flex items-center gap-2.5 rounded-2xl px-3 py-2.5" style={{ background: pg.surface2, color: pg.ink }}>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-extrabold" style={{ background: pg.limeDim, color: pg.lime }}>
            {profile?.full_name?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold">{profile?.full_name || 'Admin'}</p>
            <p className="text-[11px]" style={{ color: pg.text4 }}>Administrator</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-bold"
          style={{ background: 'rgba(255,77,79,0.1)', color: '#FCA5A5', border: '1px solid rgba(255,77,79,0.2)' }}
        >
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-[100dvh]" style={{ background: pg.bg }}>
      <aside className="hidden h-full w-72 shrink-0 md:flex" style={{ borderRight: `1px solid ${pg.line}` }}>
        <Sidebar />
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-[#000000]/70" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-10 h-full w-72">
            <Sidebar />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 md:hidden" style={{ background: pg.header, borderBottom: `1px solid ${pg.headerBorder}`, boxShadow: '0 8px 24px rgba(12,138,62,0.12)' }}>
          <button type="button" onClick={() => setSidebarOpen(!sidebarOpen)} className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: pg.surface2, color: pg.ink }}>
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <p className="text-sm font-extrabold">Admin</p>
          {(unreadCount + pendingDps + pendingReceipts) > 0 && (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-[#F5F7F6]">
              {unreadCount + pendingDps + pendingReceipts}
            </span>
          )}
        </div>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
