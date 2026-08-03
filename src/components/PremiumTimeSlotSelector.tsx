import { useState, useEffect } from 'react'
import { Clock, Check, Lock, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Slot = { key: string; label: string; start: string; end: string }

type Props = {
  slots: Slot[]
  selectedSlot: string | null
  onSelect: (key: string) => void
  selectedDate: Date | null
  nightStart: string
  nightEnd: string
  peakStart: string
  peakEnd: string
  bufferMinutes?: number
}

function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function isNightTime(slotStart: string, nightStart: string, nightEnd: string): boolean {
  const s = parseTimeToMinutes(slotStart)
  const ns = parseTimeToMinutes(nightStart)
  const ne = parseTimeToMinutes(nightEnd)
  if (ns < ne) return s >= ns && s < ne
  return s >= ns || s < ne
}

function isPeakTime(slotStart: string, peakStart: string, peakEnd: string): boolean {
  const s = parseTimeToMinutes(slotStart)
  const ps = parseTimeToMinutes(peakStart)
  const pe = parseTimeToMinutes(peakEnd)
  if (ps < pe) return s >= ps && s < pe
  return s >= ps || s < pe
}

function isWeekend(date: Date | null): boolean {
  if (!date) return false
  const day = date.getDay()
  return day === 0 || day === 6
}

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isToday(date: Date | null): boolean {
  if (!date) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return today.getTime() === d.getTime()
}

function isSlotInPast(slotStart: string, date: Date | null, bufferMinutes: number): boolean {
  if (!isToday(date)) return false
  const now = new Date()
  const slotMin = parseTimeToMinutes(slotStart)
  const currentMin = now.getHours() * 60 + now.getMinutes()
  return slotMin < currentMin + bufferMinutes
}

export default function PremiumTimeSlotSelector({
  slots, selectedSlot, onSelect, selectedDate,
  nightStart, nightEnd, peakStart, peakEnd,
  bufferMinutes = 30,
}: Props) {
  const [disabledSlots, setDisabledSlots] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!selectedDate) { setDisabledSlots(new Set()); return }
    const dateKey = formatDateKey(selectedDate)
    supabase
      .from('advance_slot_overrides')
      .select('slot_key, is_disabled')
      .eq('is_disabled', true)
      .or(`date_key.eq.${dateKey},date_key.is.null`)
      .then(({ data }) => {
        const disabled = new Set<string>()
        ;(data || []).forEach((d: any) => disabled.add(d.slot_key))
        setDisabledSlots(disabled)
      })
  }, [selectedDate])

  const todaySelected = isToday(selectedDate)
  const allSlotsInPast = todaySelected && slots.length > 0 && slots.every(s => isSlotInPast(s.start, selectedDate, bufferMinutes))

  return (
    <div className="rounded-3xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center gap-2 mb-4">
        <Clock size={16} style={{ color: '#A6B300' }} />
        <span className="text-sm font-semibold text-white">Available Time Slots</span>
      </div>

      {todaySelected && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl px-3 py-2.5" style={{ background: 'rgba(166,179,0,0.06)', border: '1px solid rgba(166,179,0,0.15)' }}>
          <AlertCircle size={13} style={{ color: '#A6B300' }} />
          <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Only future time slots are available for today. Slots at least {bufferMinutes} minutes from now.
          </p>
        </div>
      )}

      {allSlotsInPast ? (
        <div className="py-6 text-center">
          <Clock size={32} className="mx-auto mb-2" style={{ color: 'rgba(255,255,255,0.2)' }} />
          <p className="text-sm font-medium text-white/60">No more slots available today.</p>
          <p className="text-xs text-white/40 mt-1">Please select another day.</p>
        </div>
      ) : slots.length === 0 ? (
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>No slots available for these business hours.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {slots.filter(slot => !isSlotInPast(slot.start, selectedDate, bufferMinutes)).map(slot => {
            const isSelected = selectedSlot === slot.key
            const isDisabled = disabledSlots.has(slot.key)
            const isNight = isNightTime(slot.start, nightStart, nightEnd)
            const isPeak = isPeakTime(slot.start, peakStart, peakEnd)
            const weekend = isWeekend(selectedDate)
            const slotDisabled = isDisabled

            return (
              <button key={slot.key} onClick={() => !slotDisabled && onSelect(slot.key)} disabled={slotDisabled}
                className="relative flex flex-col items-start gap-1 rounded-2xl p-3.5 transition-all active:scale-95 disabled:cursor-not-allowed"
                style={isSelected
                  ? { background: 'linear-gradient(135deg, #A6B300, #808000)', color: '#0B0B0B', boxShadow: '0 4px 16px rgba(166,179,0,0.3)' }
                  : slotDisabled
                    ? { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.2)' }
                    : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)' }}>
                <div className="flex items-center gap-1.5 w-full">
                  <span className="text-sm font-bold">{slot.label}</span>
                  {isSelected && <Check size={14} strokeWidth={3} className="ml-auto" />}
                </div>
                <div className="flex items-center gap-1.5">
                  {slotDisabled ? (
                    <span className="flex items-center gap-0.5 text-[9px] font-bold uppercase" style={{ color: 'rgba(255,255,255,0.2)' }}>
                      <Lock size={8} /> Unavailable
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5 text-[9px] font-bold uppercase" style={{ color: isSelected ? 'rgba(11,11,11,0.6)' : '#A6B300' }}>
                      <Check size={8} /> Available
                    </span>
                  )}
                </div>
                {!isSelected && !slotDisabled && (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {isNight && <span className="rounded-full px-1.5 py-0.5 text-[8px] font-bold" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>NIGHT</span>}
                    {isPeak && <span className="rounded-full px-1.5 py-0.5 text-[8px] font-bold" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>PEAK</span>}
                    {weekend && <span className="rounded-full px-1.5 py-0.5 text-[8px] font-bold" style={{ background: 'rgba(236,72,153,0.15)', color: '#f472b6' }}>WEEKEND</span>}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
