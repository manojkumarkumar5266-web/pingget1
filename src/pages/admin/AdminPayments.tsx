import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { EmptyState, SkeletonCard, Tabs } from '../../components/ui'
import { formatTime, formatCurrency } from '../../lib/utils'
import { CreditCard, Download, IndianRupee, CheckCircle, XCircle, Clock, Settings, ExternalLink, AlertTriangle } from 'lucide-react'
import * as XLSX from 'xlsx'

type DpEarningRow = {
  dp_id: string
  dp_name: string
  dp_phone: string
  orders: number
  total_earned: number
  commission_owed: number
  total_charge: number
}

type DpPendingRow = {
  dp_id: string
  dp_name: string
  dp_phone: string
  orders: number
  total_commission: number
  confirmed_paid: number
  outstanding: number
}

type Receipt = {
  id: string
  dp_user_id: string
  amount: number
  upi_ref: string
  screenshot_url: string | null
  status: 'submitted' | 'confirmed' | 'rejected'
  reject_reason: string | null
  submitted_at: string
  _dp?: { full_name: string; phone: string }
}

export default function AdminPayments() {
  const [dpEarnings, setDpEarnings] = useState<DpEarningRow[]>([])
  const [dpPending, setDpPending] = useState<DpPendingRow[]>([])
  const [orderCommissions, setOrderCommissions] = useState<any[]>([])
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [adminUpi, setAdminUpi] = useState('')
  const [savingUpi, setSavingUpi] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'orders' | 'dp' | 'receipts' | 'pending'>('orders')
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const fetchAll = useCallback(async () => {
      const [completedOrdersRes, receiptsRes, settingsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, dp_id, items_summary, delivery_charge, commission_pct, commission_amount, dp_earnings, completed_at, created_at')
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(500),
        supabase.from('dp_commission_receipts').select('*').order('submitted_at', { ascending: false }).limit(300),
        supabase.from('app_settings').select('key, value'),
      ])

      const orders = completedOrdersRes.data || []
      const rawReceipts = receiptsRes.data || []

      const upiSetting = (settingsRes.data || []).find((s: any) => s.key === 'admin_upi_id')
      setAdminUpi(upiSetting?.value || '')

      const dpIds = [...new Set([
        ...orders.map((o: any) => o.dp_id),
        ...rawReceipts.map((r: any) => r.dp_user_id),
      ].filter(Boolean))]

      let profileMap: Record<string, { full_name: string; phone: string }> = {}
      if (dpIds.length > 0) {
        const { data: prof } = await supabase.from('profiles').select('id, full_name, phone').in('id', dpIds)
        profileMap = Object.fromEntries((prof || []).map((p: any) => [p.id, { full_name: p.full_name, phone: p.phone || '' }]))
      }

      // Aggregate per-DP earnings
      const dpMap: Record<string, DpEarningRow> = {}
      for (const o of orders) {
        if (!o.dp_id) continue
        if (!dpMap[o.dp_id]) {
          const prof = profileMap[o.dp_id] || { full_name: 'Unknown', phone: '' }
          dpMap[o.dp_id] = { dp_id: o.dp_id, dp_name: prof.full_name, dp_phone: prof.phone, orders: 0, total_earned: 0, commission_owed: 0, total_charge: 0 }
        }
        dpMap[o.dp_id].orders += 1
        dpMap[o.dp_id].total_charge += Number(o.delivery_charge || 0)
        dpMap[o.dp_id].total_earned += Number(o.dp_earnings || 0)
        dpMap[o.dp_id].commission_owed += Number(o.commission_amount || 0)
      }
      setDpEarnings(Object.values(dpMap).sort((a, b) => b.total_earned - a.total_earned))
      setOrderCommissions(orders.map((o: any) => ({ ...o, dp_name: (profileMap[o.dp_id] || {}).full_name || 'Unknown' })))
      setReceipts(rawReceipts.map((r: any) => ({ ...r, _dp: profileMap[r.dp_user_id] || { full_name: 'Unknown', phone: '' } })))

      // Calculate per-DP outstanding commission
      const pendingMap: Record<string, DpPendingRow> = {}
      for (const o of orders) {
        if (!o.dp_id) continue
        if (!pendingMap[o.dp_id]) {
          const prof = profileMap[o.dp_id] || { full_name: 'Unknown', phone: '' }
          pendingMap[o.dp_id] = { dp_id: o.dp_id, dp_name: prof.full_name, dp_phone: prof.phone, orders: 0, total_commission: 0, confirmed_paid: 0, outstanding: 0 }
        }
        pendingMap[o.dp_id].orders += 1
        pendingMap[o.dp_id].total_commission += Number(o.commission_amount || 0)
      }
      for (const r of rawReceipts) {
        if (r.status === 'confirmed' && pendingMap[r.dp_user_id]) {
          pendingMap[r.dp_user_id].confirmed_paid += Number(r.amount || 0)
        }
      }
      for (const dp of Object.values(pendingMap)) {
        dp.outstanding = Math.max(0, dp.total_commission - dp.confirmed_paid)
      }
      setDpPending(Object.values(pendingMap).filter(d => d.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding))

      setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const saveAdminUpi = async () => {
    setSavingUpi(true)
    await supabase.from('app_settings').upsert({ key: 'admin_upi_id', value: adminUpi })
    setSavingUpi(false)
  }

  const confirmReceipt = async (id: string) => {
    const { data: userData } = await supabase.auth.getUser()
    const receipt = receipts.find(r => r.id === id)
    await supabase.from('dp_commission_receipts').update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      confirmed_by: userData.user?.id,
    }).eq('id', id)
    // The trigger on dp_commission_receipts will insert into commission_payments
    // Set DP back online after payment confirmed
    if (receipt?.dp_user_id) {
      await supabase.from('delivery_partners').update({ is_online: true }).eq('user_id', receipt.dp_user_id)
      await supabase.from('notifications').insert({
        user_id: receipt.dp_user_id,
        title: 'Payment Confirmed!',
        body: 'Your commission payment has been verified. Your account is now active and online.',
        type: 'payment_confirmed',
      })
    }
    fetchAll()
  }

  const rejectReceipt = async (id: string) => {
    const receipt = receipts.find(r => r.id === id)
    await supabase.from('dp_commission_receipts').update({
      status: 'rejected',
      reject_reason: rejectReason || 'Rejected by admin',
    }).eq('id', id)
    // Force DP offline until commission is paid
    if (receipt?.dp_user_id) {
      await supabase.from('delivery_partners').update({ is_online: false }).eq('user_id', receipt.dp_user_id)
      await supabase.from('notifications').insert({
        user_id: receipt.dp_user_id,
        title: 'Payment Rejected',
        body: (rejectReason || 'Payment could not be verified') + '. Please pay outstanding commission to come back online.',
        type: 'payment_rejected',
      })
    }
    setRejectId(null)
    setRejectReason('')
    fetchAll()
  }

  // Admin commission = only confirmed receipts total
  const confirmedCommissionTotal = receipts.filter(r => r.status === 'confirmed').reduce((s, r) => s + Number(r.amount || 0), 0)
  const totalDpEarnings = orderCommissions.reduce((s, o) => s + Number(o.dp_earnings || 0), 0)
  const pendingReceiptsCount = receipts.filter(r => r.status === 'submitted').length
  const totalOutstanding = dpPending.reduce((s, d) => s + d.outstanding, 0)

  const exportOrderCommissions = () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(orderCommissions.map(o => ({
      'DP Name': o.dp_name, 'Order': o.items_summary || 'Delivery',
      'Delivery Charge': o.delivery_charge, 'Commission %': o.commission_pct,
      'Admin Commission': o.commission_amount, 'DP Earnings': o.dp_earnings,
      'Date': formatTime(o.completed_at || o.created_at),
    }))), 'Order Commissions')
    XLSX.writeFile(wb, 'order-commissions.xlsx')
  }

  const exportDpEarnings = () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dpEarnings.map(d => ({
      'DP Name': d.dp_name, 'Phone': d.dp_phone, 'Orders': d.orders,
      'Total Charged': d.total_charge, 'DP Earned': d.total_earned, 'Commission Owed': d.commission_owed,
    }))), 'DP Earnings')
    XLSX.writeFile(wb, 'dp-earnings.xlsx')
  }

  const exportPendingCommission = () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dpPending.map(d => ({
      'DP Name': d.dp_name, 'Phone': d.dp_phone, 'Orders': d.orders,
      'Total Commission': d.total_commission, 'Confirmed Paid': d.confirmed_paid, 'Outstanding': d.outstanding,
    }))), 'Pending Commission')
    XLSX.writeFile(wb, 'pending-commission.xlsx')
  }

  if (loading) return (
    <div className="p-4 md:p-8">
      <div className="mb-6 h-8 w-48 skeleton rounded-xl" />
      <div className="space-y-3">{[1, 2, 3].map(i => <SkeletonCard key={i} lines={3} />)}</div>
    </div>
  )

  return (
    <div className="p-4 md:p-8">
      <h1 className="mb-4 text-2xl font-bold text-white">Payments</h1>

      {/* Admin UPI setting */}
      <div className="mb-5 card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Settings size={15} className="text-white/40" />
          <p className="text-sm font-semibold text-white/80">Your UPI ID (shown to DPs for commission payment)</p>
        </div>
        <div className="flex gap-2">
          <input className="input flex-1" value={adminUpi} onChange={e => setAdminUpi(e.target.value)} placeholder="yourname@upi" />
          <button onClick={saveAdminUpi} disabled={savingUpi} className="btn-primary px-4 text-sm">{savingUpi ? 'Saving…' : 'Save'}</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 text-success-600 dark:text-success-400 mb-1">
            <IndianRupee size={15} />
            <span className="text-xs font-semibold">Admin Commission</span>
          </div>
          <p className="text-xl font-bold text-white">{formatCurrency(confirmedCommissionTotal)}</p>
          <p className="text-xs text-white/40">Confirmed receipts only</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 mb-1">
            <IndianRupee size={15} />
            <span className="text-xs font-semibold">DP Earnings</span>
          </div>
          <p className="text-xl font-bold text-white">{formatCurrency(totalDpEarnings)}</p>
        </div>
        {totalOutstanding > 0 && (
          <div className="card p-4 border-2 border-error-300 dark:border-error-700">
            <div className="flex items-center gap-2 text-error-600 dark:text-error-400 mb-1">
              <AlertTriangle size={15} />
              <span className="text-xs font-semibold">Pending from DPs</span>
            </div>
            <p className="text-xl font-bold text-white">{formatCurrency(totalOutstanding)}</p>
            <button onClick={() => setTab('pending')} className="text-xs text-error-600 underline mt-0.5">{dpPending.length} DPs owe</button>
          </div>
        )}
        {pendingReceiptsCount > 0 && (
          <div className="card p-4 border-2 border-warning-300 dark:border-warning-700">
            <div className="flex items-center gap-2 text-warning-600 dark:text-warning-400 mb-1">
              <Clock size={15} />
              <span className="text-xs font-semibold">Pending Receipts</span>
            </div>
            <p className="text-xl font-bold text-white">{pendingReceiptsCount}</p>
            <button onClick={() => setTab('receipts')} className="text-xs text-warning-600 underline mt-0.5">Review now</button>
          </div>
        )}
      </div>

      <div className="mb-5">
        <Tabs
          tabs={[
            { key: 'orders', label: 'Order Commissions' },
            { key: 'dp', label: 'DP Earnings' },
            { key: 'pending', label: 'Pending Commission', count: dpPending.length },
            { key: 'receipts', label: 'Receipts', count: pendingReceiptsCount },
          ]}
          active={tab}
          onChange={(k) => setTab(k as any)}
        />
      </div>

      {/* Order Commissions */}
      {tab === 'orders' && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-white/50">Per-order commission breakdown</p>
            <button onClick={exportOrderCommissions} className="btn-secondary flex items-center gap-1.5 text-sm"><Download size={15} /> Export</button>
          </div>
          {orderCommissions.length === 0 ? (
            <EmptyState icon={<CreditCard size={48} />} title="No completed orders yet" />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                    <th className="px-4 py-3 text-left font-semibold text-white/60">DP</th>
                    <th className="px-4 py-3 text-left font-semibold text-white/60">Order</th>
                    <th className="px-4 py-3 text-right font-semibold text-white/60">Charge</th>
                    <th className="px-4 py-3 text-right font-semibold text-white/60">Admin Commission</th>
                    <th className="px-4 py-3 text-right font-semibold text-white/60">DP Earned</th>
                    <th className="px-4 py-3 text-right font-semibold text-white/60">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {orderCommissions.map(o => (
                    <tr key={o.id} className="glass">
                      <td className="px-4 py-3 font-medium text-white">{o.dp_name}</td>
                      <td className="px-4 py-3 text-white/50 max-w-[120px] truncate">{o.items_summary || 'Delivery'}</td>
                      <td className="px-4 py-3 text-right text-white/80">{formatCurrency(o.delivery_charge)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-success-600 dark:text-success-400">
                        {formatCurrency(o.commission_amount)}
                        <span className="ml-1 text-xs text-white/40">({o.commission_pct}%)</span>
                      </td>
                      <td className="px-4 py-3 text-right text-primary-600 dark:text-primary-400">{formatCurrency(o.dp_earnings)}</td>
                      <td className="px-4 py-3 text-right text-xs text-white/40">{formatTime(o.completed_at || o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* DP Earnings */}
      {tab === 'dp' && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-white/50">Amount each DP earned from users</p>
            <button onClick={exportDpEarnings} className="btn-secondary flex items-center gap-1.5 text-sm"><Download size={15} /> Export</button>
          </div>
          {dpEarnings.length === 0 ? (
            <EmptyState icon={<CreditCard size={48} />} title="No DP earnings yet" />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                    <th className="px-4 py-3 text-left font-semibold text-white/60">Delivery Partner</th>
                    <th className="px-4 py-3 text-right font-semibold text-white/60">Orders</th>
                    <th className="px-4 py-3 text-right font-semibold text-white/60">Total from Users</th>
                    <th className="px-4 py-3 text-right font-semibold text-white/60">DP Kept</th>
                    <th className="px-4 py-3 text-right font-semibold text-white/60">Commission Owed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {dpEarnings.map(d => (
                    <tr key={d.dp_id} className="glass">
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{d.dp_name}</p>
                        {d.dp_phone && <p className="text-xs text-white/40">{d.dp_phone}</p>}
                      </td>
                      <td className="px-4 py-3 text-right text-white/80">{d.orders}</td>
                      <td className="px-4 py-3 text-right text-white/80">{formatCurrency(d.total_charge)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-primary-600 dark:text-primary-400">{formatCurrency(d.total_earned)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-warning-600 dark:text-warning-400">{formatCurrency(d.commission_owed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Pending Commission from DPs */}
      {tab === 'pending' && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-white/50">Commission owed but not yet confirmed as received</p>
            {dpPending.length > 0 && (
              <button onClick={exportPendingCommission} className="btn-secondary flex items-center gap-1.5 text-sm"><Download size={15} /> Export</button>
            )}
          </div>
          {dpPending.length === 0 ? (
            <EmptyState icon={<CheckCircle size={48} />} title="All commissions cleared" description="No outstanding commission from any delivery partner." />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                    <th className="px-4 py-3 text-left font-semibold text-white/60">Delivery Partner</th>
                    <th className="px-4 py-3 text-right font-semibold text-white/60">Orders</th>
                    <th className="px-4 py-3 text-right font-semibold text-white/60">Total Commission</th>
                    <th className="px-4 py-3 text-right font-semibold text-white/60">Confirmed Paid</th>
                    <th className="px-4 py-3 text-right font-semibold text-white/60">Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {dpPending.map(d => (
                    <tr key={d.dp_id} className="glass">
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{d.dp_name}</p>
                        {d.dp_phone && <p className="text-xs text-white/40">{d.dp_phone}</p>}
                      </td>
                      <td className="px-4 py-3 text-right text-white/80">{d.orders}</td>
                      <td className="px-4 py-3 text-right text-white/80">{formatCurrency(d.total_commission)}</td>
                      <td className="px-4 py-3 text-right text-success-600 dark:text-success-400">{formatCurrency(d.confirmed_paid)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-error-50 px-2 py-1 text-sm font-bold text-error-700 dark:bg-error-900/30 dark:text-error-300">
                          <AlertTriangle size={12} /> {formatCurrency(d.outstanding)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Commission Receipts */}
      {tab === 'receipts' && (
        <div>
          <p className="mb-3 text-sm text-white/50">
            DPs submit UPI payment receipts here. Confirm once you have received the payment.
          </p>
          {receipts.length === 0 ? (
            <EmptyState icon={<CreditCard size={48} />} title="No receipts submitted yet" />
          ) : (
            <div className="space-y-3">
              {receipts.map((r, i) => (
                <div key={r.id} className="card p-4 animate-slide-up" style={{ animationDelay: `${i * 30}ms` }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-white">{(r._dp as any)?.full_name || 'Unknown'}</p>
                        <span className={`badge flex items-center gap-1 ${
                          r.status === 'confirmed' ? 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300'
                          : r.status === 'rejected' ? 'bg-error-100 text-error-700 dark:bg-error-900/40 dark:text-error-300'
                          : 'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-300'
                        }`}>
                          {r.status === 'confirmed' ? <CheckCircle size={11} /> : r.status === 'rejected' ? <XCircle size={11} /> : <Clock size={11} />}
                          {r.status === 'confirmed' ? 'Confirmed' : r.status === 'rejected' ? 'Rejected' : 'Pending'}
                        </span>
                      </div>
                      <p className="text-lg font-bold text-white mt-0.5">{formatCurrency(r.amount)}</p>
                      <p className="text-xs text-white/40">UPI Ref: <span className="font-mono">{r.upi_ref}</span></p>
                      <p className="text-xs text-white/40">{formatTime(r.submitted_at)}</p>
                      {r.reject_reason && <p className="text-xs text-error-600 mt-1">Reason: {r.reject_reason}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {r.screenshot_url && (
                        <div className="flex flex-col items-end gap-1.5">
                          <a href={r.screenshot_url} target="_blank" rel="noreferrer">
                            <img
                              src={r.screenshot_url}
                              alt="Payment screenshot"
                              className="w-24 h-24 rounded-xl object-cover border border-white/15 cursor-pointer hover:opacity-90 transition-opacity"
                            />
                          </a>
                          <a href={r.screenshot_url} target="_blank" rel="noreferrer" className="text-xs text-primary-600 dark:text-primary-400 underline">
                            View full
                          </a>
                        </div>
                      )}
                      {r.status === 'submitted' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setRejectId(r.id); setRejectReason('') }}
                            className="rounded-lg border border-error-200 bg-error-50 px-3 py-1.5 text-xs font-semibold text-error-700 dark:border-error-800 dark:bg-error-900/30 dark:text-error-300"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => confirmReceipt(r.id)}
                            className="rounded-lg bg-success-600 px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            Confirm
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reject reason modal */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setRejectId(null)}>
          <div className="card w-full max-w-sm p-5 animate-scale-in" onClick={e => e.stopPropagation()}>
            <h3 className="mb-3 text-base font-bold text-white">Reject Receipt</h3>
            <label className="label">Reason (optional)</label>
            <input className="input" value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="e.g. Amount mismatch, wrong reference" />
            <div className="mt-4 flex gap-2">
              <button onClick={() => setRejectId(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => rejectReceipt(rejectId)} className="btn-danger flex-1">Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
