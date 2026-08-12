import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context'
import { pg } from '../../design/tokens'
import { openOrCreateSupportChat } from '../../lib/supportChat'

type Msg = {
  id: string
  chat_id: string
  sender_id: string
  sender_role: string
  content: string
  created_at: string
}

type ChatMeta = {
  id: string
  requester_id: string
  requester_role: string
  status: string
}

export function SupportChatScreen({ homePath }: { homePath: string }) {
  const { chatId: routeChatId } = useParams<{ chatId?: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [chat, setChat] = useState<ChatMeta | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadMessages = useCallback(async (id: string) => {
    const { data: msgs } = await supabase
      .from('support_messages')
      .select('id, chat_id, sender_id, sender_role, content, created_at')
      .eq('chat_id', id)
      .order('created_at', { ascending: true })
      .limit(300)
    setMessages((msgs as Msg[]) || [])
    await supabase.rpc('mark_support_chat_read', { p_chat_id: id })
  }, [])

  const openChat = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      let id = routeChatId || null
      if (!id) {
        id = await openOrCreateSupportChat()
        navigate(`${homePath}/support/${id}`, { replace: true })
      }
      const { data: meta } = await supabase
        .from('support_chats')
        .select('id, requester_id, requester_role, status')
        .eq('id', id!)
        .maybeSingle()
      setChat((meta as ChatMeta) || { id: id!, requester_id: user.id, requester_role: 'user', status: 'open' })
      await loadMessages(id!)
    } catch (e: any) {
      setError(e?.message || 'Could not open support chat')
    } finally {
      setLoading(false)
    }
  }, [user, routeChatId, homePath, navigate, loadMessages])

  useEffect(() => {
    void openChat()
  }, [openChat])

  useEffect(() => {
    if (!chat?.id) return
    const channel = supabase
      .channel(`support-chat-${chat.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `chat_id=eq.${chat.id}` },
        (payload) => {
          const row = payload.new as Msg
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]))
          if (row.sender_id !== user?.id) {
            void supabase.rpc('mark_support_chat_read', { p_chat_id: chat.id })
          }
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [chat?.id, user?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const send = async () => {
    const body = draft.trim()
    if (!body || !chat || sending) return
    setSending(true)
    setDraft('')
    try {
      const { data: msgId, error: rpcErr } = await supabase.rpc('send_support_message', {
        p_chat_id: chat.id,
        p_content: body,
      })
      if (rpcErr) throw rpcErr
      if (msgId) {
        setMessages((prev) =>
          prev.some((m) => m.id === msgId)
            ? prev
            : [
                ...prev,
                {
                  id: String(msgId),
                  chat_id: chat.id,
                  sender_id: user!.id,
                  sender_role: chat.requester_role,
                  content: body,
                  created_at: new Date().toISOString(),
                },
              ],
        )
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to send')
      setDraft(body)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-[100dvh] flex-col" style={{ background: pg.bg, color: pg.text }}>
      <header className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${pg.line}` }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-full p-2"
          style={{ background: pg.surface2 }}
          aria-label="Back"
        >
          <ArrowLeft size={18} style={{ color: pg.text }} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">Chat with support team</p>
          <p className="truncate text-[11px]" style={{ color: pg.text3 }}>
            Support team · live chat
          </p>
        </div>
        <Link to={homePath} className="text-xs font-semibold" style={{ color: pg.lime }}>
          Home
        </Link>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="text-sm" style={{ color: pg.text3 }}>
            Opening chat…
          </p>
        ) : null}
        {error ? (
          <p className="rounded-xl px-3 py-2 text-sm text-red-200" style={{ border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)' }}>
            {error}
          </p>
        ) : null}
        {!loading && messages.length === 0 ? (
          <p className="rounded-2xl px-4 py-3 text-sm" style={{ border: `1px solid ${pg.line}`, background: pg.surface, color: pg.text3 }}>
            Say hello — the support team will reply here. Your name and user ID are visible on their side.
          </p>
        ) : null}
        {messages.map((m) => {
          const mine = m.sender_id === user?.id
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-[85%] rounded-2xl px-3 py-2 text-sm"
                style={
                  mine
                    ? { background: pg.lime, color: pg.limeText }
                    : { border: `1px solid ${pg.line}`, background: pg.surface, color: pg.text }
                }
              >
                {!mine ? (
                  <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: pg.text3 }}>
                    Support
                  </p>
                ) : null}
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <p className="mt-1 text-[10px]" style={{ color: mine ? 'rgba(0,0,0,0.55)' : pg.text3 }}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="p-3" style={{ borderTop: `1px solid ${pg.line}`, background: pg.bg }}>
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={1}
            placeholder="Type a message…"
            className="max-h-28 flex-1 resize-none rounded-2xl px-3 py-2.5 text-sm outline-none"
            style={{ border: `1px solid ${pg.line}`, background: pg.surface, color: pg.text }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
          />
          <button
            type="button"
            disabled={!draft.trim() || sending || !chat}
            onClick={() => void send()}
            className="rounded-2xl px-4 py-2.5 text-sm font-bold disabled:opacity-50"
            style={{ background: pg.lime, color: pg.limeText }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

export default SupportChatScreen
