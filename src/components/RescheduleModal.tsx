import { useState, useEffect } from 'react'
import { supabase, type AdvanceSettings } from '../lib/supabase'
import PremiumCalendar from './PremiumCalendar'
import { X, CalendarClock, Repeat, AlertCircle } from 'lucide-react'

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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
        <div className="max-w-md rounded-3xl p-6 text-center" style={{ background: '#181818', border: '1px solid rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
          <AlertCircle size={32} className="mx-auto mb-3 text-yellow-400" />
          <p className="text-sm font-semibold text-white mb-1">Cannot Reschedule</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Rescheduling is only available before a delivery partner accepts your request.</p>
          <button onClick={onClose} className="mt-4 rounded-2xl px-6 py-2.5 text-sm font-bold" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}>Close</button>
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
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl overflow-hidden animate-slide-up" style={{ background: '#181818', border: '1px solid rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 sticky top-0 z-10" style={{ background: '#181818', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-2">
              <CalendarClock size={20} style={{ color: '#A6B300' }} />
              <h2 className="text-base font-bold text-white">Reschedule Request</h2>
            </div>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <X size={16} style={{ color: 'rgba(255,255,255,0.5)' }} />
            </button>
          </div>

          <div className="px-5 py-5 space-y-4">
            {/* Current schedule */}
            <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Current Schedule</p>
              <p className="text-sm font-semibold text-white">{request.scheduled_date} at {request.scheduled_slot || request.scheduled_time}</p>
            </div>

            {/* New date */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#C4D600' }}>New Date</p>
              <PremiumCalendar selectedDate={newDate} onSelect={setNewDate} maxDays={maxDays} />
            </div>

            {/* New time slot */}
            {newDate && timeSlots.length > 0 && (
              <div className="animate-slide-up">
                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#C4D600' }}>New Time Slot</p>
                <div className="grid grid-cols-2 gap-2">
                  {timeSlots.map(slot => (
                    <button key={slot.key} onClick={() => setNewSlot(slot.key)}
                      className="rounded-2xl py-3 text-sm font-semibold transition-all active:scale-95"
                      style={newSlot === slot.key
                        ? { background: '#A6B300', color: '#0B0B0B' }
                        : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}>
                      {slot.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Updated task details */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#C4D600' }}>Update Task Details (optional)</p>
              <textarea className="input min-h-[80px] resize-none text-sm" value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Task description..." />
            </div>

            {/* Updated shop */}
            <div>
              <label className="label">Shop Name (optional)</label>
              <input className="input" value={newShopName} onChange={e => setNewShopName(e.target.value)} placeholder="Shop name" />
            </div>

            {/* Reason */}
            <div>
              <label className="label">Reason for rescheduling</label>
              <textarea className="input min-h-[60px] resize-none text-sm" value={reason} onChange={e => setReason(e.target.value)} placeholder="Why are you rescheduling?" />
            </div>

            {/* Buttons */}
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 rounded-2xl py-3.5 text-sm font-bold transition-all active:scale-95" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}>Cancel</button>
              <button onClick={handleConfirm} disabled={!newDate || !newSlot || loading}
                className="flex-1 rounded-2xl py-3.5 text-sm font-bold transition-all active:scale-95 disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #A6B300, #808000)', color: '#0B0B0B' }}>
                {loading ? 'Rescheduling...' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
