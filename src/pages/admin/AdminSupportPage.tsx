import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context'
import { pg } from '../../design/tokens'

type ChatRow = {
  id: string
  requester_id: string
  requester_role: 'user' | 'dp' | string
  status: string
  last_message_at: string | null
  last_message_preview: string | null
  admin_unread: number
  created_at: string
  profiles?: { full_name: string | null } | null
}

type Msg = {
  id: string
  chat_id: string
  sender_id: string
  sender_role: string
  content: string
  created_at: string
}

export default function AdminSupportPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'user' | 'dp'>('user')
  const [chats, setChats] = useState<ChatRow[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadChats = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('support_chats')
      .select('id, requester_id, requester_role, status, last_message_at, last_message_preview, admin_unread, created_at')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(200)
    const rows = (data as ChatRow[]) || []
    setChats(rows)

    const unique = [...new Set(rows.map((r) => r.requester_id).filter(Boolean))]
    if (unique.length) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', unique)
      if (profs) {
        setNames((prev) => {
          const next = { ...prev }
          for (const p of profs) next[p.id] = p.full_name || 'Unknown'
          return next
        })
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadChats()
    const channel = supabase
      .channel('admin-support-chats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_chats' }, () => {
        void loadChats()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, () => {
        void loadChats()
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => chats.filter((c) => c.requester_role === tab), [chats, tab])
  const customerUnread = useMemo(
    () => chats.filter((c) => c.requester_role === 'user').reduce((s, c) => s + (c.admin_unread || 0), 0),
    [chats],
  )
  const dpUnread = useMemo(
    () => chats.filter((c) => c.requester_role === 'dp').reduce((s, c) => s + (c.admin_unread || 0), 0),
    [chats],
  )
  const active = useMemo(() => chats.find((c) => c.id === activeId) || null, [chats, activeId])
  const activeName = active ? names[active.requester_id] || 'Unknown' : ''

  useEffect(() => {
    if (!activeId) {
      setMessages([])
      return
    }
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('support_messages')
        .select('id, chat_id, sender_id, sender_role, content, created_at')
        .eq('chat_id', activeId)
        .order('created_at', { ascending: true })
        .limit(400)
      if (!cancelled) setMessages((data as Msg[]) || [])
      await supabase.rpc('mark_support_chat_read', { p_chat_id: activeId })
      void loadChats()
    })()

    const channel = supabase
      .channel(`admin-support-${activeId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `chat_id=eq.${activeId}` },
        (payload) => {
          const row = payload.new as Msg
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]))
          if (row.sender_role !== 'admin') {
            void supabase.rpc('mark_support_chat_read', { p_chat_id: activeId })
          }
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, activeId])

  const send = async () => {
    const body = draft.trim()
    if (!body || !activeId || sending) return
    setSending(true)
    setDraft('')
    try {
      const { data: msgId, error } = await supabase.rpc('send_support_message', {
        p_chat_id: activeId,
        p_content: body,
      })
      if (error) throw error
      if (msgId) {
        setMessages((prev) =>
          prev.some((m) => m.id === msgId)
            ? prev
            : [
                ...prev,
                {
                  id: String(msgId),
                  chat_id: activeId,
                  sender_id: user!.id,
                  sender_role: 'admin',
                  content: body,
                  created_at: new Date().toISOString(),
                },
              ],
        )
      }
      void loadChats()
    } catch {
      setDraft(body)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-5.5rem)] max-w-6xl flex-col gap-3 lg:flex-row">
      <aside
        className="flex w-full flex-col overflow-hidden rounded-2xl lg:w-[340px]"
        style={{ border: `1px solid ${pg.line}`, background: pg.surface }}
      >
        <div className="p-3" style={{ borderBottom: `1px solid ${pg.line}` }}>
          <h1 className="text-lg font-bold" style={{ color: pg.text }}>
            Support chat
          </h1>
          <p className="text-xs" style={{ color: pg.text3 }}>
            Live chats from customers and delivery partners
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTab('user')}
              className="relative rounded-xl px-3 py-2 text-sm font-semibold"
              style={
                tab === 'user'
                  ? { background: pg.lime, color: pg.limeText }
                  : { border: `1px solid ${pg.line}`, background: pg.bg, color: pg.text2 }
              }
            >
              Customer
              {customerUnread > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {customerUnread > 99 ? '99+' : customerUnread}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => setTab('dp')}
              className="relative rounded-xl px-3 py-2 text-sm font-semibold"
              style={
                tab === 'dp'
                  ? { background: pg.lime, color: pg.limeText }
                  : { border: `1px solid ${pg.line}`, background: pg.bg, color: pg.text2 }
              }
            >
              DP
              {dpUnread > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {dpUnread > 99 ? '99+' : dpUnread}
                </span>
              ) : null}
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <p className="px-2 py-4 text-sm" style={{ color: pg.text3 }}>
              Loading…
            </p>
          ) : null}
          {!loading && filtered.length === 0 ? (
            <p className="px-2 py-4 text-sm" style={{ color: pg.text3 }}>
              No chats yet
            </p>
          ) : null}
          {filtered.map((c) => {
            const selected = c.id === activeId
            const name = names[c.requester_id] || 'Unknown'
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveId(c.id)}
                className="mb-1 w-full rounded-xl px-3 py-2.5 text-left transition"
                style={
                  selected
                    ? { background: 'rgba(196,214,0,0.2)', boxShadow: `inset 0 0 0 1px rgba(196,214,0,0.5)` }
                    : undefined
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold" style={{ color: pg.text }}>
                      {name}
                    </p>
                    <p className="truncate font-mono text-[10px]" style={{ color: pg.text3 }}>
                      ID: {c.requester_id.slice(0, 8)}…
                    </p>
                    <p className="mt-1 truncate text-xs" style={{ color: pg.text2 }}>
                      {c.last_message_preview || 'No messages yet'}
                    </p>
                  </div>
                  {c.admin_unread > 0 ? (
                    <span className="mt-0.5 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {c.admin_unread > 99 ? '99+' : c.admin_unread}
                    </span>
                  ) : null}
                </div>
              </button>
            )
          })}
        </div>
      </aside>

      <section
        className="flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-2xl"
        style={{ border: `1px solid ${pg.line}`, background: pg.surface }}
      >
        {!active ? (
          <div className="flex flex-1 items-center justify-center p-6 text-sm" style={{ color: pg.text3 }}>
            Select a chat to reply
          </div>
        ) : (
          <>
            <header className="px-4 py-3" style={{ borderBottom: `1px solid ${pg.line}` }}>
              <p className="text-sm font-bold" style={{ color: pg.text }}>
                {activeName}
              </p>
              <p className="font-mono text-[11px]" style={{ color: pg.text3 }}>
                USER ID: {active.requester_id}
              </p>
              <p className="text-[11px] capitalize" style={{ color: pg.text2 }}>
                {active.requester_role === 'dp' ? 'Delivery partner' : 'Customer'}
              </p>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((m) => {
                const mine = m.sender_id === user?.id || m.sender_role === 'admin'
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className="max-w-[85%] rounded-2xl px-3 py-2 text-sm"
                      style={
                        mine
                          ? { background: pg.lime, color: pg.limeText }
                          : { border: `1px solid ${pg.line}`, background: pg.bg, color: pg.text }
                      }
                    >
                      {!mine ? (
                        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: pg.text3 }}>
                          {activeName}
                        </p>
                      ) : (
                        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(0,0,0,0.55)' }}>
                          Admin
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                      <p className="mt-1 text-[10px]" style={{ color: mine ? 'rgba(0,0,0,0.55)' : pg.text3 }}>
                        {new Date(m.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>
            <div className="p-3" style={{ borderTop: `1px solid ${pg.line}` }}>
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={2}
                  placeholder="Reply as admin…"
                  className="max-h-32 flex-1 resize-none rounded-2xl px-3 py-2.5 text-sm outline-none"
                  style={{ border: `1px solid ${pg.line}`, background: pg.bg, color: pg.text }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void send()
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={!draft.trim() || sending}
                  onClick={() => void send()}
                  className="inline-flex items-center gap-1 rounded-2xl px-4 py-2.5 text-sm font-bold disabled:opacity-50"
                  style={{ background: pg.lime, color: pg.limeText }}
                >
                  <Send size={16} />
                  Send
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
