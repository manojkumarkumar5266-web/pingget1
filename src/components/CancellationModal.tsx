import { useState } from 'react'
import { AlertTriangle, X, Check, IndianRupee } from 'lucide-react'
import { pg } from '../design/tokens'
import { CTA, IconButton, Surface } from '../design/primitives'
import { Chip } from './ui'

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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden animate-slide-up rounded-t-[28px] sm:rounded-[28px]"
        style={{ background: pg.surface, color: pg.ink, border: `1px solid ${pg.lineStrong}` }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${pg.line}` }}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: 'rgba(255,77,79,0.12)' }}>
              <AlertTriangle size={18} style={{ color: pg.danger }} />
            </div>
            <h2 className="text-[17px] font-extrabold tracking-tight">Cancel Request</h2>
          </div>
          <IconButton onClick={onClose} className="!h-9 !w-9 !rounded-xl">
            <X size={16} />
          </IconButton>
        </div>

        <div className="space-y-4 px-5 py-5">
          <Surface className="p-4" style={{ background: pg.bgElevated }}>
            <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: pg.lime }}>Cancellation Policy</p>
            <div className="space-y-2.5 text-sm">
              {freeBeforeAccept && (
                <div className="flex items-start gap-2">
                  <Check size={14} className="mt-0.5 shrink-0" style={{ color: pg.success }} />
                  <span style={{ color: pg.text2 }}>Free cancellation before a delivery partner accepts.</span>
                </div>
              )}
              <div className="flex items-start gap-2">
                <IndianRupee size={14} className="mt-0.5 shrink-0" style={{ color: actualFee > 0 ? pg.danger : pg.success }} />
                <span style={{ color: pg.text2 }}>
                  {actualFee > 0
                    ? `Cancellation fee of ₹${actualFee} applies after a partner has accepted.`
                    : 'No cancellation fee at this stage.'}
                </span>
              </div>
              {cutoffMinutes > 0 && (
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: pg.warning }} />
                  <span style={{ color: pg.text2 }}>
                    Free up to {cutoffMinutes} minutes before scheduled time.
                  </span>
                </div>
              )}
              {adminOverride && (
                <div className="flex items-start gap-2">
                  <Check size={14} className="mt-0.5 shrink-0" style={{ color: pg.lime }} />
                  <span style={{ color: pg.text2 }}>Admin can override this policy at any time.</span>
                </div>
              )}
            </div>
          </Surface>

          {actualFee > 0 && (
            <Surface className="flex items-center justify-between p-4" style={{ borderColor: 'rgba(255,77,79,0.28)', background: 'rgba(255,77,79,0.08)' }}>
              <span className="text-sm font-bold" style={{ color: pg.text2 }}>Cancellation Fee</span>
              <span className="text-lg font-extrabold" style={{ color: pg.danger }}>₹{actualFee}</span>
            </Surface>
          )}

          <div>
            <label className="label mb-2">
              Reason for cancellation <span style={{ color: pg.danger }}>*</span>
            </label>
            <div className="mb-3 flex flex-wrap gap-2">
              {reasons.map(r => (
                <Chip key={r} label={r} active={reason === r} onClick={() => setReason(r)} />
              ))}
            </div>
            <textarea
              className="input min-h-[80px] resize-none text-sm"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Please tell us why you're cancelling (required)..."
            />
          </div>

          <div className="flex gap-2">
            <CTA variant="secondary" onClick={onClose} className="flex-1">
              Keep Request
            </CTA>
            <CTA
              variant="danger"
              onClick={handleConfirm}
              disabled={!reason.trim() || confirming}
              className="flex-1"
            >
              {confirming ? 'Cancelling...' : 'Confirm Cancel'}
            </CTA>
          </div>
        </div>
      </div>
    </div>
  )
}
