import { Bike, Store, Home, Package, ShoppingBag, CheckCircle2, MapPin, Navigation } from 'lucide-react'

export const STATUS_PROGRESS: Record<string, number> = {
  pending: 0,
  accepted: 8,
  confirmed: 18,
  shopping: 35,
  purchased: 52,
  on_the_way: 72,
  arrived: 92,
  delivered: 100,
  cash_received: 100,
  completed: 100,
}

export const STATUS_ETA: Record<string, string> = {
  pending: 'Waiting...',
  accepted: '~30 min',
  confirmed: '~25 min',
  shopping: '~20 min',
  purchased: '~10 min',
  on_the_way: '~5 min',
  arrived: 'Arrived',
  delivered: 'Delivered',
  cash_received: 'Delivered',
  completed: 'Done',
}

const MILESTONES = [
  { pct: 8, label: 'Accepted', icon: CheckCircle2 },
  { pct: 35, label: 'Shopping', icon: ShoppingBag },
  { pct: 52, label: 'Purchased', icon: Package },
  { pct: 72, label: 'On the way', icon: Bike },
  { pct: 92, label: 'Arrived', icon: MapPin },
]

export default function VisualTracking({
  progress,
  status,
  vehicleType,
  dpName,
  pickupLabel,
  deliveryLabel,
  eta,
}: {
  progress: number
  status: string
  vehicleType?: string
  dpName?: string
  pickupLabel?: string
  deliveryLabel?: string
  eta?: string
}) {
  const isShopping = status === 'shopping' || status === 'confirmed'
  const isOnTheWay = status === 'on_the_way' || status === 'purchased'
  const isArrived = status === 'arrived'
  const isDelivered = status === 'delivered' || status === 'completed' || status === 'cash_received'

  return (
    <div className="relative flex h-full flex-col justify-center overflow-hidden bg-black px-6 py-8">
      {/* Subtle grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(rgba(128,128,0,1) 1px, transparent 1px), linear-gradient(90deg, rgba(128,128,0,1) 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }}
      />

      {/* Glow accent */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-10 blur-3xl"
        style={{ background: 'radial-gradient(circle, #808000, transparent 70%)' }}
      />

      {/* Title */}
      <div className="relative mb-6 text-center">
        <p className="text-xs font-medium uppercase tracking-widest text-white/40">Live Tracking</p>
        <p className="mt-1 text-lg font-bold text-white">{eta || STATUS_ETA[status] || 'In Progress'}</p>
      </div>

      {/* Visual track */}
      <div className="relative mx-auto w-full max-w-sm">
        {/* Endpoints */}
        <div className="flex items-start justify-between">
          {/* Point B - DP / Store */}
          <div className="flex flex-col items-center" style={{ width: '64px' }}>
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl border transition-all"
              style={{
                background: isShopping ? 'rgba(128,128,0,0.15)' : 'rgba(255,255,255,0.04)',
                borderColor: isShopping ? 'rgba(128,128,0,0.4)' : 'rgba(255,255,255,0.08)',
              }}
            >
              {isShopping ? (
                <ShoppingBag size={24} className="text-[#a8c020]" />
              ) : (
                <Store size={24} className="text-white/60" />
              )}
            </div>
            <p className="mt-2 max-w-[80px] text-center text-[10px] font-medium leading-tight text-white/50">
              {pickupLabel || 'Store'}
            </p>
          </div>

          {/* Point A - User / Home */}
          <div className="flex flex-col items-center" style={{ width: '64px' }}>
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl border transition-all"
              style={{
                background: isArrived || isDelivered ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)',
                borderColor: isArrived || isDelivered ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.08)',
              }}
            >
              <Home size={24} className={isArrived || isDelivered ? 'text-green-400' : 'text-white/60'} />
            </div>
            <p className="mt-2 max-w-[80px] text-center text-[10px] font-medium leading-tight text-white/50">
              {deliveryLabel || 'You'}
            </p>
          </div>
        </div>

        {/* Track line */}
        <div className="relative mt-[-46px] h-1 w-full" style={{ marginLeft: 32, marginRight: 32, width: 'calc(100% - 64px)' }}>
          {/* Base track */}
          <div className="absolute left-0 top-0 h-1 w-full rounded-full bg-white/8" />
          {/* Progress track */}
          <div
            className="absolute left-0 top-0 h-1 rounded-full transition-all duration-1000 ease-out"
            style={{
              width: `${progress}%`,
              background: isDelivered
                ? 'linear-gradient(90deg, #808000, #22c55e)'
                : 'linear-gradient(90deg, #808000, #a8c020)',
              boxShadow: '0 0 12px rgba(128,128,0,0.4)',
            }}
          />

          {/* Milestone dots */}
          {MILESTONES.map((m) => {
            const Icon = m.icon
            const reached = progress >= m.pct
            return (
              <div
                key={m.label}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${m.pct}%` }}
              >
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all duration-500 ${
                    reached ? 'scale-100' : 'scale-75'
                  }`}
                  style={{
                    background: reached ? '#808000' : '#0a0a0a',
                    borderColor: reached ? '#a8c020' : 'rgba(255,255,255,0.15)',
                  }}
                >
                  <Icon size={12} className={reached ? 'text-black' : 'text-white/30'} />
                </div>
              </div>
            )
          })}

          {/* Vehicle icon */}
          <div
            className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 transition-all duration-1000 ease-out"
            style={{ left: `${Math.max(4, Math.min(progress, 96))}%` }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{
                background: isDelivered ? '#16a34a' : '#808000',
                boxShadow: isOnTheWay
                  ? '0 0 20px rgba(128,128,0,0.6), 0 0 40px rgba(128,128,0,0.3)'
                  : '0 4px 12px rgba(0,0,0,0.4)',
              }}
            >
              {isDelivered ? (
                <CheckCircle2 size={20} className="text-white" />
              ) : isShopping ? (
                <ShoppingBag size={18} className="text-black" />
              ) : (
                <Bike size={20} className="text-black" />
              )}
            </div>
            {/* Motion trail */}
            {isOnTheWay && (
              <div
                className="absolute right-full top-1/2 h-0.5 w-8 -translate-y-1/2 rounded-full"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(168,192,32,0.6))',
                  animation: 'trail 1.5s ease-out infinite',
                }}
              />
            )}
          </div>
        </div>

        {/* Status labels under track */}
        <div className="mt-8 flex justify-between">
          <div className="text-left">
            <p className="text-[10px] uppercase tracking-wider text-white/30">From</p>
            <p className="text-xs font-semibold text-white/70">{dpName || 'Delivery Partner'}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-white/30">To</p>
            <p className="text-xs font-semibold text-white/70">{deliveryLabel || 'Your Location'}</p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative mx-auto mt-8 w-full max-w-sm">
        <div className="mb-1.5 flex items-center justify-between text-[10px] text-white/40">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-out"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #808000, #a8c020)',
              boxShadow: '0 0 8px rgba(128,128,0,0.3)',
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes trail {
          0% { opacity: 0; transform: translateY(-50%) translateX(0); }
          50% { opacity: 1; }
          100% { opacity: 0; transform: translateY(-50%) translateX(-12px); }
        }
      `}</style>
    </div>
  )
}
