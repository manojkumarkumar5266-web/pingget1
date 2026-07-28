import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useSnackbar } from '@/components/ui'
import { formatTime } from '@/lib/utils'
import { Send, Users, Bike, UserCheck, Megaphone, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react'

type DeliveryLog = {
  id: string
  status: string
  error_message: string | null
  token: string | null
  created_at: string
}

type TargetType = 'single' | 'all_dps' | 'all_users' | 'broadcast'

export default function AdminNotifications() {
  const { show } = useSnackbar()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [targetType, setTargetType] = useState<TargetType>('broadcast')
  const [targetUserId, setTargetUserId] = useState('')
  const [scheduleAt, setScheduleAt] = useState('')
  const [sending, setSending] = useState(false)
  const [logs, setLogs] = useState<DeliveryLog[]>([])
  const [logsLoading, setLogsLoading] = useState(true)

  const fetchLogs = useCallback(async () => {
    const { data } = await supabase
      .from('notification_delivery_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    setLogs((data as DeliveryLog[]) || [])
    setLogsLoading(false)
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      show('Title and message are required', 'error')
      return
    }
    if (targetType === 'single' && !targetUserId.trim()) {
      show('Enter a user ID for single-user send', 'error')
      return
    }
    setSending(true)
    try {
      const { data, error } = await supabase.functions.invoke('notify-broadcast', {
        body: {
          title: title.trim(),
          body: body.trim(),
          targetType,
          targetUserId: targetType === 'single' ? targetUserId.trim() : undefined,
          scheduleAt: scheduleAt || undefined,
          notificationType: 'admin_announcement',
        },
      })
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Send failed')
      show(`Notification sent to ${data.sent || 0} device(s)`, 'success')
      setTitle('')
      setBody('')
      setTargetUserId('')
      setScheduleAt('')
      fetchLogs()
    } catch (err: any) {
      show(err?.message || 'Failed to send notification', 'error')
    } finally {
      setSending(false)
    }
  }

  const targetOptions: { value: TargetType; label: string; icon: any; desc: string }[] = [
    { value: 'broadcast', label: 'Everyone', icon: Megaphone, desc: 'All users, DPs, and admins' },
    { value: 'all_users', label: 'All Customers', icon: UserCheck, desc: 'All users with role "user"' },
    { value: 'all_dps', label: 'All Partners', icon: Bike, desc: 'All delivery partners' },
    { value: 'single', label: 'Single User', icon: Users, desc: 'Send to one specific user' },
  ]

  return (
    <div className="p-4 md:p-8">
      <h1 className="mb-6 text-2xl font-bold text-white">Notification Center</h1>

      {/* Compose */}
      <div className="card mb-6 p-5">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
          <Send size={18} className="text-primary-400" /> Compose Notification
        </h2>

        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-white/60">Target Audience</label>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {targetOptions.map(opt => {
              const Icon = opt.icon
              return (
                <button
                  key={opt.value}
                  onClick={() => setTargetType(opt.value)}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-all ${
                    targetType === opt.value
                      ? 'border-primary-400 bg-primary-500/10 text-white'
                      : 'border-white/10 bg-white/5 text-white/50 hover:border-white/20'
                  }`}
                >
                  <Icon size={20} />
                  <span className="text-xs font-semibold">{opt.label}</span>
                  <span className="text-[10px] text-white/40">{opt.desc}</span>
                </button>
              )
            })}
          </div>
        </div>

        {targetType === 'single' && (
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-white/60">User ID</label>
            <input
              value={targetUserId}
              onChange={e => setTargetUserId(e.target.value)}
              placeholder="Paste the user's UUID"
              className="input"
            />
          </div>
        )}

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-white/60">Title</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Notification title"
            className="input"
            maxLength={100}
          />
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-white/60">Message</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Notification body"
            className="input min-h-[80px]"
            maxLength={500}
          />
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-white/60">
            Schedule (optional)
          </label>
          <input
            type="datetime-local"
            value={scheduleAt}
            onChange={e => setScheduleAt(e.target.value)}
            className="input"
          />
          <p className="mt-1 text-xs text-white/40">Leave empty to send immediately</p>
        </div>

        <button
          onClick={handleSend}
          disabled={sending}
          className="btn-primary flex items-center gap-2"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {sending ? 'Sending...' : 'Send Notification'}
        </button>
      </div>

      {/* Delivery Logs */}
      <div className="card p-5">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
          <Clock size={18} className="text-primary-400" /> Delivery Logs
        </h2>
        {logsLoading ? (
          <p className="text-sm text-white/40">Loading...</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-white/40">No delivery logs yet.</p>
        ) : (
          <div className="space-y-2">
            {logs.map(log => (
              <div key={log.id} className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                {log.status === 'sent' ? (
                  <CheckCircle size={16} className="shrink-0 text-success-400" />
                ) : (
                  <XCircle size={16} className="shrink-0 text-error-400" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">
                    {log.status === 'sent' ? 'Delivered' : log.status === 'invalid_token' ? 'Invalid token' : 'Failed'}
                  </p>
                  {log.error_message && (
                    <p className="truncate text-xs text-white/40">{log.error_message}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-white/40">{formatTime(log.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
