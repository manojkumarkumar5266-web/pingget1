import { supabase } from './supabase'

type MutualCancelResult = {
  success: boolean
  cancelled?: boolean
  mode?: string
  waiting_for?: string
  error?: string
}

/**
 * Advance mutual cancel — RPC first, then direct update if function missing from schema cache.
 */
export async function requestMutualCancel(
  requestId: string,
  reason: string | null = null,
): Promise<{ data: MutualCancelResult | null; error: string | null }> {
  const { data, error } = await supabase.rpc('request_mutual_cancel', {
    p_request_id: requestId,
    p_reason: reason,
  })

  if (!error && data && (data as MutualCancelResult).success !== false) {
    return { data: data as MutualCancelResult, error: null }
  }

  // Schema-cache / missing-RPC → client fallback (same rules as SQL)
  const missingRpc =
    !!error &&
    (/Could not find the function|schema cache|does not exist/i.test(error.message) ||
      error.code === 'PGRST202' ||
      error.code === '42883')

  if (!missingRpc && error) {
    const payload = (data && typeof data === 'object' ? data : null) as MutualCancelResult | null
    return {
      data: payload,
      error: error.message || payload?.error || 'Cancel failed',
    }
  }

  if (data && (data as MutualCancelResult).success === false && !missingRpc) {
    return { data: data as MutualCancelResult, error: (data as MutualCancelResult).error || 'Cancel failed' }
  }

  const fallback = await mutualCancelFallback(requestId, reason)
  return fallback
}

async function mutualCancelFallback(
  requestId: string,
  reason: string | null,
): Promise<{ data: MutualCancelResult | null; error: string | null }> {
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth.user?.id
  if (!uid) return { data: null, error: 'Not authenticated' }

  const { data: req, error: fetchErr } = await supabase
    .from('requests')
    .select('id, user_id, reserved_dp_id, accepted_dp_id, status, order_type, cancel_requested_by, cancel_request_reason')
    .eq('id', requestId)
    .maybeSingle()

  if (fetchErr || !req) return { data: null, error: fetchErr?.message || 'Request not found' }

  if (['cancelled', 'completed', 'expired'].includes(req.status)) {
    return { data: { success: false, error: 'Order already closed' }, error: 'Order already closed' }
  }

  if ((req.order_type || 'instant') !== 'advance') {
    return { data: { success: false, error: 'Use normal cancel for instant orders' }, error: 'Use normal cancel for instant orders' }
  }

  let role: 'user' | 'dp' | null = null
  let other: string | null = null
  if (uid === req.user_id) {
    role = 'user'
    other = req.reserved_dp_id || req.accepted_dp_id || null
  } else if (uid === req.reserved_dp_id || uid === req.accepted_dp_id) {
    role = 'dp'
    other = req.user_id
  } else {
    return { data: null, error: 'Not a party on this order' }
  }

  // User alone — no partner yet
  if (role === 'user' && !other) {
    const { error: updErr } = await supabase
      .from('requests')
      .update({
        status: 'cancelled',
        cancellation_reason: reason || 'Cancelled before partner reserved',
        cancelled_by: 'customer',
        cancel_requested_by: null,
        cancel_request_reason: null,
        cancel_requested_at: null,
      })
      .eq('id', requestId)
    if (updErr) return { data: null, error: updErr.message }
    return { data: { success: true, cancelled: true, mode: 'solo' }, error: null }
  }

  // Other party already requested → confirm
  if (req.cancel_requested_by && req.cancel_requested_by !== role) {
    const { error: updErr } = await supabase
      .from('requests')
      .update({
        status: 'cancelled',
        cancellation_reason: reason || req.cancel_request_reason || 'Cancelled by mutual agreement',
        cancelled_by: 'mutual',
        cancel_requested_by: null,
        cancel_request_reason: null,
        cancel_requested_at: null,
      })
      .eq('id', requestId)
    if (updErr) return { data: null, error: updErr.message }
    await supabase.from('orders').update({ status: 'cancelled' }).eq('request_id', requestId)
    if (other) {
      await supabase.from('notifications').insert({
        user_id: other,
        title: 'Booking cancelled',
        body: 'This advance booking was cancelled by mutual agreement.',
        type: 'order_status',
        related_id: requestId,
        notification_type: 'advance_cancel_confirmed',
      })
    }
    return { data: { success: true, cancelled: true, mode: 'mutual' }, error: null }
  }

  // Same party refreshing
  if (req.cancel_requested_by === role) {
    await supabase
      .from('requests')
      .update({
        cancel_request_reason: reason || req.cancel_request_reason,
        cancel_requested_at: new Date().toISOString(),
      })
      .eq('id', requestId)
    return {
      data: { success: true, cancelled: false, mode: 'pending', waiting_for: role === 'user' ? 'dp' : 'user' },
      error: null,
    }
  }

  // New cancel request
  const { error: reqErr } = await supabase
    .from('requests')
    .update({
      cancel_requested_by: role,
      cancel_request_reason: reason,
      cancel_requested_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (reqErr) {
    return {
      data: null,
      error:
        reqErr.message +
        ' — Ask admin to run supabase/APPLY_NOW_MUTUAL_CANCEL_AND_NOTIFY.sql in Supabase SQL Editor.',
    }
  }

  if (other) {
    await supabase.from('notifications').insert({
      user_id: other,
      title: 'Cancel requested',
      body:
        role === 'user'
          ? 'Customer requested to cancel this advance booking. Open Orders to agree or ignore.'
          : 'Partner requested to cancel this advance booking. Open Orders to agree or ignore.',
      type: 'order_status',
      related_id: requestId,
      notification_type: 'advance_cancel_request',
    })
  }

  return {
    data: { success: true, cancelled: false, mode: 'pending', waiting_for: role === 'user' ? 'dp' : 'user' },
    error: null,
  }
}
