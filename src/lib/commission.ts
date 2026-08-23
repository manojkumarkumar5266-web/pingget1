import { supabase } from './supabase'

/** Start of local calendar day (commission from earlier days is due after this). */
export function startOfLocalDay(d = new Date()): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export type CommissionOrderRow = {
  commission_amount?: number | null
  status?: string | null
  created_at?: string | null
  completed_at?: string | null
}

export type CommissionBreakdown = {
  /** Unpaid commission from orders accrued before today 12:00 AM — blocks going online. */
  dueNow: number
  /** Unpaid commission from today's orders — pay after midnight before next shift. */
  dueTomorrow: number
  /** All unpaid commission. */
  outstanding: number
  totalAccrued: number
  totalPaid: number
}

function accruedAt(o: CommissionOrderRow): number {
  const raw = o.completed_at || o.created_at
  const t = raw ? new Date(raw).getTime() : 0
  return Number.isFinite(t) ? t : 0
}

function commissionCountsTowardWallet(o: CommissionOrderRow): boolean {
  if (o.status === 'cancelled') return false
  const s = o.status || ''
  return s === 'completed' || s === 'delivered' || s === 'cash_received' || !!o.completed_at
}

export function summarizeCommission(
  orders: CommissionOrderRow[],
  paidAmount: number,
): CommissionBreakdown {
  const todayStart = startOfLocalDay()
  const eligible = orders.filter(commissionCountsTowardWallet)
  const totalAccrued = eligible.reduce((s, o) => s + Number(o.commission_amount || 0), 0)
  const totalPaid = Number(paidAmount || 0)
  const outstanding = Math.max(0, Math.round((totalAccrued - totalPaid) * 100) / 100)
  const beforeToday = eligible
    .filter(o => accruedAt(o) < todayStart)
    .reduce((s, o) => s + Number(o.commission_amount || 0), 0)
  const dueNow = Math.max(0, Math.round((beforeToday - totalPaid) * 100) / 100)
  const dueTomorrow = Math.max(0, Math.round((outstanding - dueNow) * 100) / 100)
  return { dueNow, dueTomorrow, outstanding, totalAccrued, totalPaid }
}

export async function fetchDpCommissionBreakdown(dpUserId: string): Promise<CommissionBreakdown> {
  const [ordersRes, paidRes] = await Promise.all([
    supabase
      .from('orders')
      .select('commission_amount, status, created_at, completed_at')
      .eq('dp_id', dpUserId)
      .neq('status', 'cancelled'),
    supabase
      .from('dp_commission_receipts')
      .select('amount')
      .eq('dp_user_id', dpUserId)
      .eq('status', 'confirmed'),
  ])
  const paid = (paidRes.data || []).reduce((s: number, r: { amount?: number }) => s + Number(r.amount || 0), 0)
  return summarizeCommission((ordersRes.data || []) as CommissionOrderRow[], paid)
}

export async function getCityCommissionPct(cityName?: string | null): Promise<number> {
  if (!cityName) return 10
  const { data } = await supabase
    .from('cities')
    .select('commission_pct')
    .ilike('name', cityName)
    .maybeSingle()
  const pct = Number(data?.commission_pct)
  return Number.isFinite(pct) && pct > 0 ? pct : 10
}

export function splitCommission(deliveryCharge: number, commissionPct: number) {
  const charge = Math.max(0, Number(deliveryCharge) || 0)
  const pct = Math.max(0, Number(commissionPct) || 0)
  const commissionAmount = Math.round(charge * pct) / 100
  return {
    commissionPct: pct,
    commissionAmount,
    dpEarnings: Math.max(0, charge - commissionAmount),
  }
}

/**
 * Ensure an order row has admin commission after a job finishes.
 * Instant jobs that skip quotation otherwise show ₹0 in the DP wallet.
 */
export async function accrueCommissionForRequest(requestId: string, cityName?: string | null) {
  const now = new Date().toISOString()
  const { data: existing } = await supabase.from('orders').select('*').eq('request_id', requestId).maybeSingle()

  const { data: req } = await supabase.from('requests').select('*').eq('id', requestId).maybeSingle()
  if (!req && !existing) return

  const dpId = existing?.dp_id || (req as any)?.accepted_dp_id || (req as any)?.reserved_dp_id
  const userId = existing?.user_id || req?.user_id

  let city = cityName || null
  if (!city && dpId) {
    const { data: dpProf } = await supabase.from('profiles').select('city').eq('id', dpId).maybeSingle()
    city = dpProf?.city || null
  }
  if (!city && userId) {
    const { data: user } = await supabase.from('profiles').select('city').eq('id', userId).maybeSingle()
    city = user?.city || null
  }

  let charge = Math.max(
    0,
    Number(existing?.delivery_charge || 0) ||
      Number((req as any)?.estimated_total_charge || 0) ||
      Number((req as any)?.max_budget || 0),
  )
  if (charge <= 0) {
    const { data: room } = await supabase.from('chat_rooms').select('id').eq('request_id', requestId).maybeSingle()
    if (room?.id) {
      const { data: qmsg } = await supabase
        .from('messages')
        .select('quotation_data')
        .eq('chat_room_id', room.id)
        .eq('message_type', 'quotation')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const q = qmsg?.quotation_data || {}
      charge = Number(q.delivery_charge || 0) + Number(q.booking_charge || 0)
    }
  }

  const pct = await getCityCommissionPct(city)
  const existingComm = Number(existing?.commission_amount || 0)
  const split = existingComm > 0
    ? { commissionAmount: existingComm, dpEarnings: Number(existing?.dp_earnings || 0), commissionPct: Number(existing?.commission_pct || pct) }
    : splitCommission(charge, pct)

  if (existingComm <= 0 && charge <= 0) {
    if (existing) {
      await supabase.from('orders').update({ status: 'completed', completed_at: existing.completed_at || now }).eq('id', existing.id)
    }
    return
  }

  const payload = {
    commission_pct: split.commissionPct ?? pct,
    commission_amount: split.commissionAmount,
    dp_earnings: existingComm > 0 ? Number(existing?.dp_earnings || 0) : split.dpEarnings,
    delivery_charge: charge > 0 ? charge : Number(existing?.delivery_charge || 0),
    status: 'completed',
    completed_at: existing?.completed_at || now,
  }

  if (existing) {
    const { error } = await supabase.from('orders').update(payload).eq('id', existing.id)
    if (error) console.error('[commission] update failed', error)
    return
  }

  if (!dpId || !userId) return
  const { error } = await supabase.from('orders').insert({
    request_id: requestId,
    user_id: userId,
    dp_id: dpId,
    items_summary: (req as any)?.description?.split('\n')[0]?.trim() || (req as any)?.request_category || 'Delivery',
    item_cost: 0,
    ...payload,
  })
  if (error) console.error('[commission] insert failed', error)
}
