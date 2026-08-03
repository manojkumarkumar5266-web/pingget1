import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

type Props = {
  selectedDate: Date | null
  onSelect: (date: Date) => void
  maxDays: number
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function PremiumCalendar({ selectedDate, onSelect, maxDays }: Props) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])
  const maxDate = useMemo(() => { const d = new Date(today); d.setDate(d.getDate() + maxDays); return d }, [today, maxDays])
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [viewYear, setViewYear] = useState(today.getFullYear())

  const canGoPrev = viewYear > today.getFullYear() || (viewYear === today.getFullYear() && viewMonth > today.getMonth())
  const canGoNext = viewYear < maxDate.getFullYear() || (viewYear === maxDate.getFullYear() && viewMonth < maxDate.getMonth())

  const prevMonth = () => { if (!canGoPrev) return; if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) } else setViewMonth(m => m - 1) }
  const nextMonth = () => { if (!canGoNext) return; if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) } else setViewMonth(m => m + 1) }

  const firstDay = new Date(viewYear, viewMonth, 1)
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const startWeekday = firstDay.getDay()

  const isDateEnabled = (day: number): boolean => {
    const d = new Date(viewYear, viewMonth, day)
    d.setHours(0, 0, 0, 0)
    if (isSameDay(d, today)) return false
    if (d < today) return false
    if (d > maxDate) return false
    return true
  }

  const isToday = (day: number): boolean => isSameDay(new Date(viewYear, viewMonth, day), today)
  const isSelected = (day: number): boolean => selectedDate ? isSameDay(new Date(viewYear, viewMonth, day), selectedDate) : false

  const cells: (number | null)[] = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="rounded-3xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={prevMonth} disabled={!canGoPrev}
          className="flex h-10 w-10 items-center justify-center rounded-2xl transition-all active:scale-90 disabled:opacity-20"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <ChevronLeft size={18} style={{ color: '#fff' }} />
        </button>
        <div className="flex items-center gap-2">
          <Calendar size={16} style={{ color: '#A6B300' }} />
          <span className="text-base font-bold text-white">{MONTHS[viewMonth]} {viewYear}</span>
        </div>
        <button onClick={nextMonth} disabled={!canGoNext}
          className="flex h-10 w-10 items-center justify-center rounded-2xl transition-all active:scale-90 disabled:opacity-20"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <ChevronRight size={18} style={{ color: '#fff' }} />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="mb-2 grid grid-cols-7 gap-1">
        {WEEKDAYS.map(wd => (
          <div key={wd} className="text-center text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {wd}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />
          const enabled = isDateEnabled(day)
          const todayBadge = isToday(day)
          const selected = isSelected(day)
          const dateObj = new Date(viewYear, viewMonth, day)
          return (
            <button key={i} onClick={() => enabled && onSelect(dateObj)} disabled={!enabled}
              className="relative flex flex-col items-center justify-center rounded-2xl py-2.5 transition-all active:scale-90"
              style={selected
                ? { background: 'linear-gradient(135deg, #A6B300, #808000)', color: '#0B0B0B', boxShadow: '0 4px 16px rgba(166,179,0,0.4)' }
                : enabled
                  ? { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }
                  : { background: 'transparent', color: 'rgba(255,255,255,0.15)', cursor: 'not-allowed' }}>
              <span className={`text-sm font-bold ${selected ? 'text-[#0B0B0B]' : ''}`}>{day}</span>
              {todayBadge && !selected && (
                <span className="mt-0.5 text-[8px] font-bold uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>Today</span>
              )}
              {selected && (
                <span className="mt-0.5 text-[8px] font-bold uppercase text-[#0B0B0B]/70">Selected</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Selected date display */}
      {selectedDate && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl p-3.5 animate-slide-up"
          style={{ background: 'rgba(166,179,0,0.08)', border: '1px solid rgba(166,179,0,0.2)' }}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #A6B300, #808000)' }}>
            <Calendar size={18} className="text-[#0B0B0B]" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Selected Date</p>
            <p className="text-sm font-bold text-white">
              {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>
      )}

      <p className="mt-3 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
        Select from tomorrow up to {maxDays} days ahead. Today and past dates are disabled.
      </p>
    </div>
  )
}
