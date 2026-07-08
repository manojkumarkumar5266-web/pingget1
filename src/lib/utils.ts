export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(1)}km`
}

export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function timeOfDay(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const ORDER_STATUS_FLOW = [
  'confirmed',
  'shopping',
  'purchased',
  'on_the_way',
  'arrived',
  'delivered',
  'cash_received',
  'completed',
] as const

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  confirmed: 'Confirmed',
  shopping: 'Shopping',
  purchased: 'Purchased',
  on_the_way: 'On The Way',
  arrived: 'Arrived',
  delivered: 'Delivered',
  cash_received: 'Cash Received',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  accepted: 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300',
  confirmed: 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300',
  shopping: 'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300',
  purchased: 'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300',
  on_the_way: 'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-300',
  arrived: 'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-300',
  delivered: 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300',
  cash_received: 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300',
  completed: 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300',
  cancelled: 'bg-error-100 text-error-700 dark:bg-error-900/40 dark:text-error-300',
}
