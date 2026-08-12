import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Headphones, Mail, MessageCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { openOrCreateSupportChat } from '../lib/supportChat'
import { pg } from '../design/tokens'
import { Surface } from '../design/primitives'

const SUPPORT_EMAIL_FALLBACK = 'support@pingget.in'

/** Need help — email + live chat with admin (user & DP tracking pages) */
export default function NeedHelpCard({
  requestId,
  chatBasePath,
}: {
  requestId?: string | null
  /** e.g. /app/support or /dp/support */
  chatBasePath: string
}) {
  const navigate = useNavigate()
  const [email, setEmail] = useState(SUPPORT_EMAIL_FALLBACK)
  const [unread, setUnread] = useState(0)
  const [opening, setOpening] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'support_email').maybeSingle()
      if (!cancelled && data?.value) setEmail(String(data.value))
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadUnread = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const { data } = await supabase
        .from('support_chats')
        .select('requester_unread')
        .eq('requester_id', user.id)
        .in('status', ['open', 'assigned'])
        .maybeSingle()
      if (!cancelled) setUnread(data?.requester_unread || 0)
    }
    loadUnread()
    const channel = supabase
      .channel(`need-help-unread-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_chats' }, () => loadUnread())
      .subscribe()
    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  const openSupportChat = async () => {
    setOpening(true)
    try {
      const chatId = await openOrCreateSupportChat(requestId || null)
      navigate(`${chatBasePath}/${chatId}`)
    } catch (e: any) {
      console.error('[NeedHelp] open chat failed', e)
      const msg = String(e?.message || '')
      if (/relation .* does not exist|Could not find the (table|function)|schema cache/i.test(msg)) {
        alert('Support chat is not set up on the server yet. Please email support@pingget.in — admin must apply the support_chat SQL migration.')
      } else {
        alert(msg || 'Could not open support chat. Please try email instead.')
      }
    } finally {
      setOpening(false)
    }
  }

  return (
    <Surface className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <Headphones size={16} style={{ color: pg.lime }} />
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: pg.text3 }}>
          Need help
        </p>
      </div>
      <p className="mb-3 text-sm" style={{ color: pg.text2 }}>
        Customer support — email us or chat live with an admin.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <a
          href={`mailto:${email}`}
          className="flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-extrabold"
          style={{ background: pg.surface2, border: `1px solid ${pg.line}`, color: pg.text }}
        >
          <Mail size={16} style={{ color: pg.lime }} /> Email
        </a>
        <button
          type="button"
          onClick={openSupportChat}
          disabled={opening}
          className="relative flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-extrabold disabled:opacity-60"
          style={{ background: pg.lime, color: pg.limeText }}
        >
          <MessageCircle size={16} />
          {opening ? 'Opening…' : 'Chat with admin'}
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      </div>
    </Surface>
  )
}
