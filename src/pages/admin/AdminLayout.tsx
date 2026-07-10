import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth, useTheme } from '../../context'
import { LayoutDashboard, Users, MapPin, ClipboardList, Moon, Sun, LogOut, CreditCard, UserCheck } from 'lucide-react'
import Brand from '../../components/Brand'

export default function AdminLayout() {
  const { profile, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  const navItems = [
    { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/dps', label: 'Partners', icon: Users },
    { path: '/admin/users', label: 'Users', icon: UserCheck },
    { path: '/admin/cities', label: 'Cities', icon: MapPin },
    { path: '/admin/orders', label: 'Orders', icon: ClipboardList },
    { path: '/admin/payments', label: 'Payments', icon: CreditCard },
  ]

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-20 hidden h-screen w-64 border-r border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 md:block">
        <div className="flex items-center gap-2 border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <Brand size="md" variant="dark" />
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
              </button>
            )
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 space-y-1 border-t border-gray-100 p-3 dark:border-gray-800">
          <button onClick={toggle} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800">
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />} {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          </button>
          <button onClick={() => signOut()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-error-600 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-950/40">
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between border-b border-gray-100 bg-white/80 px-4 py-3 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/80 md:hidden">
        <div className="flex items-center gap-2">
          <Brand size="sm" variant="dark" showTagline={false} />
        </div>
        <div className="flex gap-1">
          <button onClick={toggle} className="btn-ghost p-2">{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</button>
          <button onClick={() => signOut()} className="btn-ghost p-2"><LogOut size={18} /></button>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-gray-100 bg-white/90 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/90 md:hidden">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2 ${isActive(item.path) ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`}
              >
                <Icon size={20} />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-20 pt-16 md:ml-64 md:pb-0 md:pt-0">
        <Outlet />
      </main>
    </div>
  )
}
