import { Wifi, WifiOff } from 'lucide-react'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'

export default function OfflineBanner() {
  const isOnline = useOnlineStatus()
  if (isOnline) return null

  return (
    <div className="offline-banner fixed left-0 right-0 top-0 z-[5000] flex items-center justify-center gap-2 bg-red-500 px-4 py-2.5 text-sm font-medium text-[#F5F7F6] shadow-lg">
      <WifiOff size={16} />
      <span>You're offline. Reconnecting...</span>
    </div>
  )
}
