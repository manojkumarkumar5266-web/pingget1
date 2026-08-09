import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { kickPushDelivery } from '../../lib/notify'
import { useSnackbar } from '../../components/ui'
import { formatTime } from '../../lib/utils'
import { Send, Users, Bike, UserCheck, Megaphone, Clock, CheckCircle, XCircle, Loader2, Image, X, Search, CalendarClock, Bell } from 'lucide-react'
import { AdminShell, AdminHeader } from './adminChrome'

type BroadcastRow = {
  id: string
  title: string
  body: string
  target_type: string
  scheduled_for: string
  status: string
  recipient_count: number | null
  error_message: string | null
  created_at: string
  sent_at: string | null
}

type TargetType = 'single' | 'all_dps' | 'all_users' | 'broadcast'

type UserEntry = { id: string; full_name: string; phone: string | null; role: string }

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function AdminNotifications() {
  const { show } = useSnackbar()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [targetType, setTargetType] = useState<TargetType>('broadcast')
  const [targetUserId, setTargetUserId] = useState('')
  const [sending, setSending] = useState(false)
  const [broadcasts, setBroadcasts] = useState<BroadcastRow[]>([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [userSearch, setUserSearch] = useState('')
  const [userList, setUserList] = useState<UserEntry[]>([])
  const [showUserList, setShowUserList] = useState(false)
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now')
  const [scheduledFor, setScheduledFor] = useState(() => toLocalInputValue(new Date()))

  const fetchBroadcasts = useCallback(async () => {
    const { data } = await supabase
      .from('notification_broadcasts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(40)
    setBroadcasts((data as BroadcastRow[]) || [])
    setLogsLoading(false)
  }, [])

  useEffect(() => { fetchBroadcasts() }, [fetchBroadcasts])

  useEffect(() => {
    if (userSearch.trim().length < 2) { setUserList([]); return }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, phone, role')
        .or(`full_name.ilike.%${userSearch}%,phone.ilike.%${userSearch}%`)
        .limit(20)
      setUserList((data as UserEntry[]) || [])
      setShowUserList(true)
    }, 300)
    return () => clearTimeout(timer)
  }, [userSearch])

  const pickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = ev => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const removeImage = () => { setImageFile(null); setImagePreview(null) }

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) { show('Title and message are required', 'error'); return }
    if (targetType === 'single' && !targetUserId.trim()) { show('Select a user for single-user send', 'error'); return }
    if (scheduleMode === 'later' && !scheduledFor) { show('Pick a notify time', 'error'); return }
    setSending(true)
    try {
      let imageUrl: string | undefined
      if (imageFile) {
        const ext = imageFile.name.split('.').pop()
        const path = `notifications/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('media').upload(path, imageFile, { upsert: true })
        if (!upErr) {
          imageUrl = supabase.storage.from('media').getPublicUrl(path).data.publicUrl
        }
      }

      const payload = {
        title: title.trim(),
        body: body.trim(),
        targetType,
        targetUserId: targetType === 'single' ? targetUserId.trim() : undefined,
        notificationType: 'admin_offer',
        imageUrl,
        scheduledFor: new Date(scheduledFor).toISOString(),
      }

      const { data, error } = await supabase.functions.invoke('notify-broadcast', { body: payload })

      if (error) {
        // Fallback: queue/schedule in DB if edge function not deployed yet
        console.warn('notify-broadcast invoke failed, falling back', error)
        const when = new Date(scheduledFor)
        const scheduleLater = when.getTime() - Date.now() > 45_000

        let targetUsers: string[] = []
        if (targetType === 'single' && targetUserId.trim()) {
          targetUsers = [targetUserId.trim()]
        } else {
          const roleFilter = targetType === 'all_dps' ? 'dp' : targetType === 'all_users' ? 'user' : null
          let q = supabase.from('profiles').select('id, role')
          if (roleFilter) q = q.eq('role', roleFilter)
          else q = q.in('role', ['user', 'dp'])
          const { data: profiles } = await q
          targetUsers = (profiles || []).map((p: any) => p.id)
        }
        if (targetUsers.length === 0) {
          show('No recipients found', 'error')
          setSending(false)
          return
        }

        const { data: broadcast, error: qErr } = await supabase.from('notification_broadcasts').insert({
          title: title.trim(),
          body: body.trim(),
          image_url: imageUrl || null,
          target_type: targetType,
          target_user_id: targetType === 'single' ? targetUserId.trim() : null,
          scheduled_for: when.toISOString(),
          status: scheduleLater ? 'pending' : 'sending',
        }).select('id').single()

        if (qErr) {
          show('Notify failed: ' + qErr.message + ' — run APPLY_NOW_PUSH_OUTBOX.sql + deploy notify-broadcast', 'error')
          setSending(false)
          return
        }

        if (scheduleLater) {
          show(`Scheduled for ${when.toLocaleString()}`, 'success')
        } else {
          const { data: profiles } = await supabase.from('profiles').select('id, role').in('id', targetUsers)
          for (const p of profiles || []) {
            const base = p.role === 'dp' ? '/dp' : '/app'
            const { data: created } = await supabase.from('notifications').insert({
              user_id: p.id,
              title: title.trim(),
              body: body.trim(),
              type: 'admin_announcement',
              notification_type: 'admin_offer',
              image_url: imageUrl || null,
              related_id: broadcast?.id || null,
              route: `${base}/offers/pending`,
            }).select('id').single()
            kickPushDelivery()
            if (created?.id) {
              await supabase.from('notifications').update({
                route: `${base}/offers/${created.id}`,
                entity_id: created.id,
              }).eq('id', created.id)
            }
          }
          // Best-effort push for each (requires dispatch-push + FCM secrets)
          supabase.functions.invoke('dispatch-push', { body: { processOutbox: true, limit: 200 } }).catch(() => {})
          show(`Sent to Alerts for ${targetUsers.length} recipient(s) — push via FCM when configured`, 'success')
        }
      } else if (data && data.success === false) {
        show(data.error || 'Notify failed', 'error')
        setSending(false)
        return
      } else if (data?.scheduled) {
        show(`Scheduled for ${new Date(data.scheduledFor).toLocaleString()} — Alerts + push + email`, 'success')
      } else {
        const pushNote = data?.fcmConfigured === false
          ? ' (set FCM_SERVER_KEY or FCM_SERVICE_ACCOUNT_JSON on edge for mobile push)'
          : ` · push ${data?.pushSent ?? 0}`
        show(`Sent to ${data?.recipientCount ?? 'audience'} — Alerts + email${pushNote}`, 'success')
      }

      setTitle('')
      setBody('')
      setTargetUserId('')
      setUserSearch('')
      removeImage()
      setScheduleMode('now')
      fetchBroadcasts()
    } catch (err: any) {
      show(err?.message || 'Failed to send notification', 'error')
    } finally {
      setSending(false)
    }
  }

  const targetOptions: { value: TargetType; label: string; icon: any; desc: string }[] = [
    { value: 'broadcast',  label: 'Everyone',      icon: Megaphone, desc: 'All users & partners' },
    { value: 'all_users',  label: 'All Customers', icon: UserCheck, desc: 'Users only' },
    { value: 'all_dps',    label: 'All Partners',  icon: Bike,      desc: 'Delivery partners only' },
    { value: 'single',     label: 'Single Person', icon: Users,     desc: 'One specific user' },
  ]

  return (
    <AdminShell>
      <AdminHeader title="Notification Center" />

      <div className="card mb-4 p-4">
        <div className="flex items-start gap-3">
          <Bell size={18} className="mt-0.5 text-primary-400" />
          <div className="text-sm text-white/70 leading-relaxed">
            <p className="font-semibold text-white mb-1">Where does Notify go?</p>
            <p>
              Messages land in the <span className="text-white">Alerts</span> tab for customers and partners.
              Mobile <span className="text-white">push</span> is sent via FCM for every notification (set
              <span className="text-white"> FCM_SERVER_KEY</span> or <span className="text-white">FCM_SERVICE_ACCOUNT_JSON</span> on edge functions).
              Email goes through <span className="text-white">Resend</span> when the profile has an email.
              Tapping an offer opens the full details page with image.
            </p>
          </div>
        </div>
      </div>

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
                <button key={opt.value} onClick={() => { setTargetType(opt.value); setTargetUserId(''); setUserSearch('') }}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-all ${
                    targetType === opt.value
                      ? 'border-primary-400 bg-primary-500/10 text-white'
                      : 'border-white/10 bg-white/5 text-white/50 hover:border-white/20'
                  }`}>
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
            <label className="mb-1 block text-sm font-medium text-white/60">Search User</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input value={userSearch} onChange={e => { setUserSearch(e.target.value); setTargetUserId('') }}
                placeholder="Search by name or phone..." className="input pl-10" />
            </div>
            {showUserList && userList.length > 0 && !targetUserId && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-white/5 dark:bg-gray-800">
                {userList.map(u => (
                  <button key={u.id} onClick={() => { setTargetUserId(u.id); setUserSearch(`${u.full_name} (${u.phone || 'no phone'})`); setShowUserList(false) }}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-white/5 dark:hover:bg-gray-700">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                      {u.role === 'dp' ? <Bike size={14} /> : <UserCheck size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{u.full_name}</p>
                      <p className="text-xs text-white/40">{u.phone || 'No phone'} · {u.role}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {targetUserId && (
              <div className="mt-2 flex items-center gap-2 rounded-xl bg-primary-50 px-3 py-2 dark:bg-primary-900/20">
                <CheckCircle size={16} className="text-success-500" />
                <span className="text-sm text-white">User selected</span>
                <button onClick={() => { setTargetUserId(''); setUserSearch('') }} className="ml-auto">
                  <X size={14} className="text-white/40" />
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-white/60">Title *</label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Weekend Offer!" className="input" maxLength={100} />
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-white/60">Message *</label>
          <textarea value={body} onChange={e => setBody(e.target.value)}
            placeholder="Write your announcement, offer or update here..."
            className="input min-h-[100px]" maxLength={500} />
        </div>

        <div className="mb-4 rounded-xl border border-primary-400/40 bg-primary-500/10 p-4">
          <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
            <CalendarClock size={16} className="text-primary-400" />
            Notify time *
          </label>
          <p className="mb-3 text-xs text-white/50">
            Pick when recipients should get Alerts + push + email. Leave as now to send immediately.
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setScheduleMode('now')
                setScheduledFor(toLocalInputValue(new Date()))
              }}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${scheduleMode === 'now' ? 'border border-primary-400 bg-primary-500/20 text-white' : 'border border-white/10 text-white/50'}`}
            >
              Send now
            </button>
            <button
              type="button"
              onClick={() => {
                setScheduleMode('later')
                setScheduledFor(toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)))
              }}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${scheduleMode === 'later' ? 'border border-primary-400 bg-primary-500/20 text-white' : 'border border-white/10 text-white/50'}`}
            >
              Schedule for later
            </button>
          </div>
          <input
            type="datetime-local"
            value={scheduledFor}
            onChange={e => {
              setScheduledFor(e.target.value)
              const t = new Date(e.target.value).getTime()
              setScheduleMode(t - Date.now() > 45_000 ? 'later' : 'now')
            }}
            className="input"
          />
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-white/60">Attach Image (optional)</label>
          {imagePreview ? (
            <div className="relative w-40 h-28 rounded-xl overflow-hidden border border-white/10">
              <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
              <button onClick={removeImage}
                className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white">
                <X size={12} />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => imageInputRef.current?.click()}
              className="flex items-center gap-2 rounded-xl border border-dashed border-white/20 px-4 py-3 text-sm text-white/50 transition-all hover:border-white/40 hover:text-white/70">
              <Image size={16} /> Upload image
            </button>
          )}
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={pickImage} />
        </div>

        <button onClick={handleSend} disabled={sending} className="btn-primary flex items-center gap-2">
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {sending ? 'Sending...' : scheduleMode === 'later' ? 'Schedule Notification' : 'Send Notification'}
        </button>
      </div>

      <div className="card p-5">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
          <Clock size={18} className="text-primary-400" /> Broadcast history
        </h2>
        {logsLoading ? (
          <p className="text-sm text-white/40">Loading...</p>
        ) : broadcasts.length === 0 ? (
          <p className="text-sm text-white/40">No broadcasts yet. Send or schedule one above.</p>
        ) : (
          <div className="space-y-2">
            {broadcasts.map(row => (
              <div key={row.id} className="flex items-start gap-3 rounded-xl bg-white/5 p-3">
                {row.status === 'sent'
                  ? <CheckCircle size={16} className="mt-0.5 shrink-0 text-success-400" />
                  : row.status === 'pending' || row.status === 'sending'
                    ? <Clock size={16} className="mt-0.5 shrink-0 text-amber-300" />
                    : <XCircle size={16} className="mt-0.5 shrink-0 text-error-400" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{row.title}</p>
                  <p className="text-xs text-white/50">
                    {row.target_type} · {row.status}
                    {row.recipient_count != null ? ` · ${row.recipient_count} recipients` : ''}
                  </p>
                  {row.error_message && <p className="truncate text-xs text-error-300">{row.error_message}</p>}
                  <p className="text-[11px] text-white/35 mt-1">
                    {row.status === 'pending'
                      ? `Scheduled ${formatTime(row.scheduled_for)}`
                      : formatTime(row.sent_at || row.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  )
}
