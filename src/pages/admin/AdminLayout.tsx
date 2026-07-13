import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase } from '../../lib/supabase'
import { LayoutDashboard, Users, MapPin, ClipboardList, LogOut, CreditCard, UserCheck, Bell } from 'lucide-react'
import Brand from '../../components/Brand'
import { useEffect, useState } from 'react'

export default function AdminLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [unreadCount, setUnreadCount] = useState(0)
  const [pendingDps, setPendingDps] = useState(0)
  const [pendingReceipts, setPendingReceipts] = useState(0)

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_notifications' }, () => fetchCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_partners' }, () => fetchCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dp_commission_receipts' }, () => fetchCounts())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const navItems = [
    { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, badge: unreadCount },
    { path: '/admin/dps', label: 'Partners', icon: Users, badge: pendingDps },
    { path: '/admin/users', label: 'Users', icon: UserCheck, badge: 0 },
    { path: '/admin/cities', label: 'Cities', icon: MapPin, badge: 0 },
    { path: '/admin/orders', label: 'Orders', icon: ClipboardList, badge: 0 },
    { path: '/admin/payments', label: 'Payments', icon: CreditCard, badge: pendingReceipts },
  ]

  const isActive = (path: string) => location.pathname === path

  const renderBadge = (count: number) => count > 0 ? (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-error-500 px-1 text-[10px] font-bold text-white animate-pulse">
      {count > 99 ? '99+' : count}
    </span>
  ) : null

  const renderMobileBadge = (count: number) => count > 0 ? (
    <span className="absolute right-1 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-error-500 px-1 text-[9px] font-bold text-white animate-pulse">
      {count > 99 ? '99+' : count}
    </span>
  ) : null

  const NotifBell = ({ size = 18 }: { size?: number }) => (
    <button onClick={() => navigate('/admin')} className="relative btn-ghost p-2">
      <Bell size={size} />
      {unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error-500 px-1 text-[9px] font-bold text-white animate-pulse">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  )

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <aside className="fixed left-0 top-0 z-20 hidden h-screen w-64 border-r border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 md:block">
        <div className="flex items-center gap-2 border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <Brand size="lg" showTagline />
        </div>
        <nav className="mt-4 space-y-1 px-3">
          {navItems.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${isActive(item.path) ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'}`}
              >
                <Icon size={18} /> {item.label}
                {renderBadge(item.badge)}
              </button>
            )
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 space-y-1 border-t border-gray-100 p-3 dark:border-gray-800">
          <button onClick={() => signOut()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-error-600 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-950/40">
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </aside>

      <header className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between border-b border-gray-100 bg-white/80 px-4 py-3 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/80 md:hidden">
        <Brand size="sm" showTagline={false} />
        <div className="flex items-center gap-1">
          <NotifBell size={20} />
          <button onClick={() => signOut()} className="btn-ghost p-2"><LogOut size={18} /></button>
        </div>
      </header>

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-gray-100 bg-white/90 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/90 md:hidden">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 ${isActive(item.path) ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`}
              >
                <Icon size={20} />
                <span className="text-xs font-medium">{item.label}</span>
                {renderMobileBadge(item.badge)}
              </button>
            )
          })}
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto pb-20 pt-16 md:ml-64 md:pb-0 md:pt-0">
        <Outlet />
      </main>
    </div>
  )
}
