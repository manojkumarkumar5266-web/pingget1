import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context'
import { Home, ClipboardList, Bell, User, Plus, X, MessageCircle } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import Watermark from '../../components/Watermark'
import { useGps } from '../../hooks/useGps'
import { usePushNotifications } from '../../hooks/usePushNotifications'

type AcceptedToast = { requestId: string; body: string }

export default function UserLayout() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [unreadCount, setUnreadCount] = useState(0)
  const [acceptedToast, setAcceptedToast] = useState<AcceptedToast | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useGps(profile?.id, !!profile)
  usePushNotifications()

  const showToast = (toast: AcceptedToast) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setAcceptedToast(toast)
    toastTimerRef.current = setTimeout(() => setAcceptedToast(null), 12000)
  }

  const openChatFromToast = async (requestId: string) => {
    setAcceptedToast(null)
    const { data } = await supabase.from('chat_rooms').select('id').eq('request_id', requestId).maybeSingle()
    if (data) navigate(`/app/chat/${data.id}`)
  }

  useEffect(() => {
    const fetchUnread = async () => {
      const { count } = await supabase.from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile!.id).eq('is_read', false).is('deleted_at', null)
      setUnreadCount(count || 0)
    }
    fetchUnread()
    const channel = supabase.channel('user-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile!.id}` },
        (payload) => {
          fetchUnread()
          const notif = payload.new as any
          if (notif.type === 'request_accepted' && notif.related_id) {
            showToast({ requestId: notif.related_id, body: notif.body || 'A delivery partner accepted your request.' })
          }
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile!.id}` }, fetchUnread)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile!.id}` }, fetchUnread)
      .subscribe()
    return () => { supabase.removeChannel(channel); if (toastTimerRef.current) clearTimeout(toastTimerRef.current) }
  }, [profile])

  const navItems = [
    { path: '/app',               label: 'Home',    icon: Home },
    { path: '/app/orders',        label: 'Orders',  icon: ClipboardList },
    { path: '/app/notifications', label: 'Alerts',  icon: Bell, badge: unreadCount },
    { path: '/app/profile',       label: 'Profile', icon: User },
  ]

  const isActive = (path: string) => {
    if (path === '/app') return location.pathname === '/app'
    return location.pathname.startsWith(path)
  }

  const isOnChat = location.pathname.startsWith('/app/chat')
  const isOnCreate = location.pathname.startsWith('/app/create')
  const isOnScanning = location.pathname.startsWith('/app/scanning')
  const hideNav = isOnChat || isOnCreate || isOnScanning

  return (
    <div className="relative flex h-screen flex-col bg-[#0B0B0B]">
      <Watermark />

      {/* Accepted Toast */}
      {acceptedToast && (
        <div className="fixed top-4 left-4 right-4 z-50 animate-slide-down">
          <div className="mx-auto max-w-md rounded-2xl p-4 shadow-float" style={{ background: 'rgba(20,20,20,0.97)', border: '1px solid rgba(166,179,0,0.25)', backdropFilter: 'blur(20px)' }}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl" style={{ background: 'rgba(16,185,129,0.2)' }}>
                <MessageCircle size={18} className="text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm">Partner Accepted!</p>
                <p className="mt-0.5 text-xs line-clamp-2" style={{ color: 'rgba(255,255,255,0.55)' }}>{acceptedToast.body}</p>
                <button onClick={() => openChatFromToast(acceptedToast.requestId)}
                  className="mt-2 rounded-xl px-4 py-1.5 text-xs font-bold text-white transition-transform active:scale-95"
                  style={{ background: '#10b981' }}>
                  Open Chat
                </button>
              </div>
              <button onClick={() => setAcceptedToast(null)} style={{ color: 'rgba(255,255,255,0.35)' }}><X size={16} /></button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <main className={`flex-1 overflow-y-auto ${!hideNav ? 'pb-24' : ''}`}>
        <Outlet />
      </main>

      {/* Floating Bottom Navigation */}
      {!hideNav && (
        <nav className="fixed bottom-4 left-0 right-0 z-20 flex justify-center px-4">
          <div className="flex w-full max-w-xs items-center justify-between rounded-[28px] px-2 py-2 nav-island relative">

            {/* Left 2 items */}
            {navItems.slice(0, 2).map(item => {
              const Icon = item.icon
              const active = isActive(item.path)
              return (
                <button key={item.path} onClick={() => navigate(item.path)}
                  className="relative flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-2xl transition-all"
                  style={{ minWidth: 56, background: active ? 'rgba(166,179,0,0.12)' : 'transparent' }}>
                  <Icon size={22} style={{ color: active ? '#A6B300' : 'rgba(255,255,255,0.4)', transition: 'color 0.2s, transform 0.2s', transform: active ? 'translateY(-1px) scale(1.08)' : 'none' }} />
                  <span className="text-[10px] font-semibold" style={{ color: active ? '#A6B300' : 'rgba(255,255,255,0.35)' }}>{item.label}</span>
                </button>
              )
            })}

            {/* FAB center */}
            <button onClick={() => navigate('/app/create')}
              className="relative -mt-6 flex h-14 w-14 items-center justify-center rounded-2xl transition-all active:scale-90"
              style={{ background: 'linear-gradient(135deg,#C0D900,#A6B300)', boxShadow: '0 6px 24px rgba(166,179,0,0.55)', border: '2px solid rgba(255,255,255,0.15)' }}>
              <Plus size={26} className="text-[#0B0B0B] font-bold" strokeWidth={3} />
            </button>

            {/* Right 2 items */}
            {navItems.slice(2, 4).map(item => {
              const Icon = item.icon
              const active = isActive(item.path)
              return (
                <button key={item.path} onClick={() => navigate(item.path)}
                  className="relative flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-2xl transition-all"
                  style={{ minWidth: 56, background: active ? 'rgba(166,179,0,0.12)' : 'transparent' }}>
                  <div className="relative">
                    <Icon size={22} style={{ color: active ? '#A6B300' : 'rgba(255,255,255,0.4)', transition: 'color 0.2s, transform 0.2s', transform: active ? 'translateY(-1px) scale(1.08)' : 'none' }} />
                    {item.badge && item.badge > 0 && (
                      <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-[#181818]">
                        {item.badge > 9 ? '9+' : item.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-semibold" style={{ color: active ? '#A6B300' : 'rgba(255,255,255,0.35)' }}>{item.label}</span>
                </button>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}
