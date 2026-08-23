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

export function summarizeCommission(
  orders: CommissionOrderRow[],
  paidAmount: number,
): CommissionBreakdown {
  const todayStart = startOfLocalDay()
  const eligible = orders.filter(o => o.status !== 'cancelled')
  const totalAccrued = eligible.reduce((s, o) => s + Number(o.commission_amount || 0), 0)
  const totalPaid = Number(paidAmount || 0)
  const outstanding = Math.max(0, totalAccrued - totalPaid)
  const beforeToday = eligible
    .filter(o => accruedAt(o) < todayStart)
    .reduce((s, o) => s + Number(o.commission_amount || 0), 0)
  const dueNow = Math.max(0, beforeToday - totalPaid)
  const dueTomorrow = Math.max(0, outstanding - dueNow)
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
  if (existing && Number(existing.commission_amount || 0) > 0) {
    await supabase.from('orders').update({ status: 'completed', completed_at: existing.completed_at || now }).eq('id', existing.id)
    return
  }

  const { data: req } = await supabase.from('requests').select('*').eq('id', requestId).maybeSingle()
  if (!req) return

  const charge = Math.max(
    0,
    Number(existing?.delivery_charge || 0) ||
      Number((req as any).estimated_total_charge || 0) ||
      Number((req as any).max_budget || 0),
  )
  if (charge <= 0) return

  let city = cityName || null
  if (!city && req.user_id) {
    const { data: user } = await supabase.from('profiles').select('city').eq('id', req.user_id).maybeSingle()
    city = user?.city || null
  }
  const pct = await getCityCommissionPct(city)
  const split = splitCommission(charge, pct)
  const payload = {
    commission_pct: pct,
    commission_amount: split.commissionAmount,
    dp_earnings: split.dpEarnings,
    delivery_charge: charge,
    status: 'completed',
    completed_at: now,
  }

  if (existing) {
    await supabase.from('orders').update(payload).eq('id', existing.id)
    return
  }

  const dpId = (req as any).accepted_dp_id || (req as any).reserved_dp_id
  if (!dpId || !req.user_id) return
  await supabase.from('orders').insert({
    request_id: requestId,
    user_id: req.user_id,
    dp_id: dpId,
    items_summary: (req as any).description?.split('\n')[0]?.trim() || (req as any).request_category || 'Delivery',
    item_cost: 0,
    ...payload,
  })
}
