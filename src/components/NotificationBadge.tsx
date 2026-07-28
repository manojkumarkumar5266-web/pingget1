import { Bell } from 'lucide-react'

interface NotificationBadgeProps {
  count: number
  size?: number
  className?: string
}

/**
 * Reusable notification bell icon with unread count badge.
 * Shows a pulsing red badge when count > 0.
 */
export function NotificationBadge({ count, size = 22, className = '' }: NotificationBadgeProps) {
  return (
    <div className={`relative ${className}`}>
      <Bell size={size} />
      {count > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error-500 px-1 text-[9px] font-bold text-white animate-pulse">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </div>
  )
}
