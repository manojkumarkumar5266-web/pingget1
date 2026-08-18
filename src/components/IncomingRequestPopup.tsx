import { CalendarClock, Check, MapPin, Repeat, X, Loader2, Bell } from 'lucide-react'
import { formatDistance, formatTime } from '../lib/utils'
import { CTA, IconButton, Surface } from '../design/primitives'
import { pg } from '../design/tokens'

export type IncomingRequest = {
  id: string
  description?: string | null
  pickup_address?: string | null
  delivery_address?: string | null
  order_type?: string | null
  is_scheduled?: boolean | null
  scheduled_date?: string | null
  scheduled_slot?: string | null
  scheduled_time?: string | null
  request_category?: string | null
  recurring_type?: string | null
  created_at?: string
}

export default function IncomingRequestPopup({
  req,
  distanceM,
  accepting,
  onAccept,
  onDecline,
}: {
  req: IncomingRequest
  distanceM: number | null
  accepting: boolean
  onAccept: () => void
  onDecline: () => void
}) {
  const advance = req.order_type === 'advance' || req.is_scheduled
  const recurring = req.recurring_type && req.recurring_type !== 'none'
  const schedule = req.scheduled_slot
    || (req.scheduled_date && req.scheduled_time ? `${req.scheduled_date} ${req.scheduled_time}` : null)
    || req.scheduled_date
  const title = advance ? (recurring ? 'Recurring booking' : 'Advance booking') : 'Instant request'

  return (
    <div className="fixed inset-0 z-[240] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        className="w-full max-w-md animate-slide-up overflow-hidden rounded-t-[28px] sm:rounded-[28px]"
        style={{ background: pg.headerElevated, border: `1px solid ${pg.headerBorder}` }}
      >
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${pg.line}` }}>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: pg.limeDim }}>
            <Bell size={18} className="animate-pulse" style={{ color: pg.lime }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em]" style={{ color: pg.gold }}>
              New request
            </p>
            <p className="text-lg font-extrabold tracking-tight">{title}</p>
          </div>
          <IconButton onClick={onDecline} className="!h-10 !w-10" aria-label="Dismiss">
            <X size={16} />
          </IconButton>
        </div>

        <div className="space-y-3 px-5 py-4">
          <p className="text-[15px] font-extrabold leading-snug">
            {req.description?.split('\n')[0]?.trim() || 'Delivery request'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full px-2.5 py-1 text-[10px] font-extrabold" style={{ background: pg.limeDim, color: pg.lime }}>
              {advance ? 'Advance' : 'Instant'}
            </span>
            {recurring && (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold" style={{ background: 'rgba(196,163,90,0.18)', color: pg.gold }}>
                <Repeat size={10} /> Recurring
              </span>
            )}
            {req.request_category && (
              <span className="rounded-full px-2.5 py-1 text-[10px] font-extrabold" style={{ background: pg.surface2, color: pg.text3 }}>
                {req.request_category}
              </span>
            )}
            {distanceM != null && (
              <span className="rounded-full px-2.5 py-1 text-[10px] font-extrabold" style={{ background: pg.surface2, color: pg.text2 }}>
                {formatDistance(distanceM)}
              </span>
            )}
          </div>
          {advance && schedule && (
            <p className="flex items-center gap-1.5 text-xs font-medium" style={{ color: pg.text3 }}>
              <CalendarClock size={12} /> {schedule}
            </p>
          )}
          {req.pickup_address && (
            <p className="flex items-start gap-1.5 text-xs" style={{ color: pg.text3 }}>
              <MapPin size={12} className="mt-0.5 shrink-0 text-amber-400" />
              {req.pickup_address}
            </p>
          )}
          {req.delivery_address && (
            <p className="flex items-start gap-1.5 text-xs" style={{ color: pg.text2 }}>
              <MapPin size={12} className="mt-0.5 shrink-0 text-red-400" />
              {req.delivery_address}
            </p>
          )}
          {req.created_at && (
            <p className="text-[11px]" style={{ color: pg.text4 }}>{formatTime(req.created_at)}</p>
          )}
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <CTA className="min-h-[52px] flex-1" onClick={onAccept} disabled={accepting}>
            {accepting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={3} />}
            {accepting ? 'Accepting…' : 'Accept'}
          </CTA>
          <CTA variant="danger" className="min-h-[52px] !px-4" onClick={onDecline} disabled={accepting}>
            <X size={16} />
          </CTA>
        </div>
        <Surface className="mx-5 mb-5 p-3">
          <p className="text-[11px] leading-relaxed" style={{ color: pg.text3 }}>
            First partner to accept gets this order. It disappears for everyone else.
          </p>
        </Surface>
      </div>
    </div>
  )
}
