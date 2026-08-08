import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useSnackbar } from '../../components/ui'
import { formatTime } from '../../lib/utils'
import { Send, Users, Bike, UserCheck, Megaphone, Clock, CheckCircle, XCircle, Loader2, Image, X, Search } from 'lucide-react'
import { AdminShell, AdminHeader } from './adminChrome'

type DeliveryLog = {
  id: string
  status: string
  error_message: string | null
  token: string | null
  created_at: string
}

type TargetType = 'single' | 'all_dps' | 'all_users' | 'broadcast'

type UserEntry = { id: string; full_name: string; phone: string | null; role: string }

export default function AdminNotifications() {
  const { show } = useSnackbar()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [targetType, setTargetType] = useState<TargetType>('broadcast')
  const [targetUserId, setTargetUserId] = useState('')
  const [sending, setSending] = useState(false)
  const [logs, setLogs] = useState<DeliveryLog[]>([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [userSearch, setUserSearch] = useState('')
  const [userList, setUserList] = useState<UserEntry[]>([])
  const [showUserList, setShowUserList] = useState(false)

  const fetchLogs = useCallback(async () => {
    const { data } = await supabase
      .from('notification_delivery_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    setLogs((data as DeliveryLog[]) || [])
    setLogsLoading(false)
  }, [])

  useEffect(() => { fetchLogs() }, [fetchLogs])

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

      // Resolve target user IDs
      let targetUsers: string[] = []
      if (targetType === 'single' && targetUserId.trim()) {
        targetUsers = [targetUserId.trim()]
      } else {
        const roleFilter = targetType === 'all_dps' ? 'dp' : targetType === 'all_users' ? 'user' : null
        const q = supabase.from('profiles').select('id')
        if (roleFilter) q.eq('role', roleFilter)
        const { data: profiles } = await q
        targetUsers = (profiles || []).map((p: any) => p.id)
      }

      if (targetUsers.length === 0) {
        show('No recipients found for the selected audience', 'error')
        setSending(false)
        return
      }

      // Insert notification records directly into notifications table
      const inserts = targetUsers.map(uid => ({
        user_id: uid,
        title: title.trim(),
        body: body.trim(),
        type: 'admin_announcement',
        image_url: imageUrl || null,
      }))

      const { error: insertError } = await supabase.from('notifications').insert(inserts)

      if (insertError) {
        show('Failed to send: ' + insertError.message, 'error')
        setSending(false)
        return
      }

      // Also try the edge function for push notifications (best effort, don't block on failure)
      supabase.functions.invoke('notify-broadcast', {
        body: {
          title: title.trim(),
          body: body.trim(),
          targetType,
          targetUserId: targetType === 'single' ? targetUserId.trim() : undefined,
          notificationType: 'admin_announcement',
          imageUrl,
        },
      }).then(() => {}).catch(() => {})

      show(`Notification sent to ${targetUsers.length} recipient(s)`, 'success')
      setTitle('')
      setBody('')
      setTargetUserId('')
      setUserSearch('')
      removeImage()
      fetchLogs()
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
    { value: 'single',     label: 'Single Person',   icon: Users,     desc: 'One specific user' },
  ]

  return (
    <AdminShell>
      <AdminHeader title="Notification Center" />

      {/* Compose */}
      <div className="card mb-6 p-5">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
          <Send size={18} className="text-primary-400" /> Compose Notification
        </h2>

        {/* Target */}
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

        {/* Title */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-white/60">Title *</label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Weekend Offer!" className="input" maxLength={100} />
        </div>

        {/* Message */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-white/60">Message *</label>
          <textarea value={body} onChange={e => setBody(e.target.value)}
            placeholder="Write your announcement, offer or update here..."
            className="input min-h-[100px]" maxLength={500} />
        </div>

        {/* Image */}
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
                {log.status === 'sent'
                  ? <CheckCircle size={16} className="shrink-0 text-success-400" />
                  : <XCircle size={16} className="shrink-0 text-error-400" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">
                    {log.status === 'sent' ? 'Delivered' : log.status === 'invalid_token' ? 'Invalid token' : 'Failed'}
                  </p>
                  {log.error_message && <p className="truncate text-xs text-white/40">{log.error_message}</p>}
                </div>
                <span className="shrink-0 text-xs text-white/40">{formatTime(log.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  )
}
