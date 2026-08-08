import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context'
import { Home, ClipboardList, Bell, User, Plus, X, MessageCircle, Zap, CalendarClock } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
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
  const hideNav =
    location.pathname.startsWith('/app/chat') ||
    location.pathname.startsWith('/app/create') ||
    location.pathname.startsWith('/app/scanning') ||
    location.pathname.startsWith('/app/track')

  return (
    <div className="relative flex h-[100dvh] flex-col" style={{ background: pg.bg }}>
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
              <button type="button" onClick={() => { setShowBookingMenu(false); navigate('/app/create') }} className="overflow-hidden rounded-[24px] text-left" style={{ border: `1px solid ${pg.line}` }}>
                <img src={Images.feature.instantBooking} alt="" className="h-36 w-full object-cover" />
                <div className="flex items-center gap-2 px-3 py-3" style={{ background: pg.limeDim }}>
                  <Zap size={16} style={{ color: pg.lime }} />
                  <div>
                    <p className="text-sm font-extrabold" style={{ color: pg.lime }}>Instant</p>
                    <p className="text-[10px]" style={{ color: pg.text3 }}>Now</p>
                  </div>
                </div>
              </button>
              <button type="button" onClick={() => { setShowBookingMenu(false); navigate('/app/create-advance') }} className="overflow-hidden rounded-[24px] text-left" style={{ border: `1px solid ${pg.line}` }}>
                <img src={Images.feature.advanceBooking} alt="" className="h-36 w-full object-cover" />
                <div className="flex items-center gap-2 px-3 py-3" style={{ background: 'rgba(59,130,246,0.12)' }}>
                  <CalendarClock size={16} className="text-sky-400" />
                  <div>
                    <p className="text-sm font-extrabold text-sky-400">Advance</p>
                    <p className="text-[10px]" style={{ color: pg.text3 }}>Schedule</p>
                  </div>
                </div>
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
          <DockItem label="Home" icon={<Home size={20} />} active={isActive('/app')} onClick={() => navigate('/app')} />
          <DockItem label="Orders" icon={<ClipboardList size={20} />} active={isActive('/app/orders')} onClick={() => navigate('/app/orders')} />
          <DockItem label="New" icon={<Plus size={28} strokeWidth={2.5} />} center onClick={() => setShowBookingMenu(true)} />
          <DockItem label="Alerts" icon={<Bell size={20} />} active={isActive('/app/notifications')} badge={unreadCount} onClick={() => navigate('/app/notifications')} />
          <DockItem label="You" icon={<User size={20} />} active={isActive('/app/profile')} onClick={() => navigate('/app/profile')} />
        </Dock>
      )}
    </div>
  )
}
