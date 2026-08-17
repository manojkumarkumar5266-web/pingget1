import { supabase } from './supabase'
import { kickPushDelivery } from './notify'

/**
 * Client-side safety net for advance task-day reminders.
 * Ensures user + DP get a "task day" notification when a reserved booking
 * is scheduled for today — even if the cron edge function is delayed.
 */
export async function ensureAdvanceTaskDayReminders(userId: string, role: 'user' | 'dp' | string) {
  if (!userId) return

  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  const todayStr = `${yyyy}-${mm}-${dd}`

  let query = supabase
    .from('requests')
    .select('id, user_id, accepted_dp_id, reserved_dp_id, request_category, scheduled_date, scheduled_time, scheduled_slot, status')
    .eq('order_type', 'advance')
    .eq('scheduled_date', todayStr)
    .in('status', ['booking_confirmed', 'payment_verified', 'dp_reserved'])

  if (role === 'dp') {
    query = query.or(`accepted_dp_id.eq.${userId},reserved_dp_id.eq.${userId}`)
  } else {
    query = query.eq('user_id', userId)
  }

  const { data: rows } = await query.limit(20)
  if (!rows?.length) return

  let inserted = false
  for (const req of rows) {
    const recipients = [req.user_id, req.accepted_dp_id || req.reserved_dp_id].filter(Boolean) as string[]
    for (const recipientId of [...new Set(recipients)]) {
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', recipientId)
        .eq('related_id', req.id)
        .eq('type', 'advance_reminder_task_day')
        .maybeSingle()

      if (existing) continue

      const isDp = recipientId !== req.user_id
      const timeLabel = req.scheduled_slot || req.scheduled_time || 'your slot'
      const { error } = await supabase.from('notifications').insert({
        user_id: recipientId,
        title: 'Advance booking — task day',
        body: isDp
          ? `Your reserved ${req.request_category || 'delivery'} task is today at ${timeLabel}. Open Orders and tap Start task when ready.`
          : `Your ${req.request_category || 'delivery'} booking is today at ${timeLabel}. Your partner will start the task on time.`,
        type: 'advance_reminder_task_day',
        related_id: req.id,
      })
      if (!error) inserted = true
    }
  }

  if (inserted) kickPushDelivery()
}
