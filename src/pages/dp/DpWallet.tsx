import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context'
import { supabase, Order, DpCommissionReceipt } from '../../lib/supabase'
import { SkeletonList } from '../../components/ui'
import { formatCurrency, formatTime } from '../../lib/utils'
import { Screen, PageTitle, Surface, CTA, Chip, SectionLabel, EmptyBlock, IconButton } from '../../design/primitives'
import { pg } from '../../design/tokens'
import {
  Wallet as WalletIcon, TrendingUp, AlertCircle, IndianRupee,
  Receipt, Copy, CheckCircle, Clock, XCircle, Camera, X,
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
        supabase.from('orders').select('*').eq('dp_id', profile!.id).neq('status', 'cancelled').order('created_at', { ascending: false }),
        supabase.from('dp_commission_receipts').select('*').eq('dp_user_id', profile!.id).order('submitted_at', { ascending: false }),
        supabase.from('app_settings').select('value').eq('key', 'admin_upi_id').maybeSingle(),
      ])
      setOrders((ordersRes.data as Order[]) || [])
      setReceipts((receiptsRes.data as DpCommissionReceipt[]) || [])
      setAdminUpi(settingsRes.data?.value || 'Contact admin')
      setLoading(false)
    }
    fetchAll()

    const channel = supabase.channel(`dp-wallet-${profile!.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'dp_commission_receipts',
        filter: `dp_user_id=eq.${profile!.id}`,
      }, () => fetchAll())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
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

  if (loading) {
    return (
      <Screen className="mx-auto max-w-lg">
        <SkeletonList count={3} lines={3} />
      </Screen>
    )
  }

  return (
    <Screen className="mx-auto max-w-lg animate-fade-in-up">
      <PageTitle eyebrow="Partner" title="Wallet" />

      {outstanding > 0 ? (
        <Surface accent className="mb-5 overflow-hidden p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: '#FCD34D' }}>
                Commission due to admin
              </p>
              <p className="mt-1 text-[34px] font-extrabold leading-none tracking-tight">{formatCurrency(outstanding)}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'rgba(245,165,36,0.16)' }}>
              <AlertCircle size={24} className="text-amber-300" />
            </div>
          </div>
          <div
            className="mt-4 flex items-center justify-between gap-2 rounded-2xl px-3.5 py-2.5 text-xs"
            style={{ background: pg.bgElevated, border: `1px solid ${pg.line}` }}
          >
            <span style={{ color: pg.text3 }}>
              Pay via UPI: <span className="font-extrabold text-[#F5F7F6]">{adminUpi}</span>
            </span>
            <button type="button" onClick={() => navigator.clipboard.writeText(adminUpi)} className="font-extrabold" style={{ color: pg.lime }}>
              Copy
            </button>
          </div>
          {hasPendingReceipt ? (
            <div
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-extrabold"
              style={{ background: 'rgba(245,165,36,0.14)', color: '#FCD34D', border: '1px solid rgba(245,165,36,0.25)' }}
            >
              <Clock size={15} /> Receipt submitted — pending confirmation
            </div>
          ) : (
            <CTA className="mt-3 w-full" onClick={() => setShowPay(true)}>
              Submit payment receipt
            </CTA>
          )}
        </Surface>
      ) : (
        <Surface className="mb-5 p-5" style={{ borderColor: 'rgba(34,197,94,0.28)' }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: '#86EFAC' }}>
                Commission status
              </p>
              <p className="mt-1 text-2xl font-extrabold tracking-tight">All paid up!</p>
              <p className="mt-1.5 text-xs" style={{ color: pg.text3 }}>
                Commission from yesterday and earlier is due now (after 12 AM). Today’s commission is paid tomorrow before you go online.
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'rgba(34,197,94,0.14)' }}>
              <CheckCircle size={24} className="text-green-400" />
            </div>
          </div>
        </Surface>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3">
        <Surface className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'rgba(34,197,94,0.14)' }}>
              <TrendingUp size={16} className="text-green-400" />
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-wide" style={{ color: pg.text4 }}>Total earned</span>
          </div>
          <p className="text-xl font-extrabold">{formatCurrency(totalEarnings)}</p>
          <p className="mt-0.5 text-xs" style={{ color: pg.text4 }}>{orders.length} deliveries</p>
        </Surface>
        <Surface className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'rgba(255,77,79,0.12)' }}>
              <IndianRupee size={16} className="text-red-400" />
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-wide" style={{ color: pg.text4 }}>Commission</span>
          </div>
          <p className="text-xl font-extrabold">{formatCurrency(totalCommission)}</p>
          <p className="mt-0.5 text-xs" style={{ color: pg.text4 }}>{formatCurrency(totalConfirmed)} confirmed paid</p>
        </Surface>
      </div>

      <Surface className="mb-6 flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: pg.limeDim }}>
          <WalletIcon size={18} style={{ color: pg.lime }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-wide" style={{ color: pg.text4 }}>Admin UPI</p>
          <p className="truncate text-sm font-extrabold">{adminUpi}</p>
        </div>
        <IconButton onClick={() => navigator.clipboard.writeText(adminUpi)} aria-label="Copy UPI">
          <Copy size={16} />
        </IconButton>
      </Surface>

      <SectionLabel title="Commission receipts" />
      {receipts.length === 0 ? (
        <EmptyBlock
          title="No receipts yet"
          body="After paying admin via UPI, submit your receipt here for confirmation."
        />
      ) : (
        <div className="mb-6 space-y-2">
          {receipts.map(r => (
            <Surface key={r.id} className="p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold">{formatCurrency(r.amount)}</p>
                  <p className="text-xs" style={{ color: pg.text4 }}>UPI ref: {r.upi_ref} · {formatTime(r.submitted_at)}</p>
                  {r.reject_reason && (
                    <p className="mt-0.5 text-xs text-red-400">Rejected: {r.reject_reason}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {r.screenshot_url && (
                    <a href={r.screenshot_url} target="_blank" rel="noreferrer">
                      <img src={r.screenshot_url} alt="Receipt" className="h-12 w-12 rounded-xl object-cover" style={{ border: `1px solid ${pg.line}` }} />
                    </a>
                  )}
                  <Chip tone={r.status === 'confirmed' ? 'success' : r.status === 'rejected' ? 'danger' : 'warn'}>
                    {r.status === 'confirmed' ? 'Confirmed' : r.status === 'rejected' ? 'Rejected' : 'Pending'}
                  </Chip>
                </div>
              </div>
            </Surface>
          ))}
        </div>
      )}

      <SectionLabel title="Recent deliveries" />
      {orders.length === 0 ? (
        <p className="text-sm" style={{ color: pg.text4 }}>No completed deliveries yet.</p>
      ) : (
        <div className="space-y-2 pb-4">
          {orders.slice(0, 10).map(o => (
            <Surface key={o.id} className="flex items-center justify-between p-3.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold">{o.items_summary || 'Delivery'}</p>
                <p className="text-xs" style={{ color: pg.text4 }}>{formatTime(o.created_at)}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-extrabold text-green-400">+{formatCurrency(o.dp_earnings)}</p>
                <p className="text-xs" style={{ color: pg.text4 }}>-{formatCurrency(o.commission_amount)} comm.</p>
              </div>
            </Surface>
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
    </Screen>
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
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#000000]/65 p-4" onClick={onClose}>
      <div className="w-full max-w-md" onClick={e => e.stopPropagation()}>
      <Surface
        className="max-h-[85vh] overflow-y-auto p-6"
        style={{ borderRadius: pg.radius.xl }}
      >
        <h3 className="text-lg font-extrabold tracking-tight">Submit commission payment</h3>
        <p className="mb-5 mt-1 text-xs" style={{ color: pg.text3 }}>
          Pay admin via UPI first, then enter your transaction reference and upload screenshot
        </p>

        <Surface className="mb-4 p-3.5" style={{ background: pg.bgElevated }}>
          <p className="mb-1 text-[10px] font-extrabold uppercase tracking-wide" style={{ color: pg.text4 }}>Pay to admin UPI</p>
          <div className="flex items-center gap-2">
            <p className="flex-1 text-sm font-extrabold">{adminUpi}</p>
            <IconButton onClick={() => navigator.clipboard.writeText(adminUpi)} aria-label="Copy">
              <Copy size={14} />
            </IconButton>
          </div>
        </Surface>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 flex items-center gap-1 text-xs font-extrabold uppercase tracking-wide" style={{ color: pg.text3 }}>
              <IndianRupee size={13} /> Amount
            </label>
            <input
              type="number"
              className="w-full rounded-2xl px-4 py-3 text-sm font-medium outline-none"
              style={{ background: pg.surface2, border: `1px solid ${pg.line}`, color: pg.text }}
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide" style={{ color: pg.text3 }}>
              UPI transaction reference *
            </label>
            <input
              className="w-full rounded-2xl px-4 py-3 text-sm font-medium outline-none"
              style={{ background: pg.surface2, border: `1px solid ${pg.line}`, color: pg.text }}
              value={upiRef}
              onChange={e => setUpiRef(e.target.value)}
              placeholder="e.g. 407123456789"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide" style={{ color: pg.text3 }}>
              Payment screenshot * (mandatory)
            </label>
            <input ref={fileRef} type="file" className="hidden" accept="image/*" onChange={handleFileSelect} />
            {screenshotPreview ? (
              <div className="relative">
                <img src={screenshotPreview} alt="Screenshot" className="h-40 w-full rounded-2xl object-cover" />
                <button
                  type="button"
                  onClick={() => { setScreenshot(null); setScreenshotPreview(null) }}
                  className="absolute right-2 top-2 rounded-full bg-[#000000]/70 p-1.5 text-[#F5F7F6]"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-8 text-sm font-extrabold transition active:scale-[0.99]"
                style={{ borderColor: 'rgba(196,214,0,0.3)', color: pg.text3 }}
              >
                <Camera size={18} /> Upload payment screenshot (required)
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <CTA variant="secondary" className="flex-1" onClick={onClose}>Cancel</CTA>
          <CTA className="flex-1" onClick={handleSubmit} disabled={submitting || !screenshot}>
            {submitting ? 'Submitting…' : 'Submit receipt'}
          </CTA>
        </div>
      </Surface>
      </div>
    </div>
  )
}
