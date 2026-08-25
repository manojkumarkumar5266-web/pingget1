/** Alerts tab: admin offers/announcements only — not order, chat, or system rows. */
export const ADMIN_ALERT_TYPES = ['admin_announcement', 'admin_offer'] as const

export function isAdminAlert(n: { type?: string | null; notification_type?: string | null }): boolean {
  const a = (n.notification_type || '').toLowerCase()
  const b = (n.type || '').toLowerCase()
  return ADMIN_ALERT_TYPES.includes(a as (typeof ADMIN_ALERT_TYPES)[number])
    || ADMIN_ALERT_TYPES.includes(b as (typeof ADMIN_ALERT_TYPES)[number])
}

export function isIncomingRequestAlert(type?: string | null): boolean {
  const t = (type || '').toLowerCase()
  return t === 'new_nearby_request' || t === 'order_received' || t === 'order_placed' || t === 'new_request_nearby'
}

/** PostgREST `.or(...)` filter for Alerts list + unread badge. */
export function adminAlertOrFilter(): string {
  return 'type.in.(admin_announcement,admin_offer),notification_type.in.(admin_announcement,admin_offer)'
}
