/** Helpers for advance booking task-day gating */

export function getAdvanceTaskStartMs(req: {
  scheduled_timestamp?: string | null
  scheduled_date?: string | null
  scheduled_slot?: string | null
  scheduled_time?: string | null
}): number | null {
  if (req.scheduled_timestamp) {
    const t = new Date(req.scheduled_timestamp).getTime()
    return Number.isFinite(t) ? t : null
  }
  if (!req.scheduled_date) return null
  const slot = (req.scheduled_slot || req.scheduled_time || '00:00').toString()
  const startPart = slot.split('-')[0].trim()
  // scheduled_time may be "09:00" or "9:00"
  const normalized = startPart.length === 4 ? `0${startPart}` : startPart
  const iso = `${req.scheduled_date}T${normalized.length === 5 ? normalized : '00:00'}:00`
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? t : null
}

/** True when now is on/after the scheduled slot start (task day window opened). */
export function canStartAdvanceTask(req: {
  scheduled_timestamp?: string | null
  scheduled_date?: string | null
  scheduled_slot?: string | null
  scheduled_time?: string | null
  status?: string
}): boolean {
  if (req.status && req.status !== 'booking_confirmed') return false
  const startMs = getAdvanceTaskStartMs(req)
  if (startMs == null) return false
  return Date.now() >= startMs
}

export function advanceTaskUnlockLabel(req: {
  scheduled_timestamp?: string | null
  scheduled_date?: string | null
  scheduled_slot?: string | null
  scheduled_time?: string | null
}): string {
  const startMs = getAdvanceTaskStartMs(req)
  if (startMs == null) return 'Waiting for scheduled time'
  const d = new Date(startMs)
  return `Starts ${d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })}`
}
