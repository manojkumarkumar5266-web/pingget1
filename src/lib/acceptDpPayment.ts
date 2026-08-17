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
    return null
  }

  const rpcMessage =
    (rpcData && typeof rpcData === 'object' && (rpcData as any).error
      ? String((rpcData as any).hint || (rpcData as any).error)
      : null) ||
    rpcErr?.message ||
    null

  // Fallback: ensure this DP is marked accepted, then set payment_accepted_at
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
      status: 'cash_received',
    })
    .eq('id', requestId)

  if (!updErr) return null

  // Last resort: payment_accepted_at only (status column may be sticky)
  const { error: colErr } = await supabase
    .from('requests')
    .update({ payment_accepted_at: now })
    .eq('id', requestId)

  if (!colErr) return null

  return (
    rpcMessage ||
    updErr.message ||
    colErr.message ||
    'Could not accept payment. Ask admin to run APPLY_NOW_FIX_ACCEPT_PAYMENT.sql'
  )
}
