import { Repeat, Calendar, CalendarDays, CalendarClock, Settings2, X } from 'lucide-react'

export type RecurringType = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom'

type Props = {
  recurringType: RecurringType
  onTypeChange: (t: RecurringType) => void
  intervalDays: number
  onIntervalChange: (n: number) => void
  weekday: number | null
  onWeekdayChange: (n: number) => void
  monthDay: number | null
  onMonthDayChange: (n: number) => void
  enabled: boolean
}

const WEEKDAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
]

const OPTIONS: { type: RecurringType; label: string; icon: typeof Repeat; desc: string }[] = [
  { type: 'none', label: 'Do Not Repeat', icon: X, desc: 'One-time request only' },
  { type: 'daily', label: 'Daily', icon: Calendar, desc: 'Every day at the same time' },
  { type: 'weekly', label: 'Weekly', icon: CalendarDays, desc: 'Every week on a specific day' },
  { type: 'monthly', label: 'Monthly', icon: CalendarClock, desc: 'Every month on a specific date' },
  { type: 'custom', label: 'Custom', icon: Settings2, desc: 'Every N days' },
]

export default function RecurringSelector({
  recurringType, onTypeChange, intervalDays, onIntervalChange,
  weekday, onWeekdayChange, monthDay, onMonthDayChange, enabled,
}: Props) {
  if (!enabled) return null

  return (
    <div className="rounded-3xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center gap-2 mb-4">
        <Repeat size={16} style={{ color: '#D4F000' }} />
        <span className="text-sm font-semibold text-white">Repeat Request</span>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>(optional)</span>
      </div>

      <div className="space-y-2">
        {OPTIONS.map(opt => {
          const Icon = opt.icon
          const isSelected = recurringType === opt.type
          return (
            <button key={opt.type} onClick={() => onTypeChange(opt.type)}
              className="flex w-full items-center gap-3 rounded-2xl p-3.5 transition-all active:scale-[0.98]"
              style={isSelected
                ? { background: 'rgba(212,240,0,0.12)', border: '1.5px solid rgba(212,240,0,0.4)' }
                : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={isSelected ? { background: 'rgba(212,240,0,0.2)' } : { background: 'rgba(255,255,255,0.05)' }}>
                <Icon size={16} style={{ color: isSelected ? '#D4F000' : 'rgba(255,255,255,0.4)' }} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold" style={{ color: isSelected ? '#D4F000' : 'rgba(255,255,255,0.7)' }}>{opt.label}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{opt.desc}</p>
              </div>
              {isSelected && (
                <div className="flex h-5 w-5 items-center justify-center rounded-full" style={{ background: '#D4F000' }}>
                  <span className="text-[10px] font-bold text-[#0B0B0B]">✓</span>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Weekly: pick weekday */}
      {recurringType === 'weekly' && (
        <div className="mt-4 animate-slide-up">
          <label className="label mb-2">Repeat every:</label>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map(wd => (
              <button key={wd.value} onClick={() => onWeekdayChange(wd.value)}
                className="rounded-xl px-3.5 py-2 text-sm font-semibold transition-all active:scale-95"
                style={weekday === wd.value
                  ? { background: '#D4F000', color: '#0B0B0B' }
                  : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {wd.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Monthly: pick day of month */}
      {recurringType === 'monthly' && (
        <div className="mt-4 animate-slide-up">
          <label className="label mb-2">Day of month:</label>
          <input type="number" min={1} max={31} className="input"
            value={monthDay ?? ''}
            onChange={e => onMonthDayChange(parseInt(e.target.value) || 1)} />
        </div>
      )}

      {/* Custom: pick interval days */}
      {recurringType === 'custom' && (
        <div className="mt-4 animate-slide-up">
          <label className="label mb-2">Repeat every (days):</label>
          <input type="number" min={1} max={365} className="input"
            value={intervalDays}
            onChange={e => onIntervalChange(parseInt(e.target.value) || 1)} />
        </div>
      )}
    </div>
  )
}
