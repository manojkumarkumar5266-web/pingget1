import { accrueCommissionForRequest } from './commission'
import { supabase } from './supabase'

/**
 * DP taps Accept Payment — tries SECURITY DEFINER RPC first, then direct update.
 * Returns null on success, or a human-readable error string.
 */
export async function acceptDpPayment(requestId: string): Promise<string | null> {
  const now = new Date().toISOString()

  const { data: rpcData, error: rpcErr } = await supabase.rpc('mark_dp_payment_accepted', {
    p_request_id: requestId,
  })

  if (!rpcErr && rpcData && (rpcData as any).ok !== false) {
    await accrueCommissionForRequest(requestId)
    return null
  }

  const rpcMessage =
    (rpcData && typeof rpcData === 'object' && (rpcData as any).error
      ? String((rpcData as any).hint || (rpcData as any).error)
      : null) ||
    rpcErr?.message ||
    null

  const { data: auth } = await supabase.auth.getUser()
  const uid = auth.user?.id
  if (uid) {
    await supabase
      .from('requests')
      .update({ accepted_dp_id: uid })
      .eq('id', requestId)
      .is('accepted_dp_id', null)
  }

  const { error: updErr } = await supabase
    .from('requests')
    .update({
      payment_accepted_at: now,
      status: 'completed',
    })
    .eq('id', requestId)

  if (!updErr) {
    await supabase.from('orders').update({ status: 'completed', completed_at: now }).eq('request_id', requestId)
    await accrueCommissionForRequest(requestId)
    return null
  }

  const { error: colErr } = await supabase
    .from('requests')
    .update({ payment_accepted_at: now })
    .eq('id', requestId)

  if (!colErr) {
    await supabase.from('orders').update({ status: 'completed', completed_at: now }).eq('request_id', requestId)
    await accrueCommissionForRequest(requestId)
    return null
  }

  return (
    rpcMessage ||
    updErr.message ||
    colErr.message ||
    'Could not accept payment. Ask admin to run APPLY_NOW_FIX_ACCEPT_PAYMENT.sql'
  )
}
