import { useState, useEffect } from 'react'
import { supabase, type AdvanceSettings } from '../lib/supabase'
import PremiumCalendar from './PremiumCalendar'
import { X, CalendarClock, AlertCircle } from 'lucide-react'
import { pg } from '../design/tokens'
import { CTA, IconButton, Surface, SectionLabel } from '../design/primitives'

type Props = {
  open: boolean
  onClose: () => void
  onConfirm: (newDate: Date, newSlot: string, newDescription: string, newShopName: string, reason: string) => void
  request: any
  settings: AdvanceSettings | null
  timeSlots: { key: string; label: string; start: string; end: string }[]
  actorType: 'customer' | 'admin'
}

export default function RescheduleModal({ open, onClose, onConfirm, request, settings, timeSlots, actorType }: Props) {
  const [newDate, setNewDate] = useState<Date | null>(null)
  const [newSlot, setNewSlot] = useState<string | null>(null)
  const [newDescription, setNewDescription] = useState('')
  const [newShopName, setNewShopName] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && request) {
      setNewDescription(request.description || '')
      setNewShopName(request.shop_name || request.preferred_shop || '')
    }
  }, [open, request])

  if (!open) return null

  const maxDays = settings?.max_advance_days ?? 7
  const canReschedule = actorType === 'admin' || !request.accepted_dp_id

  if (!canReschedule) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(12px)' }}
        onClick={onClose}
      >
        <div className="max-w-md" onClick={e => e.stopPropagation()}>
          <Surface className="p-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'rgba(245,165,36,0.15)' }}>
            <AlertCircle size={28} style={{ color: pg.warning }} />
          </div>
          <p className="mb-1 text-base font-extrabold">Cannot Reschedule</p>
          <p className="text-xs" style={{ color: pg.text3 }}>Rescheduling is only available before a delivery partner accepts your request.</p>
          <CTA variant="secondary" onClick={onClose} className="mt-5 w-full">Close</CTA>
          </Surface>
        </div>
      </div>
    )
  }

  const handleConfirm = async () => {
    if (!newDate || !newSlot) return
    setLoading(true)
    onConfirm(newDate, newSlot, newDescription, newShopName, reason)
    setLoading(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="w-full max-w-md overflow-hidden animate-slide-up rounded-[28px]"
          style={{ background: pg.surface, color: pg.ink, border: `1px solid ${pg.lineStrong}` }}
          onClick={e => e.stopPropagation()}
        >
          <div
            className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4"
            style={{ background: pg.surface, color: pg.ink, borderBottom: `1px solid ${pg.line}` }}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: pg.limeDim }}>
                <CalendarClock size={18} style={{ color: pg.lime }} />
              </div>
              <h2 className="text-[17px] font-extrabold tracking-tight">Reschedule Request</h2>
            </div>
            <IconButton onClick={onClose} className="!h-9 !w-9 !rounded-xl">
              <X size={16} />
            </IconButton>
          </div>

          <div className="space-y-4 px-5 py-5">
            <Surface className="p-3.5" style={{ background: pg.bgElevated }}>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: pg.text3 }}>Current Schedule</p>
              <p className="mt-0.5 text-sm font-extrabold">{request.scheduled_date} at {request.scheduled_slot || request.scheduled_time}</p>
            </Surface>

            <div>
              <SectionLabel title="New Date" />
              <PremiumCalendar selectedDate={newDate} onSelect={setNewDate} maxDays={maxDays} />
            </div>

            {newDate && timeSlots.length > 0 && (
              <div className="animate-slide-up">
                <SectionLabel title="New Time Slot" />
                <div className="grid grid-cols-2 gap-2">
                  {timeSlots.map(slot => (
                    <button
                      key={slot.key}
                      type="button"
                      onClick={() => setNewSlot(slot.key)}
                      className="rounded-2xl py-3 text-sm font-extrabold transition-all active:scale-95"
                      style={newSlot === slot.key
                        ? { background: pg.lime, color: pg.limeText, boxShadow: '0 4px 16px rgba(196,214,0,0.28)' }
                        : { background: pg.surface2, border: `1px solid ${pg.line}`, color: pg.text2 }}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <SectionLabel title="Update Task Details (optional)" />
              <textarea className="input min-h-[80px] resize-none text-sm" value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Task description..." />
            </div>

            <div>
              <label className="label">Shop Name (optional)</label>
              <input className="input" value={newShopName} onChange={e => setNewShopName(e.target.value)} placeholder="Shop name" />
            </div>

            <div>
              <label className="label">Reason for rescheduling</label>
              <textarea className="input min-h-[60px] resize-none text-sm" value={reason} onChange={e => setReason(e.target.value)} placeholder="Why are you rescheduling?" />
            </div>

            <div className="flex gap-2">
              <CTA variant="secondary" onClick={onClose} className="flex-1">Cancel</CTA>
              <CTA onClick={handleConfirm} disabled={!newDate || !newSlot || loading} className="flex-1">
                {loading ? 'Rescheduling...' : 'Confirm Reschedule'}
              </CTA>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
