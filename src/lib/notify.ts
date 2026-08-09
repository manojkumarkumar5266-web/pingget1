import { supabase } from './supabase'

/**
 * Kick FCM delivery for a notification (or drain pending outbox).
 * Safe to fire-and-forget after any notifications insert.
 */
export function kickPushDelivery(notificationId?: string) {
  const body = notificationId
    ? { notificationId }
    : { processOutbox: true, limit: 40 }
  void supabase.functions.invoke('dispatch-push', { body }).catch(() => {})
}

/** Insert in-app notification and enqueue mobile push. */
export async function notifyUser(input: {
  userId: string
  title: string
  body: string
  type: string
  relatedId?: string | null
  imageUrl?: string | null
  route?: string | null
  notificationType?: string | null
}) {
  const { data, error } = await supabase.from('notifications').insert({
    user_id: input.userId,
    title: input.title,
    body: input.body,
    type: input.type,
    notification_type: input.notificationType || input.type,
    related_id: input.relatedId || null,
    image_url: input.imageUrl || null,
    route: input.route || null,
  }).select('id').single()

  if (!error && data?.id) kickPushDelivery(data.id)
  else kickPushDelivery()
  return { data, error }
}
