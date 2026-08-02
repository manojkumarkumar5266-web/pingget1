import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase } from '../../lib/supabase'
import { SkeletonList, EmptyState } from '../../components/ui'
import { Bell, Bike, CheckCircle2, AlertCircle, Info, Package, Trash2, BellOff, MessageCircle } from 'lucide-react'

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
  if (type === 'request_accepted') return { icon: <Bike size={17} />, bg: 'rgba(166,179,0,0.15)', color: '#A6B300' }
  if (type === 'order_delivered' || type === 'delivered' || type === 'order_completed' || type === 'order_status') return { icon: <CheckCircle2 size={17} />, bg: 'rgba(16,185,129,0.15)', color: '#34d399' }
  if (type === 'order_cancelled' || type === 'cancelled') return { icon: <AlertCircle size={17} />, bg: 'rgba(239,68,68,0.15)', color: '#f87171' }
  if (type === 'shopping' || type === 'on_the_way' || type === 'purchased' || type === 'arrived' || type === 'order_confirmed') return { icon: <Package size={17} />, bg: 'rgba(251,191,36,0.15)', color: '#fbbf24' }
  if (type === 'chat' || type === 'message') return { icon: <MessageCircle size={17} />, bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' }
  return { icon: <Info size={17} />, bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }
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
    <div className="mx-auto max-w-md px-4 pt-5">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-bold text-white">Notifications</h1>
          {unreadCount > 0 && (
            <p className="mt-0.5 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="rounded-2xl px-3.5 py-2 text-xs font-semibold transition-all active:scale-95"
            style={{ background: 'rgba(166,179,0,0.12)', border: '1px solid rgba(166,179,0,0.25)', color: '#A6B300' }}>
            Mark all read
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="mb-5 flex gap-2 animate-slide-up">
        {(['all', 'unread'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="rounded-full px-4 py-2 text-sm font-semibold capitalize transition-all active:scale-95"
            style={filter === f
              ? { background: 'rgba(166,179,0,0.2)', border: '1px solid rgba(166,179,0,0.4)', color: '#A6B300' }
              : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
            {f} {f === 'unread' && unreadCount > 0 ? `(${unreadCount})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonList count={4} lines={3} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<BellOff size={40} />} title="No notifications" description={filter === 'unread' ? 'You\'re all caught up!' : 'Notifications will appear here.'} />
      ) : (
        <div className="space-y-6 pb-8">
          {groups.map(group => (
            <div key={group.label} className="animate-fade-in-up">
              <p className="mb-2.5 text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>{group.label}</p>
              <div className="space-y-2">
                {group.items.map((n, i) => {
                  const { icon, bg, color } = notifIcon(n.type)
                  return (
                    <div key={n.id} onClick={() => handleTap(n)}
                      className="group relative flex items-start gap-3.5 rounded-2xl p-3.5 transition-all active:scale-[0.98] cursor-pointer animate-slide-up"
                      style={{
                        background: n.is_read ? 'rgba(255,255,255,0.03)' : 'rgba(166,179,0,0.06)',
                        border: n.is_read ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(166,179,0,0.15)',
                        animationDelay: `${i * 40}ms`,
                      }}>
                      {/* Unread indicator */}
                      {!n.is_read && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full" style={{ background: '#A6B300' }} />}

                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: bg }}>
                        <span style={{ color }}>{icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${!n.is_read ? 'text-white' : ''}`} style={n.is_read ? { color: 'rgba(255,255,255,0.7)' } : {}}>
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="mt-0.5 text-xs leading-relaxed line-clamp-2" style={{ color: 'rgba(255,255,255,0.45)' }}>{n.body}</p>
                        )}
                        <p className="mt-1.5 text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.28)' }}>{relativeTime(n.created_at)}</p>
                      </div>
                      <button onClick={e => { e.stopPropagation(); deleteNotif(n.id) }}
                        className="shrink-0 flex h-7 w-7 items-center justify-center rounded-xl opacity-0 group-hover:opacity-100 transition-opacity active:scale-90"
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
