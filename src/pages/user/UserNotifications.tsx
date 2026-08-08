import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase } from '../../lib/supabase'
import { SkeletonList } from '../../components/ui'
import { BellOff, Bike, CheckCircle2, AlertCircle, Info, Package, Trash2, MessageCircle } from 'lucide-react'
import { Screen, PageTitle, Surface, Chip, EmptyBlock, IconButton, SectionLabel, CTA } from '../../design/primitives'
import { pg } from '../../design/tokens'

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
  if (type === 'request_accepted') return { icon: <Bike size={17} />, bg: pg.limeDim, color: pg.lime }
  if (type === 'order_delivered' || type === 'delivered' || type === 'order_completed' || type === 'order_status')
    return { icon: <CheckCircle2 size={17} />, bg: 'rgba(34,197,94,0.14)', color: '#86EFAC' }
  if (type === 'order_cancelled' || type === 'cancelled')
    return { icon: <AlertCircle size={17} />, bg: 'rgba(255,77,79,0.14)', color: '#FCA5A5' }
  if (type === 'shopping' || type === 'on_the_way' || type === 'purchased' || type === 'arrived' || type === 'order_confirmed')
    return { icon: <Package size={17} />, bg: 'rgba(245,165,36,0.14)', color: '#FCD34D' }
  if (type === 'chat' || type === 'message')
    return { icon: <MessageCircle size={17} />, bg: 'rgba(59,130,246,0.14)', color: '#93C5FD' }
  return { icon: <Info size={17} />, bg: 'rgba(255,255,255,0.06)', color: pg.text3 }
}

export default function UserNotifications() {
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
    const channel = supabase.channel('user-notifs-page')
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
      if (n.type === 'request_accepted') {
        const { data } = await supabase.from('chat_rooms').select('id').eq('request_id', n.related_id).maybeSingle()
        if (data) { navigate(`/app/chat/${data.id}`); return }
      }
      if (n.type === 'order_status' || n.type === 'order_completed' || n.type === 'order_confirmed' || n.type === 'order_delivered' || n.type === 'delivered') {
        navigate(`/app/track/${n.related_id}`)
        return
      }
    }
  }

  const filtered = filter === 'unread' ? notifs.filter(n => !n.is_read) : notifs
  const groups = groupByDate(filtered)
  const unreadCount = notifs.filter(n => !n.is_read).length

  return (
    <Screen className="mx-auto max-w-lg animate-fade-in-up">
      <PageTitle
        eyebrow="Updates"
        title="Notifications"
        action={
          unreadCount > 0 ? (
            <CTA variant="secondary" className="min-h-0 rounded-xl px-3 py-2 text-xs" onClick={markAllRead}>
              Mark all read
            </CTA>
          ) : undefined
        }
      />

      {unreadCount > 0 && (
        <div className="mb-4">
          <Chip tone="lime">{unreadCount} unread</Chip>
        </div>
      )}

      <div className="mb-5 flex gap-2">
        {(['all', 'unread'] as const).map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className="rounded-full px-4 py-2.5 text-sm font-extrabold capitalize transition-all active:scale-[0.98]"
            style={
              filter === f
                ? { background: pg.limeDim, border: '1px solid rgba(212,240,0,0.35)', color: pg.lime }
                : { background: pg.surface, border: `1px solid ${pg.line}`, color: pg.text3 }
            }
          >
            {f} {f === 'unread' && unreadCount > 0 ? `(${unreadCount})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonList count={4} lines={3} />
      ) : filtered.length === 0 ? (
        <EmptyBlock
          title="No notifications"
          body={filter === 'unread' ? "You're all caught up!" : 'Notifications will appear here.'}
        />
      ) : (
        <div className="space-y-6 pb-4">
          {groups.map(group => (
            <div key={group.label} className="animate-fade-in-up">
              <SectionLabel title={group.label} />
              <div className="space-y-2">
                {group.items.map((n, i) => {
                  const { icon, bg, color } = notifIcon(n.type)
                  return (
                    <Surface
                      key={n.id}
                      onClick={() => handleTap(n)}
                      className="group relative flex items-start gap-3 p-3.5 active:scale-[0.99] animate-slide-up"
                      accent={!n.is_read}
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      {!n.is_read && (
                        <div
                          className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-full"
                          style={{ background: pg.lime }}
                        />
                      )}

                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: bg }}>
                        <span style={{ color }}>{icon}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-extrabold" style={{ color: n.is_read ? pg.text2 : pg.text }}>
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed" style={{ color: pg.text3 }}>{n.body}</p>
                        )}
                        <p className="mt-1.5 text-[10px] font-bold" style={{ color: pg.text4 }}>{relativeTime(n.created_at)}</p>
                      </div>
                      <IconButton
                        className="h-8 w-8 shrink-0 opacity-60 group-hover:opacity-100"
                        onClick={e => { e.stopPropagation(); deleteNotif(n.id) }}
                        style={{ background: 'rgba(255,77,79,0.12)', color: '#FCA5A5' }}
                      >
                        <Trash2 size={12} />
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
