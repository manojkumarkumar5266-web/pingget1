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
  /** Total occurrences including the first booking (e.g. 15 daily = 15 days) */
  maxOccurrences: number
  onMaxOccurrencesChange: (n: number) => void
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
  { type: 'none', label: 'One-time only', icon: X, desc: 'Single advance booking' },
  { type: 'daily', label: 'Daily (N days)', icon: Calendar, desc: 'Same task every day for a set number of days' },
  { type: 'weekly', label: 'Weekly', icon: CalendarDays, desc: 'Same weekday for several weeks' },
  { type: 'monthly', label: 'Monthly', icon: CalendarClock, desc: 'Same date each month for several months' },
  { type: 'custom', label: 'Every N days', icon: Settings2, desc: 'Custom interval + how many times' },
]

const DURATION_PRESETS: Record<Exclude<RecurringType, 'none'>, { label: string; value: number }[]> = {
  daily: [
    { label: '7 days', value: 7 },
    { label: '15 days', value: 15 },
    { label: '30 days', value: 30 },
    { label: '60 days', value: 60 },
  ],
  weekly: [
    { label: '4 weeks', value: 4 },
    { label: '8 weeks', value: 8 },
    { label: '12 weeks', value: 12 },
  ],
  monthly: [
    { label: '3 months', value: 3 },
    { label: '6 months', value: 6 },
    { label: '12 months', value: 12 },
  ],
  custom: [
    { label: '7 times', value: 7 },
    { label: '15 times', value: 15 },
    { label: '30 times', value: 30 },
  ],
}

export default function RecurringSelector({
  recurringType, onTypeChange, intervalDays, onIntervalChange,
  weekday, onWeekdayChange, monthDay, onMonthDayChange,
  maxOccurrences, onMaxOccurrencesChange, enabled,
}: Props) {
  if (!enabled) return null

  const presets = recurringType !== 'none' ? DURATION_PRESETS[recurringType] : []

  return (
    <div className="rounded-3xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center gap-2 mb-2">
        <Repeat size={16} style={{ color: '#0C8A3E' }} />
        <span className="text-sm font-semibold text-[#F5F7F6]">Recurring booking</span>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold" style={{ background: 'rgba(12,138,62,0.2)', color: '#0C8A3E' }}>OPTIONAL</span>
      </div>
      <p className="mb-4 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
        Repeat this advance task — daily (e.g. 15 days), weekly, monthly, or every N days.
        The partner who accepts is notified for each day; pay for the series on acceptance.
      </p>

      <div className="space-y-2">
        {OPTIONS.map(opt => {
          const Icon = opt.icon
          const isSelected = recurringType === opt.type
          return (
            <button key={opt.type} type="button" onClick={() => onTypeChange(opt.type)}
              className="flex w-full items-center gap-3 rounded-2xl p-3.5 transition-all active:scale-[0.98]"
              style={isSelected
                ? { background: 'rgba(196,214,0,0.12)', border: '1.5px solid rgba(196,214,0,0.4)' }
                : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={isSelected ? { background: 'rgba(196,214,0,0.2)' } : { background: 'rgba(255,255,255,0.05)' }}>
                <Icon size={16} style={{ color: isSelected ? '#0C8A3E' : 'rgba(255,255,255,0.4)' }} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold" style={{ color: isSelected ? '#0C8A3E' : 'rgba(255,255,255,0.7)' }}>{opt.label}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{opt.desc}</p>
              </div>
              {isSelected && (
                <div className="flex h-5 w-5 items-center justify-center rounded-full" style={{ background: '#0C8A3E' }}>
                  <span className="text-[10px] font-bold text-[#0B0B0B]">✓</span>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {recurringType === 'weekly' && (
        <div className="mt-4 animate-slide-up">
          <label className="label mb-2">Repeat every:</label>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map(wd => (
              <button key={wd.value} type="button" onClick={() => onWeekdayChange(wd.value)}
                className="rounded-xl px-3.5 py-2 text-sm font-semibold transition-all active:scale-95"
                style={weekday === wd.value
                  ? { background: '#0C8A3E', color: '#0B0B0B' }
                  : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {wd.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {recurringType === 'monthly' && (
        <div className="mt-4 animate-slide-up">
          <label className="label mb-2">Day of month:</label>
          <input type="number" min={1} max={31} className="input"
            value={monthDay ?? ''}
            onChange={e => onMonthDayChange(parseInt(e.target.value) || 1)} />
        </div>
      )}

      {recurringType === 'custom' && (
        <div className="mt-4 animate-slide-up">
          <label className="label mb-2">Repeat every (days):</label>
          <input type="number" min={1} max={365} className="input"
            value={intervalDays}
            onChange={e => onIntervalChange(parseInt(e.target.value) || 1)} />
        </div>
      )}

      {recurringType !== 'none' && (
        <div className="mt-4 animate-slide-up">
          <label className="label mb-2">
            {recurringType === 'daily' && 'How many days?'}
            {recurringType === 'weekly' && 'How many weeks?'}
            {recurringType === 'monthly' && 'How many months?'}
            {recurringType === 'custom' && 'How many times?'}
          </label>
          <div className="mb-2 flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => onMaxOccurrencesChange(p.value)}
                className="rounded-xl px-3.5 py-2 text-sm font-semibold transition-all active:scale-95"
                style={maxOccurrences === p.value
                  ? { background: '#0C8A3E', color: '#0B0B0B' }
                  : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <input
            type="number"
            min={2}
            max={100}
            className="input"
            value={maxOccurrences}
            onChange={(e) => onMaxOccurrencesChange(Math.max(2, Math.min(100, parseInt(e.target.value) || 2)))}
          />
          <p className="mt-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Includes today’s booking. Example: 15 days = this request + 14 more automatic bookings.
          </p>
        </div>
      )}
    </div>
  )
}
