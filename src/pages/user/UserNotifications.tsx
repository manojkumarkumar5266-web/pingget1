import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase, Notification } from '../../lib/supabase'
import { EmptyState } from '../../components/ui'
import { formatTime } from '../../lib/utils'
import { Bell, ChevronRight } from 'lucide-react'

export default function UserNotifications() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile!.id)
        .order('created_at', { ascending: false })
      setNotifications((data as Notification[]) || [])
      setLoading(false)

      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', profile!.id)
        .eq('is_read', false)
    }
    fetch()
  }, [profile])

  const handleTap = async (n: Notification) => {
    if (!n.related_id) return
    const chatTypes = ['request_accepted', 'order_confirmed', 'order_status', 'order_completed']
    if (!chatTypes.includes(n.type || '')) return

    const { data: rooms, error } = await supabase
      .from('chat_rooms')
      .select('id')
      .eq('request_id', n.related_id)
      .order('created_at', { ascending: true })
      .limit(1)
    if (!error && rooms && rooms.length > 0) navigate(`/app/chat/${rooms[0].id}`)
  }

  const isTappable = (n: Notification) =>
    !!n.related_id && ['request_accepted', 'order_confirmed', 'order_status', 'order_completed'].includes(n.type || '')

  if (loading) return <div className="p-4 text-center text-sm text-gray-400">Loading...</div>

  return (
    <div className="mx-auto max-w-md px-4 py-4">
      <h1 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">Notifications</h1>
      {notifications.length === 0 ? (
        <EmptyState icon={<Bell size={48} />} title="No notifications yet" />
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const tappable = isTappable(n)
            return (
              <div
                key={n.id}
                onClick={() => tappable && handleTap(n)}
                className={`card p-4 ${!n.is_read ? 'border-primary-200 dark:border-primary-800' : ''} ${tappable ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{n.body}</p>}
                    <p className="mt-1 text-xs text-gray-400">{formatTime(n.created_at)}</p>
                  </div>
                  {tappable && <ChevronRight size={18} className="shrink-0 mt-0.5 text-gray-400" />}
                </div>
                {tappable && (
                  <p className="mt-1.5 text-xs font-medium text-primary-600 dark:text-primary-400">Tap to open chat</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
