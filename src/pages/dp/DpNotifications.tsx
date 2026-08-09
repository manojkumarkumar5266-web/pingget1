import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase } from '../../lib/supabase'
import { SkeletonList } from '../../components/ui'
import { Screen, PageTitle, Surface, EmptyBlock, IconButton } from '../../design/primitives'
import { pg } from '../../design/tokens'
import { Bike, CheckCircle2, AlertCircle, Info, Package, Trash2, MessageCircle, Shield, IndianRupee } from 'lucide-react'

type Notification = {
  id: string; title: string; body: string; type: string; is_read: boolean; created_at: string; related_id?: string | null
}

function relativeTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function dateLabel(iso: string) {
  const d = new Date(iso); const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yestStart = new Date(todayStart.getTime() - 86400000)
  if (d >= todayStart) return 'Today'
  if (d >= yestStart) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' })
}

function groupByDate(notifs: Notification[]): { label: string; items: Notification[] }[] {
  const groups = new Map<string, Notification[]>()
  for (const n of notifs) {
    const lbl = dateLabel(n.created_at)
    if (!groups.has(lbl)) groups.set(lbl, [])
    groups.get(lbl)!.push(n)
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }))
}

function notifIcon(type: string) {
  if (type === 'request_accepted' || type === 'order_received') return { icon: <Bike size={17} />, bg: pg.limeDim, color: pg.lime }
  if (type === 'order_delivered' || type === 'delivered' || type === 'order_completed' || type === 'order_status') return { icon: <CheckCircle2 size={17} />, bg: 'rgba(34,197,94,0.15)', color: '#86EFAC' }
  if (type === 'order_cancelled' || type === 'cancelled' || type === 'order_rejected') return { icon: <AlertCircle size={17} />, bg: 'rgba(255,77,79,0.15)', color: '#FCA5A5' }
  if (type === 'order_placed' || type === 'shopping' || type === 'on_the_way' || type === 'purchased') return { icon: <Package size={17} />, bg: 'rgba(245,165,36,0.15)', color: '#FCD34D' }
  if (type === 'chat' || type === 'message') return { icon: <MessageCircle size={17} />, bg: 'rgba(59,130,246,0.15)', color: '#93C5FD' }
  if (type === 'dp_status') return { icon: <Shield size={17} />, bg: 'rgba(168,85,247,0.15)', color: '#C4B5FD' }
  if (type === 'commission' || type === 'payment') return { icon: <IndianRupee size={17} />, bg: 'rgba(34,197,94,0.15)', color: '#86EFAC' }
  return { icon: <Info size={17} />, bg: 'rgba(255,255,255,0.08)', color: pg.text3 }
}

export default function DpNotifications() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const fetchNotifs = useCallback(async () => {
    const { data } = await supabase.from('notifications').select('*')
      .eq('user_id', profile!.id).is('deleted_at', null)
      .order('created_at', { ascending: false }).limit(100)
    setNotifs((data as Notification[]) || [])
    setLoading(false)
  }, [profile])

  useEffect(() => {
    fetchNotifs()
    const channel = supabase.channel('dp-notifs-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile!.id}` }, fetchNotifs)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile, fetchNotifs])

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }
  const deleteNotif = async (id: string) => {
    await supabase.from('notifications').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    setNotifs(prev => prev.filter(n => n.id !== id))
  }
  const markAllRead = async () => {
    await supabase.from('notifications').update({ is_read: true })
      .eq('user_id', profile!.id).eq('is_read', false).is('deleted_at', null)
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const handleTap = async (n: Notification) => {
    if (!n.is_read) markRead(n.id)
    if (n.related_id) {
      // Quotation confirmed / live order → tracking
      if (n.type === 'order_confirmed' || n.type === 'order_status' || n.type === 'order_delivered' || n.type === 'task_started') {
        navigate(`/dp/navigate/${n.related_id}`)
        return
      }
      if (n.type?.startsWith('advance_reminder_') || n.type === 'payment_verified') {
        navigate('/dp/orders')
        return
      }
      // New request alerts → home
      if (n.type === 'order_received' || n.type === 'order_placed' || n.type === 'new_nearby_request') {
        navigate('/dp')
      }
    }
  }

  const filtered = filter === 'unread' ? notifs.filter(n => !n.is_read) : notifs
  const groups = groupByDate(filtered)
  const unreadCount = notifs.filter(n => !n.is_read).length

  return (
    <Screen className="mx-auto max-w-lg animate-fade-in-up">
      <PageTitle
        eyebrow="Partner"
        title="Alerts"
        action={
          unreadCount > 0 ? (
            <button
              type="button"
              onClick={markAllRead}
              className="rounded-2xl px-3.5 py-2 text-xs font-extrabold transition active:scale-95"
              style={{ background: pg.limeDim, border: `1px solid rgba(196,214,0,0.28)`, color: pg.lime }}
            >
              Mark all read
            </button>
          ) : undefined
        }
      />

      {unreadCount > 0 && (
        <p className="-mt-3 mb-4 text-sm" style={{ color: pg.text3 }}>{unreadCount} unread</p>
      )}

      <div className="mb-5 flex gap-2">
        {(['all', 'unread'] as const).map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className="rounded-full px-4 py-2 text-sm font-extrabold capitalize transition active:scale-95"
            style={filter === f
              ? { background: pg.limeDim, border: `1px solid rgba(196,214,0,0.35)`, color: pg.lime }
              : { background: pg.surface2, border: `1px solid ${pg.line}`, color: pg.text3 }}
          >
            {f} {f === 'unread' && unreadCount > 0 ? `(${unreadCount})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonList count={4} lines={3} />
      ) : filtered.length === 0 ? (
        <EmptyBlock
          title="No alerts"
          body={filter === 'unread' ? "You're all caught up!" : 'Alerts will appear here.'}
        />
      ) : (
        <div className="space-y-6 pb-4">
          {groups.map(group => (
            <div key={group.label}>
              <p className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[0.16em]" style={{ color: pg.text4 }}>
                {group.label}
              </p>
              <div className="space-y-2">
                {group.items.map(n => {
                  const { icon, bg, color } = notifIcon(n.type)
                  return (
                    <Surface
                      key={n.id}
                      accent={!n.is_read}
                      onClick={() => handleTap(n)}
                      className="group relative flex cursor-pointer items-start gap-3.5 p-3.5 active:scale-[0.99]"
                      style={n.is_read ? { background: pg.bgElevated } : undefined}
                    >
                      {!n.is_read && (
                        <div
                          className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-full"
                          style={{ background: pg.lime }}
                        />
                      )}
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                        style={{ background: bg }}
                      >
                        <span style={{ color }}>{icon}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-extrabold" style={{ color: n.is_read ? pg.text2 : pg.text }}>
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed" style={{ color: pg.text3 }}>{n.body}</p>
                        )}
                        <p className="mt-1.5 text-[10px] font-extrabold uppercase tracking-wide" style={{ color: pg.text4 }}>
                          {relativeTime(n.created_at)}
                        </p>
                      </div>
                      <IconButton
                        className="h-8 w-8 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                        onClick={e => { e.stopPropagation(); deleteNotif(n.id) }}
                        aria-label="Delete alert"
                        style={{ background: 'rgba(255,77,79,0.1)', borderColor: 'rgba(255,77,79,0.2)' }}
                      >
                        <Trash2 size={12} className="text-red-400" />
                      </IconButton>
                    </Surface>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Screen>
  )
}
