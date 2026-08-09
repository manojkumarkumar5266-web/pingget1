import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { pg } from '../design/tokens'
import { Surface, IconButton } from '../design/primitives'

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
    <Surface className="p-5" style={{ background: pg.bgElevated }}>
      <div className="mb-5 flex items-center justify-between">
        <IconButton onClick={prevMonth} disabled={!canGoPrev} className="!h-10 !w-10 disabled:opacity-20">
          <ChevronLeft size={18} />
        </IconButton>
        <div className="flex items-center gap-2">
          <Calendar size={16} style={{ color: pg.lime }} />
          <span className="text-base font-extrabold tracking-tight">{MONTHS[viewMonth]} {viewYear}</span>
        </div>
        <IconButton onClick={nextMonth} disabled={!canGoNext} className="!h-10 !w-10 disabled:opacity-20">
          <ChevronRight size={18} />
        </IconButton>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1">
        {WEEKDAYS.map(wd => (
          <div key={wd} className="text-center text-[10px] font-extrabold uppercase tracking-wider" style={{ color: pg.text4 }}>
            {wd}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />
          const enabled = isDateEnabled(day)
          const todayBadge = isToday(day)
          const selected = isSelected(day)
          const dateObj = new Date(viewYear, viewMonth, day)
          return (
            <button
              key={i}
              type="button"
              onClick={() => enabled && onSelect(dateObj)}
              disabled={!enabled}
              className="relative flex flex-col items-center justify-center rounded-2xl py-2.5 transition-all active:scale-90 disabled:cursor-not-allowed"
              style={selected
                ? { background: pg.lime, color: pg.limeText, boxShadow: '0 4px 16px rgba(245,197,66,0.35)' }
                : enabled
                  ? todayBadge
                    ? { background: pg.limeDim, border: `1.5px solid rgba(245,197,66,0.28)`, color: pg.lime }
                    : { background: pg.surface2, border: `1px solid ${pg.line}`, color: pg.text2 }
                  : { background: 'transparent', color: pg.text4, cursor: 'not-allowed' }}
            >
              <span className="text-sm font-extrabold">{day}</span>
              {todayBadge && !selected && (
                <span className="mt-0.5 text-[8px] font-extrabold uppercase" style={{ color: pg.lime }}>Today</span>
              )}
              {selected && (
                <span className="mt-0.5 text-[8px] font-extrabold uppercase" style={{ color: 'rgba(10,10,10,0.65)' }}>Selected</span>
              )}
            </button>
          )
        })}
      </div>

      {selectedDate && (
        <Surface accent className="mt-4 flex animate-slide-up items-center gap-3 p-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: pg.lime }}>
            <Calendar size={18} style={{ color: pg.limeText }} />
          </div>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: pg.text3 }}>Selected Date</p>
            <p className="text-sm font-extrabold">
              {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </Surface>
      )}

      <p className="mt-3 text-xs" style={{ color: pg.text4 }}>
        Select from today up to {maxDays} days ahead. Past dates are disabled.
      </p>
    </Surface>
  )
}
