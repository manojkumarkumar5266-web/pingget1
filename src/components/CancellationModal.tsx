import { useState } from 'react'
import { AlertTriangle, X, Check, IndianRupee } from 'lucide-react'

type Props = {
  open: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
  status: string
  fee: number
  freeBeforeAccept: boolean
  adminOverride: boolean
  cutoffMinutes: number
}

export default function CancellationModal({
  open, onClose, onConfirm, status, fee, freeBeforeAccept, adminOverride, cutoffMinutes,
}: Props) {
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)

  if (!open) return null

  const hasFee = !freeBeforeAccept || ['accepted', 'confirmed', 'shopping', 'purchased', 'on_the_way', 'arrived'].includes(status)
  const actualFee = hasFee ? fee : 0

  const handleConfirm = () => {
    if (!reason.trim()) return
    setConfirming(true)
    onConfirm(reason.trim())
  }

  const reasons = [
    'Changed my mind',
    'No longer needed',
    'Found another option',
    'Schedule conflict',
    'Wrong details entered',
    'Other',
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden animate-slide-up"
        style={{ background: '#181818', border: '1px solid rgba(255,255,255,0.1)' }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} style={{ color: '#f87171' }} />
            <h2 className="text-base font-bold text-white">Cancel Request</h2>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <X size={16} style={{ color: 'rgba(255,255,255,0.5)' }} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* Policy */}
          <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#C4D600' }}>Cancellation Policy</p>
            <div className="space-y-2 text-sm">
              {freeBeforeAccept && (
                <div className="flex items-start gap-2">
                  <Check size={14} className="mt-0.5 shrink-0 text-green-400" />
                  <span style={{ color: 'rgba(255,255,255,0.7)' }}>Free cancellation before a delivery partner accepts.</span>
                </div>
              )}
              <div className="flex items-start gap-2">
                <IndianRupee size={14} className="mt-0.5 shrink-0" style={{ color: actualFee > 0 ? '#f87171' : '#34d399' }} />
                <span style={{ color: 'rgba(255,255,255,0.7)' }}>
                  {actualFee > 0
                    ? `Cancellation fee of ₹${actualFee} applies after a partner has accepted.`
                    : 'No cancellation fee at this stage.'}
                </span>
              </div>
              {cutoffMinutes > 0 && (
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-yellow-400" />
                  <span style={{ color: 'rgba(255,255,255,0.7)' }}>
                    Free up to {cutoffMinutes} minutes before scheduled time.
                  </span>
                </div>
              )}
              {adminOverride && (
                <div className="flex items-start gap-2">
                  <Check size={14} className="mt-0.5 shrink-0" style={{ color: '#A6B300' }} />
                  <span style={{ color: 'rgba(255,255,255,0.7)' }}>Admin can override this policy at any time.</span>
                </div>
              )}
            </div>
          </div>

          {/* Fee display */}
          {actualFee > 0 && (
            <div className="flex items-center justify-between rounded-2xl p-4"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>Cancellation Fee</span>
              <span className="text-lg font-bold" style={{ color: '#f87171' }}>₹{actualFee}</span>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="label mb-2">Reason for cancellation <span style={{ color: '#f87171' }}>*</span></label>
            <div className="flex flex-wrap gap-2 mb-2">
              {reasons.map(r => (
                <button key={r} onClick={() => setReason(r)}
                  className="rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-95"
                  style={reason === r
                    ? { background: '#A6B300', color: '#0B0B0B' }
                    : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {r}
                </button>
              ))}
            </div>
            <textarea className="input min-h-[80px] resize-none text-sm"
              value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Please tell us why you're cancelling (required)..." />
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex-1 rounded-2xl py-3.5 text-sm font-bold transition-all active:scale-95"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}>
              Keep Request
            </button>
            <button onClick={handleConfirm} disabled={!reason.trim() || confirming}
              className="flex-1 rounded-2xl py-3.5 text-sm font-bold transition-all active:scale-95 disabled:opacity-40"
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
              {confirming ? 'Cancelling...' : 'Confirm Cancel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
