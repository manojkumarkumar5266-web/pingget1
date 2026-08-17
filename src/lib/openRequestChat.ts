import { supabase } from './supabase'

/** Open (or create) the chat room for a request, then return its id. */
export async function openRequestChatRoom(opts: {
  requestId: string
  userId: string
  dpId: string
}): Promise<string | null> {
  const { requestId, userId, dpId } = opts
  const { data: existing } = await supabase
    .from('chat_rooms')
    .select('id')
    .eq('request_id', requestId)
    .maybeSingle()
  if (existing?.id) return existing.id

  const { data: created, error } = await supabase
    .from('chat_rooms')
    .insert({
      request_id: requestId,
      user_id: userId,
      dp_id: dpId,
    })
    .select('id')
    .single()

  if (created?.id) return created.id

  // Race: another client created it
  if (error) {
    const { data: again } = await supabase
      .from('chat_rooms')
      .select('id')
      .eq('request_id', requestId)
      .maybeSingle()
    return again?.id || null
  }
  return null
}
