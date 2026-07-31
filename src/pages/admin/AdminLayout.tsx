import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase } from '../../lib/supabase'
import { LayoutDashboard, Users, MapPin, ClipboardList, LogOut, CreditCard, UserCheck, Bell, Activity, Package, Menu, X } from 'lucide-react'
import Watermark from '../../components/Watermark'
import Brand from '../../components/Brand'
import { useEffect, useState } from 'react'
import { usePushNotifications } from '../../hooks/usePushNotifications'

export default function AdminLayout() {
  const { profile, signOut } = useAuth()
  usePushNotifications()
  const navigate = useNavigate()
  const location = useLocation()
  const [unreadCount, setUnreadCount] = useState(0)
  const [pendingDps, setPendingDps] = useState(0)
  const [pendingReceipts, setPendingReceipts] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const fetchCounts = async () => {
      const [notifRes, dpRes, receiptRes] = await Promise.all([
        supabase.from('admin_notifications').select('id', { count: 'exact', head: true }).eq('is_read', false),
        supabase.from('delivery_partners').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('dp_commission_receipts').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
      ])
      setUnreadCount(notifRes.count || 0)
      setPendingDps(dpRes.count || 0)
      setPendingReceipts(receiptRes.count || 0)
    }
    fetchCounts()
    const channel = supabase.channel('admin-layout-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_notifications' }, fetchCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_partners' }, fetchCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dp_commission_receipts' }, fetchCounts)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    if (location.pathname === '/admin' && unreadCount > 0) {
      supabase.from('admin_notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('is_read', false)
        .then(() => setUnreadCount(0))
    }
  }, [location.pathname])

  useEffect(() => { if (location.pathname === '/admin/dps') setPendingDps(0) }, [location.pathname])
  useEffect(() => { if (location.pathname === '/admin/payments') setPendingReceipts(0) }, [location.pathname])
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  const navItems = [
    { path: '/admin',                 label: 'Dashboard',  icon: LayoutDashboard, badge: unreadCount },
    { path: '/admin/dps',             label: 'Partners',   icon: Users,           badge: pendingDps },
    { path: '/admin/users',           label: 'Users',      icon: UserCheck,       badge: 0 },
    { path: '/admin/cities',          label: 'Cities',     icon: MapPin,          badge: 0 },
    { path: '/admin/orders',          label: 'Orders',     icon: ClipboardList,   badge: 0 },
    { path: '/admin/payments',        label: 'Payments',   icon: CreditCard,      badge: pendingReceipts },
    { path: '/admin/notifications',   label: 'Notify',     icon: Bell,            badge: 0 },
    { path: '/admin/categories',      label: 'Categories', icon: Package,         badge: 0 },
    { path: '/admin/operations',      label: 'Live Ops',   icon: Activity,        badge: 0 },
  ]

  const isActive = (path: string) => path === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(path)

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between p-5 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <Brand size="sm" showTagline={false} />
        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>Admin</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map(item => {
          const Icon = item.icon
          const active = isActive(item.path)
          return (
            <button key={item.path} onClick={() => navigate(item.path)}
              className="relative flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition-all"
              style={active
                ? { background: 'rgba(166,179,0,0.15)', border: '1px solid rgba(166,179,0,0.25)' }
                : { border: '1px solid transparent' }}>
              <Icon size={18} style={{ color: active ? '#A6B300' : 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
              <span className="flex-1 text-sm font-semibold" style={{ color: active ? '#A6B300' : 'rgba(255,255,255,0.65)' }}>
                {item.label}
              </span>
              {item.badge > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="shrink-0 p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="mb-3 flex items-center gap-2.5 rounded-2xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: 'rgba(166,179,0,0.2)', color: '#A6B300', fontSize: 13, fontWeight: 700 }}>
            {profile?.full_name?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{profile?.full_name || 'Admin'}</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Administrator</p>
          </div>
        </div>
        <button onClick={() => signOut()} className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all active:scale-95" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}>
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-[#0B0B0B]" style={{ fontFamily: 'Inter, sans-serif' }}>
      <Watermark />

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col h-full" style={{ background: '#181818', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden animate-fade-in">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }} onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-10 h-full w-72 animate-slide-in-right" style={{ background: '#181818', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <div className="flex items-center gap-3 px-4 py-3 md:hidden shrink-0" style={{ background: 'rgba(11,11,11,0.95)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="btn-icon">
            {sidebarOpen ? <X size={18} style={{ color: 'rgba(255,255,255,0.7)' }} /> : <Menu size={18} style={{ color: 'rgba(255,255,255,0.7)' }} />}
          </button>
          <Brand size="sm" showTagline={false} />
          {(unreadCount + pendingDps + pendingReceipts) > 0 && (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
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
