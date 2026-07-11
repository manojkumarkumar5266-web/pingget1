import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context'
import { Chrome as Home, Plus, ClipboardList, Bell, User, LogOut, X, MessageCircle } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import Brand from '../../components/Brand'

type AcceptedToast = { requestId: string; body: string }

export default function UserLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [unreadCount, setUnreadCount] = useState(0)
  const [acceptedToast, setAcceptedToast] = useState<AcceptedToast | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (toast: AcceptedToast) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setAcceptedToast(toast)
    toastTimerRef.current = setTimeout(() => setAcceptedToast(null), 12000)
  }

  const openChatFromToast = async (requestId: string) => {
    setAcceptedToast(null)
    const { data } = await supabase
      .from('chat_rooms')
      .select('id')
      .eq('request_id', requestId)
      .maybeSingle()
    if (data) navigate(`/app/chat/${data.id}`)
  }

  useEffect(() => {
    const fetchUnread = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile!.id)
        .eq('is_read', false)
      setUnreadCount(count || 0)
    }
    fetchUnread()

    const channel = supabase
      .channel('user-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profile!.id}`,
      }, (payload) => {
        fetchUnread()
        const notif = payload.new as any
        if (notif.type === 'request_accepted' && notif.related_id) {
          showToast({ requestId: notif.related_id, body: notif.body || 'A delivery partner accepted your request.' })
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [profile])

  const navItems = [
    { path: '/app', label: 'Home', icon: Home },
    { path: '/app/orders', label: 'Orders', icon: ClipboardList },
    { path: '/app/notifications', label: 'Alerts', icon: Bell, badge: unreadCount },
    { path: '/app/profile', label: 'Profile', icon: User },
  ]

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <Brand size="sm" showTagline={false} />
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => signOut()} className="p-2 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Real-time accepted toast */}
      {acceptedToast && (
        <div className="fixed top-4 left-4 right-4 z-50 animate-slide-up">
          <div className="mx-auto max-w-md rounded-2xl bg-gray-900 p-4 shadow-2xl dark:bg-gray-800">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-500">
                <MessageCircle size={20} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm">Request Accepted!</p>
                <p className="mt-0.5 text-xs text-gray-300 line-clamp-2">{acceptedToast.body}</p>
                <button
                  onClick={() => openChatFromToast(acceptedToast.requestId)}
                  className="mt-2 rounded-lg bg-success-500 px-4 py-1.5 text-xs font-bold text-white active:scale-95 transition-transform"
                >
                  Open Chat
                </button>
              </div>
              <button onClick={() => setAcceptedToast(null)} className="shrink-0 text-gray-400 hover:text-gray-200 transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      {/* FAB */}
      {location.pathname === '/app' && (
        <button
          onClick={() => navigate('/app/create')}
          className="fixed bottom-20 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-transform active:scale-90 hover:scale-105"
          style={{ backgroundColor: '#556d34', boxShadow: '0 4px 14px rgba(85,109,52,0.4)' }}
        >
          <Plus size={26} />
        </button>
      )}

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-10 border-t border-gray-100 bg-white/90 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/90">
        <div className="mx-auto flex max-w-md items-center justify-around px-2 py-2">
          {navItems.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors ${isActive(item.path) ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`}
              >
                <Icon size={22} />
                <span className="text-xs font-medium">{item.label}</span>
                {item.badge ? (
                  <span className="absolute right-2 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error-500 px-1 text-xs font-bold text-white">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
