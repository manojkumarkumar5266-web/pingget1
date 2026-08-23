import { kickPushDelivery } from './notify'
import { supabase, type DeliveryRequest, type Profile } from './supabase'

export type NearbyRequest = DeliveryRequest & { user_profile?: Profile }

export function isAdvanceNearbyRequest(
  req: Pick<DeliveryRequest, 'order_type' | 'status' | 'is_scheduled'> & { description?: string | null },
) {
  if (req.order_type === 'advance') return true
  if (req.is_scheduled) return true
  if (req.status === 'searching_dp') return true
  if ((req.description || '').toLowerCase().includes('scheduled:')) return true
  return false
}

export async function declineNearbyRequest(profileId: string, req: { id: string }) {
  const { error } = await supabase.rpc('append_declined_by', { row_id: req.id, dp_id: profileId })
  return { error }
}

export async function acceptNearbyRequest(
  profileId: string,
  req: NearbyRequest,
): Promise<{ success: boolean; chatRoomId?: string; error?: string }> {
  const advance = isAdvanceNearbyRequest(req)

  if (advance) {
    const { data: fnData, error: fnErr } = await supabase.functions.invoke('accept-advance', {
      body: { request_id: req.id },
    })
    const payload = (fnData || {}) as { success?: boolean; chat_room_id?: string }
    if (!fnErr && payload.success && payload.chat_room_id) {
      return { success: true, chatRoomId: payload.chat_room_id }
    }
    console.warn('[dp] accept-advance function failed, trying RPC:', fnErr || payload)
  }

  const rpcName = advance ? 'reserve_dp_for_advance' : 'accept_request'
  const { data, error } = await supabase.rpc(rpcName, {
    p_request_id: req.id,
    p_dp_user_id: profileId,
  })
  const row = Array.isArray(data) ? data[0] : data

  if (!error && row?.success) {
    const roomId = row.chat_room_id
      || (await supabase.from('chat_rooms').select('id').eq('request_id', req.id).maybeSingle()).data?.id
    if (roomId) return { success: true, chatRoomId: roomId }
    return { success: true }
  }

  if (advance) {
    const fallbackRoomId = await reserveAdvanceClientSide(profileId, req)
    if (fallbackRoomId) return { success: true, chatRoomId: fallbackRoomId }
  }

  const detail = row?.error_msg || error?.message || 'Failed to accept request'
  return { success: false, error: detail }
}

async function reserveAdvanceClientSide(profileId: string, req: NearbyRequest): Promise<string | null> {
  const { data: fresh } = await supabase
    .from('requests')
    .select('id, status, user_id, order_type')
    .eq('id', req.id)
    .maybeSingle()
  if (!fresh || !['searching_dp', 'no_dp_found'].includes(fresh.status)) return null

  const deadline = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  const { error: updErr } = await supabase.from('requests').update({
    status: 'dp_reserved',
    reserved_dp_id: profileId,
    reserved_at: new Date().toISOString(),
    accepted_dp_id: profileId,
    payment_deadline: deadline,
  }).eq('id', req.id).in('status', ['searching_dp', 'no_dp_found'])
  if (updErr) {
    console.error('[dp] client reserve update failed:', updErr)
    return null
  }

  let roomId: string | null = null
  const { data: existingRoom } = await supabase.from('chat_rooms').select('id').eq('request_id', req.id).maybeSingle()
  if (existingRoom?.id) roomId = existingRoom.id
  else {
    const { data: created, error: roomErr } = await supabase
      .from('chat_rooms')
      .insert({ request_id: req.id, user_id: fresh.user_id, dp_id: profileId })
      .select('id')
      .single()
    if (roomErr || !created) {
      console.error('[dp] client chat create failed:', roomErr)
      return null
    }
    roomId = created.id
  }

  let fee = 50
  const { data: settings } = await supabase.from('advance_settings').select('confirmation_fee').limit(1).maybeSingle()
  if (settings?.confirmation_fee != null) fee = Number(settings.confirmation_fee)

  const { data: ap } = await supabase.from('advance_payments').insert({
    request_id: req.id,
    chat_room_id: roomId,
    dp_id: profileId,
    customer_id: fresh.user_id,
    amount: fee,
    payment_deadline: deadline,
    status: 'waiting',
  }).select('id').maybeSingle()

  if (ap?.id) {
    await supabase.from('requests').update({ advance_payment_id: ap.id }).eq('id', req.id)
    const { error: apMsgErr } = await supabase.from('messages').insert({
      chat_room_id: roomId,
      sender_id: profileId,
      message_type: 'advance_payment',
      advance_payment_id: ap.id,
      quotation_data: {
        amount: fee,
        deadline,
        booking_id: req.id,
        scheduled_date: req.scheduled_date,
        scheduled_time: req.scheduled_slot || req.scheduled_time,
        purpose: 'Advance Booking Confirmation',
        status: 'waiting',
      },
    })
    if (apMsgErr) {
      await supabase.from('messages').insert({
        chat_room_id: roomId,
        sender_id: profileId,
        message_type: 'text',
        content: `Advance confirmation payment requested: ₹${fee}. Please pay and upload proof in chat.`,
      })
    }
  }

  await supabase.from('messages').insert({
    chat_room_id: roomId,
    sender_id: profileId,
    message_type: 'text',
    content: 'Hi! I have reserved your advance booking. Please complete the confirmation payment.',
  })
  await supabase.from('notifications').insert({
    user_id: fresh.user_id,
    title: 'Delivery Partner Reserved!',
    body: 'A delivery partner reserved your advance booking. Open chat to confirm payment.',
    type: 'dp_reserved',
    related_id: req.id,
  })
  kickPushDelivery()

  return roomId
}
