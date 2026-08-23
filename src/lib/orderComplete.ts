import { supabase } from './supabase'

/** True after the delivery + pay + DP-accept (and/or rating) flow is finished. */
export function isOrderFinished(req: {
  status?: string | null
  payment_accepted_at?: string | null
}) {
  if (req.payment_accepted_at) return true
  const s = req.status || ''
  return s === 'completed' || s === 'task_completed'
}

export async function markRequestCompleted(requestId: string) {
  const now = new Date().toISOString()
  const { error } = await supabase.from('requests').update({ status: 'completed' }).eq('id', requestId)
  if (error) {
    await supabase.from('requests').update({ status: 'completed' } as any).eq('id', requestId)
  }
  await supabase.from('orders').update({ status: 'completed', completed_at: now }).eq('request_id', requestId)
}
