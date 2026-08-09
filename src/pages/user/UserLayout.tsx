import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context'
import { Home, ClipboardList, Bell, User, Plus, X, MessageCircle, Zap, CalendarClock } from 'lucide-react'
import { useEffect, useState, useRef, startTransition } from 'react'
import { supabase } from '../../lib/supabase'
import { useGps } from '../../hooks/useGps'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { Images } from '../../lib/customImages'
import { Dock, DockItem } from '../../design/primitives'
import { pg } from '../../design/tokens'

type AcceptedToast = { requestId: string; body: string }

/** Completely rebuilt Customer app shell + bottom commerce dock */
export default function UserLayout() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [unreadCount, setUnreadCount] = useState(0)
  const [acceptedToast, setAcceptedToast] = useState<AcceptedToast | null>(null)
  const [showBookingMenu, setShowBookingMenu] = useState(false)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useGps(profile?.id, !!profile)
  usePushNotifications()
  useEffect(() => { setShowBookingMenu(false) }, [location.pathname])

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
    if (!profile?.id) return
    const fetchUnread = async () => {
      const { count } = await supabase.from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id).eq('is_read', false).is('deleted_at', null)
      setUnreadCount(count || 0)
    }
    fetchUnread()
    const channel = supabase.channel('user-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        (payload) => {
          fetchUnread()
          const notif = payload.new as any
          if (notif.type === 'request_accepted' && notif.related_id) {
            showToast({ requestId: notif.related_id, body: notif.body || 'A delivery partner accepted your request.' })
          }
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, fetchUnread)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, fetchUnread)
      .subscribe()
    return () => { supabase.removeChannel(channel); if (toastTimerRef.current) clearTimeout(toastTimerRef.current) }
  }, [profile?.id])

  const isActive = (path: string) => path === '/app' ? location.pathname === '/app' : location.pathname.startsWith(path)
  const go = (path: string) => startTransition(() => navigate(path))
  const hideNav =
    location.pathname.startsWith('/app/chat') ||
    location.pathname.startsWith('/app/create') ||
    location.pathname.startsWith('/app/scanning') ||
    location.pathname.startsWith('/app/track')

  return (
    <div className="relative flex h-[100dvh] flex-col" style={{ background: pg.bg }}>
      {/* Phone-width column — matches Home look on desktop browsers */}
      <div className="relative mx-auto flex h-full w-full max-w-lg flex-col">
      {acceptedToast && (
        <div className="fixed left-4 right-4 top-4 z-50 mx-auto max-w-lg">
          <div className="flex items-start gap-3 rounded-[22px] p-4" style={{ background: pg.surface, border: `1px solid ${pg.lineStrong}` }}>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: 'rgba(34,197,94,0.16)' }}>
              <MessageCircle size={18} className="text-green-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold">Partner accepted</p>
              <p className="mt-0.5 line-clamp-2 text-xs" style={{ color: pg.text3 }}>{acceptedToast.body}</p>
              <button
                type="button"
                onClick={() => openChatFromToast(acceptedToast.requestId)}
                className="mt-2 rounded-xl px-3 py-1.5 text-xs font-extrabold"
                style={{ background: pg.lime, color: pg.limeText }}
              >
                Open Chat
              </button>
            </div>
            <button type="button" onClick={() => setAcceptedToast(null)} style={{ color: pg.text4 }}><X size={16} /></button>
          </div>
        </div>
      )}

      {showBookingMenu && !hideNav && (
        <div className="fixed inset-0 z-40" onClick={() => setShowBookingMenu(false)}>
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="absolute bottom-28 left-1/2 w-[min(92vw,400px)] -translate-x-1/2 animate-slide-in-bottom rounded-[28px] p-4"
            style={{ background: pg.surface, border: `1px solid ${pg.lineStrong}` }}
            onClick={e => e.stopPropagation()}
          >
            <p className="mb-4 text-center text-base font-extrabold">What do you need?</p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => { setShowBookingMenu(false); go('/app/create') }} className="text-left">
                <img
                  src={Images.feature.instantBooking}
                  alt="Instant"
                  className="w-full object-contain"
                  style={{ background: 'transparent', display: 'block' }}
                  draggable={false}
                />
                <p className="mt-2 flex items-center gap-1.5 text-sm font-extrabold" style={{ color: pg.lime }}>
                  <Zap size={16} /> Instant
                </p>
              </button>
              <button type="button" onClick={() => { setShowBookingMenu(false); go('/app/create-advance') }} className="text-left">
                <img
                  src={Images.feature.advanceBooking}
                  alt="Advance"
                  className="w-full object-contain"
                  style={{ background: 'transparent', display: 'block' }}
                  draggable={false}
                />
                <p className="mt-2 flex items-center gap-1.5 text-sm font-extrabold" style={{ color: pg.info }}>
                  <CalendarClock size={16} /> Advance
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      <main className={`flex-1 overflow-y-auto ${hideNav ? '' : 'pb-28'}`}>
        <Outlet />
      </main>

      {!hideNav && (
        <Dock>
          <DockItem label="Home" icon={<Home size={20} />} active={isActive('/app')} onClick={() => go('/app')} />
          <DockItem label="Orders" icon={<ClipboardList size={20} />} active={isActive('/app/orders')} onClick={() => go('/app/orders')} />
          <DockItem label="New" icon={<Plus size={28} strokeWidth={2.5} />} center onClick={() => setShowBookingMenu(true)} />
          <DockItem label="Alerts" icon={<Bell size={20} />} active={isActive('/app/notifications')} badge={unreadCount} onClick={() => go('/app/notifications')} />
          <DockItem label="You" icon={<User size={20} />} active={isActive('/app/profile')} onClick={() => go('/app/profile')} />
        </Dock>
      )}
      </div>
    </div>
  )
}
