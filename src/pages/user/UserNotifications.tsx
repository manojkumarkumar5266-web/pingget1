import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context'
import { supabase, Notification } from '@/lib/supabase'
import { EmptyState } from '@/components/ui'
import { formatTime } from '@/lib/utils'
import { resolveNotificationRoute, NOTIFICATION_TYPES } from '@/services/pushNotificationService'
import { Bell, ChevronRight, Trash2, BellOff, CheckCheck } from 'lucide-react'

const NOTIFICATION_ICONS: Record<string, string> = {
  [NOTIFICATION_TYPES.DELIVERY_ACCEPTED]: '✓',
  [NOTIFICATION_TYPES.DELIVERY_REJECTED]: '✕',
  [NOTIFICATION_TYPES.DELIVERY_ARRIVED]: '📍',
  [NOTIFICATION_TYPES.DELIVERY_STARTED]: '🚀',
  [NOTIFICATION_TYPES.DELIVERY_COMPLETED]: '🎉',
  [NOTIFICATION_TYPES.NEW_CHAT_MESSAGE]: '💬',
  [NOTIFICATION_TYPES.ADMIN_ANNOUNCEMENT]: '📢',
  [NOTIFICATION_TYPES.PAYMENT_COMPLETED]: '💳',
  [NOTIFICATION_TYPES.REFUND_PROCESSED]: '↩️',
  [NOTIFICATION_TYPES.ACCOUNT_APPROVED]: '✅',
  [NOTIFICATION_TYPES.ACCOUNT_REJECTED]: '⛔',
}

export default function UserNotifications() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNotifications = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    setNotifications((data as Notification[]) || [])
    setLoading(false)
  }, [profile])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const handleTap = async (n: Notification) => {
    // Mark as read on tap
    if (!n.is_read) {
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', n.id)
    }

    // Resolve deep-link route
    const nType = n.notification_type || n.type || ''
    const entityId = n.entity_id || n.related_id
    const route = n.route || resolveNotificationRoute(nType, entityId, 'user')
    if (route) navigate(route)
  }

  const markAllRead = async () => {
    if (!profile) return
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', profile.id)
      .eq('is_read', false)
    fetchNotifications()
  }

  const deleteNotification = async (id: string) => {
    await supabase
      .from('notifications')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  if (loading) return <div className="p-4 text-center text-sm text-white/40">Loading...</div>

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="mx-auto max-w-md px-4 py-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Notifications</h1>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-primary-300 transition-colors hover:bg-primary-500/10"
          >
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState icon={<Bell size={48} />} title="No notifications yet" description="You'll see delivery updates, chat messages, and announcements here." />
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const nType = n.notification_type || n.type || ''
            const icon = NOTIFICATION_ICONS[nType] || '🔔'
            return (
              <div
                key={n.id}
                onClick={() => handleTap(n)}
                className={`card p-4 cursor-pointer active:scale-[0.98] transition-transform ${!n.is_read ? 'border-primary-200 dark:border-primary-800' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-1 min-w-0 gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-lg">
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-white">{n.title}</p>
                        {!n.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary-400" />}
                      </div>
                      {n.body && <p className="mt-0.5 text-sm text-white/50">{n.body}</p>}
                      <p className="mt-1 text-xs text-white/40">{formatTime(n.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteNotification(n.id) }}
                      className="rounded-lg p-1.5 text-white/30 transition-colors hover:text-red-400"
                    >
                      <Trash2 size={16} />
                    </button>
                    <ChevronRight size={18} className="text-white/40" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
