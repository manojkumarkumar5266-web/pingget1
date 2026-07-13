import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context'
import { supabase, Order, DpCommissionReceipt } from '../../lib/supabase'
import { EmptyState } from '../../components/ui'
import { formatCurrency, formatTime } from '../../lib/utils'
import {
  Wallet as WalletIcon, TrendingUp, AlertCircle, IndianRupee,
  Receipt, Copy, CheckCircle, Clock, XCircle, Upload, Camera, X,
} from 'lucide-react'

export default function DpWallet() {
  const { profile } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [receipts, setReceipts] = useState<DpCommissionReceipt[]>([])
  const [adminUpi, setAdminUpi] = useState('')
  const [loading, setLoading] = useState(true)
  const [showPay, setShowPay] = useState(false)

  const totalEarnings = orders.reduce((s, o) => s + Number(o.dp_earnings || 0), 0)
  const totalCommission = orders.reduce((s, o) => s + Number(o.commission_amount || 0), 0)
  const totalConfirmed = receipts.filter(r => r.status === 'confirmed').reduce((s, r) => s + Number(r.amount || 0), 0)
  const outstanding = Math.max(0, totalCommission - totalConfirmed)
  const hasPendingReceipt = receipts.some(r => r.status === 'submitted')

  useEffect(() => {
    const fetchAll = async () => {
      const [ordersRes, receiptsRes, settingsRes] = await Promise.all([
        supabase.from('orders').select('*').eq('dp_id', profile!.id).eq('status', 'completed').order('created_at', { ascending: false }),
        supabase.from('dp_commission_receipts').select('*').eq('dp_user_id', profile!.id).order('submitted_at', { ascending: false }),
        supabase.from('app_settings').select('value').eq('key', 'admin_upi_id').maybeSingle(),
      ])
      setOrders((ordersRes.data as Order[]) || [])
      setReceipts((receiptsRes.data as DpCommissionReceipt[]) || [])
      setAdminUpi(settingsRes.data?.value || 'Contact admin')
      setLoading(false)
    }
    fetchAll()
  }, [profile])

  const submitReceipt = async (amount: number, upiRef: string, screenshotFile: File) => {
    let screenshotUrl: string | null = null
    const path = `${profile!.id}/commission-${Date.now()}`
    const { error: upErr } = await supabase.storage.from('media').upload(path, screenshotFile, { upsert: true })
    if (!upErr) screenshotUrl = supabase.storage.from('media').getPublicUrl(path).data.publicUrl

    const { data, error } = await supabase
      .from('dp_commission_receipts')
      .insert({ dp_user_id: profile!.id, amount, upi_ref: upiRef, screenshot_url: screenshotUrl })
      .select().single()
    if (error) { alert(error.message); return }
    setReceipts(prev => [data as DpCommissionReceipt, ...prev])
    setShowPay(false)
  }

  if (loading) return <div className="p-4 text-center text-sm text-gray-400">Loading wallet...</div>

  return (
    <div className="mx-auto max-w-md px-4 py-4">
      <h1 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">Wallet</h1>

      {outstanding > 0 ? (
        <div className="mb-4 overflow-hidden rounded-2xl bg-gradient-to-br from-warning-500 to-warning-600 p-5 text-white shadow-lg animate-slide-up">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-warning-100">Commission Due to Admin</p>
              <p className="mt-1 text-3xl font-bold">{formatCurrency(outstanding)}</p>
            </div>
            <AlertCircle size={32} className="text-warning-200" />
          </div>
          <div className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-xs text-warning-100">
            Pay via UPI to admin: <span className="font-bold text-white">{adminUpi}</span>
            <button onClick={() => navigator.clipboard.writeText(adminUpi)} className="ml-2 underline">Copy</button>
          </div>
          {hasPendingReceipt ? (
            <div className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white/40 py-2.5 text-sm font-semibold text-warning-400 cursor-not-allowed select-none">
              <Clock size={15} /> Receipt Submitted — Pending Confirmation
            </div>
          ) : (
            <button onClick={() => setShowPay(true)} className="mt-3 w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-warning-700 transition-transform active:scale-95">
              Submit Payment Receipt
            </button>
          )}
        </div>
      ) : (
        <div className="mb-4 overflow-hidden rounded-2xl bg-gradient-to-br from-success-600 to-success-700 p-5 text-white shadow-lg animate-slide-up">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-success-100">Commission Status</p>
              <p className="mt-1 text-xl font-bold">All paid up!</p>
            </div>
            <CheckCircle size={32} className="text-success-200" />
          </div>
          <p className="mt-2 text-xs text-success-100">No outstanding commission. You can go online and accept orders.</p>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 text-success-600 dark:text-success-400 mb-1">
            <TrendingUp size={16} />
            <span className="text-xs font-medium">Total Earned</span>
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(totalEarnings)}</p>
          <p className="text-xs text-gray-400">{orders.length} deliveries</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-error-600 dark:text-error-400 mb-1">
            <IndianRupee size={16} />
            <span className="text-xs font-medium">Commission</span>
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(totalCommission)}</p>
          <p className="text-xs text-gray-400">{formatCurrency(totalConfirmed)} confirmed paid</p>
        </div>
      </div>

      <div className="mb-4 card p-3 flex items-center gap-3">
        <div className="flex-1">
          <p className="text-xs text-gray-500">Admin UPI (for commission payment)</p>
          <p className="text-sm font-bold text-gray-900 dark:text-white">{adminUpi}</p>
        </div>
        <button onClick={() => navigator.clipboard.writeText(adminUpi)} className="btn-ghost p-2 text-gray-400" title="Copy UPI ID">
          <Copy size={16} />
        </button>
      </div>

      <h3 className="mb-2 text-sm font-bold text-gray-900 dark:text-white">Commission Receipts</h3>
      {receipts.length === 0 ? (
        <EmptyState icon={<Receipt size={36} />} title="No receipts yet" description="After paying admin via UPI, submit your receipt here for confirmation." />
      ) : (
        <div className="space-y-2 mb-4">
          {receipts.map(r => (
            <div key={r.id} className="card p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(r.amount)}</p>
                  <p className="text-xs text-gray-400">UPI Ref: {r.upi_ref} · {formatTime(r.submitted_at)}</p>
                  {r.reject_reason && <p className="text-xs text-error-600 dark:text-error-400 mt-0.5">Rejected: {r.reject_reason}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {r.screenshot_url && (
                    <a href={r.screenshot_url} target="_blank" rel="noreferrer">
                      <img src={r.screenshot_url} alt="Receipt" className="h-12 w-12 rounded-lg object-cover border border-gray-200 dark:border-gray-700" />
                    </a>
                  )}
                  <span className={`badge flex items-center gap-1 ${
                    r.status === 'confirmed' ? 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300'
                    : r.status === 'rejected' ? 'bg-error-100 text-error-700 dark:bg-error-900/40 dark:text-error-300'
                    : 'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-300'
                  }`}>
                    {r.status === 'confirmed' ? <CheckCircle size={11} /> : r.status === 'rejected' ? <XCircle size={11} /> : <Clock size={11} />}
                    {r.status === 'confirmed' ? 'Confirmed' : r.status === 'rejected' ? 'Rejected' : 'Pending'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 className="mb-2 mt-2 text-sm font-bold text-gray-900 dark:text-white">Recent Deliveries</h3>
      {orders.length === 0 ? (
        <p className="text-sm text-gray-400">No completed deliveries yet.</p>
      ) : (
        <div className="space-y-2">
          {orders.slice(0, 10).map(o => (
            <div key={o.id} className="card flex items-center justify-between p-3">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{o.items_summary || 'Delivery'}</p>
                <p className="text-xs text-gray-400">{formatTime(o.created_at)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-success-600 dark:text-success-400">+{formatCurrency(o.dp_earnings)}</p>
                <p className="text-xs text-gray-400">-{formatCurrency(o.commission_amount)} comm.</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showPay && (
        <SubmitReceiptModal
          onClose={() => setShowPay(false)}
          onSubmit={submitReceipt}
          due={outstanding}
          adminUpi={adminUpi}
        />
      )}
    </div>
  )
}

function SubmitReceiptModal({
  onClose, onSubmit, due, adminUpi,
}: {
  onClose: () => void
  onSubmit: (amount: number, upiRef: string, screenshot: File) => Promise<void>
  due: number
  adminUpi: string
}) {
  const [amount, setAmount] = useState(due.toString())
  const [upiRef, setUpiRef] = useState('')
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setScreenshot(file)
    setScreenshotPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async () => {
    if (!upiRef.trim()) { alert('Please enter your UPI transaction reference number'); return }
    if (!screenshot) { alert('Payment screenshot is required. Please upload a screenshot of your UPI payment.'); return }
    setSubmitting(true)
    await onSubmit(parseFloat(amount) || 0, upiRef.trim(), screenshot)
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 animate-fade-in" onClick={onClose}>
      <div className="card w-full max-w-md max-h-[90vh] overflow-y-auto p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
        <h3 className="mb-1 text-lg font-bold text-gray-900 dark:text-white">Submit Commission Payment</h3>
        <p className="mb-4 text-xs text-gray-500">Pay admin via UPI first, then enter your transaction reference and upload screenshot</p>

        <div className="mb-4 rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
          <p className="text-xs text-gray-500 mb-0.5">Pay to Admin UPI</p>
          <div className="flex items-center gap-2">
            <p className="flex-1 text-sm font-bold text-gray-900 dark:text-white">{adminUpi}</p>
            <button onClick={() => navigator.clipboard.writeText(adminUpi)} className="btn-ghost p-1">
              <Copy size={14} className="text-gray-400" />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label flex items-center gap-1"><IndianRupee size={13} /> Amount</label>
            <input type="number" className="input" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="label">UPI Transaction Reference *</label>
            <input className="input" value={upiRef} onChange={e => setUpiRef(e.target.value)} placeholder="e.g. 407123456789" />
          </div>
          <div>
            <label className="label">Payment Screenshot * (mandatory)</label>
            <input ref={fileRef} type="file" className="hidden" accept="image/*" onChange={handleFileSelect} />
            {screenshotPreview ? (
              <div className="relative">
                <img src={screenshotPreview} alt="Screenshot" className="h-40 w-full rounded-xl object-cover" />
                <button type="button" onClick={() => { setScreenshot(null); setScreenshotPreview(null) }} className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white"><X size={14} /></button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-6 text-sm text-gray-500 dark:border-gray-700">
                <Camera size={18} /> Upload Payment Screenshot (Required)
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting || !screenshot} className="btn-primary flex-1">
            {submitting ? 'Submitting…' : 'Submit Receipt'}
          </button>
        </div>
      </div>
    </div>
  )
}
