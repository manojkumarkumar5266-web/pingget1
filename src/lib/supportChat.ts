import { supabase } from '../lib/supabase'

/** Open or reuse the caller's open support chat. Tries RPC then direct insert. */
export async function openOrCreateSupportChat(relatedRequestId?: string | null): Promise<string> {
  const related = relatedRequestId || null

  const rpc = await supabase.rpc('open_support_chat', { p_related_request_id: related })
  if (!rpc.error && rpc.data) return String(rpc.data)

  // Fallback when migration RPC is missing / outdated but tables exist
  const { data: auth } = await supabase.auth.getUser()
  const user = auth.user
  if (!user) throw new Error(rpc.error?.message || 'Not signed in')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const roleRaw = profile?.role || 'user'
  const requesterRole = roleRaw === 'dp' ? 'dp' : 'user'

  const { data: existing } = await supabase
    .from('support_chats')
    .select('id')
    .eq('requester_id', user.id)
    .in('status', ['open', 'assigned'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (existing?.id) {
    if (related) {
      await supabase
        .from('support_chats')
        .update({ related_request_id: related, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .is('related_request_id', null)
    }
    return existing.id
  }

  const { data: created, error: insertErr } = await supabase
    .from('support_chats')
    .insert({
      requester_id: user.id,
      requester_role: requesterRole,
      related_request_id: related,
      status: 'open',
    })
    .select('id')
    .single()

  if (insertErr || !created?.id) {
    throw new Error(
      insertErr?.message ||
        rpc.error?.message ||
        'Support chat is not available yet. Ask admin to apply the support_chat migration.',
    )
  }
  return String(created.id)
}
