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

  // Generate a wave-style SVG path
  const waveWidth = 280
  const waveHeight = 60
  const amplitude = 12
  const segments = 40
  const points: string[] = []
  for (let i = 0; i <= segments; i++) {
    const x = (i / segments) * waveWidth
    const y = waveHeight / 2 + Math.sin((i / segments) * Math.PI * 3) * amplitude
    points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`)
  }
  const wavePath = points.join(' ')

  // Milestone positions along the wave
  const milestonePos = (pct: number) => ({
    x: (pct / 100) * waveWidth,
    y: waveHeight / 2 + Math.sin((pct / 100) * Math.PI * 3) * amplitude,
  })

  // Vehicle position
  const vehiclePos = milestonePos(Math.max(4, Math.min(progress, 96)))

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

      {/* Title + ETA */}
      <div className="relative mb-6 text-center">
        <p className="text-xs font-medium uppercase tracking-widest text-white/40">Live Tracking</p>
        <p className="mt-1 text-lg font-bold text-white">{eta || STATUS_ETA[status] || 'In Progress'}</p>
        {eta && eta !== STATUS_ETA[status] && (
          <p className="mt-0.5 text-xs font-medium" style={{ color: '#A6B300' }}>ETA: {eta}</p>
        )}
      </div>

      {/* Wave Timeline */}
      <div className="relative mx-auto w-full max-w-sm">
        <svg viewBox={`0 0 ${waveWidth} ${waveHeight + 30}`} className="w-full" style={{ overflow: 'visible' }}>
          {/* Base wave track */}
          <path d={wavePath} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={3} strokeLinecap="round" />
          {/* Progress wave track — clipped to progress */}
          <defs>
            <clipPath id="progressClip">
              <rect x={0} y={0} width={(progress / 100) * waveWidth} height={waveHeight + 30} />
            </clipPath>
          </defs>
          <path d={wavePath} fill="none" stroke="url(#waveGrad)" strokeWidth={3} strokeLinecap="round" clipPath="url(#progressClip)" />
          <defs>
            <linearGradient id="waveGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={isDelivered ? '#22c55e' : '#808000'} />
              <stop offset="100%" stopColor={isDelivered ? '#16a34a' : '#a8c020'} />
            </linearGradient>
          </defs>

          {/* Milestone dots */}
          {MILESTONES.map((m) => {
            const pos = milestonePos(m.pct)
            const reached = progress >= m.pct
            return (
              <g key={m.label}>
                <circle cx={pos.x} cy={pos.y} r={reached ? 7 : 5}
                  fill={reached ? '#808000' : '#0a0a0a'}
                  stroke={reached ? '#a8c020' : 'rgba(255,255,255,0.15)'}
                  strokeWidth={2}
                  style={{ filter: reached ? 'drop-shadow(0 0 4px rgba(128,128,0,0.5))' : 'none' }} />
                <text x={pos.x} y={waveHeight + 22} textAnchor="middle"
                  fill={reached ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)'}
                  fontSize={7} fontWeight={600} fontFamily="system-ui">
                  {m.label}
                </text>
              </g>
            )
          })}

          {/* Vehicle icon on the wave */}
          <g style={{ transition: 'all 1s ease-out' }}>
            <circle cx={vehiclePos.x} cy={vehiclePos.y} r={11}
              fill={isDelivered ? '#16a34a' : '#808000'}
              style={{ filter: isOnTheWay ? 'drop-shadow(0 0 8px rgba(128,128,0,0.6))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }} />
            <foreignObject x={vehiclePos.x - 8} y={vehiclePos.y - 8} width={16} height={16}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16 }}>
                {isDelivered ? (
                  <CheckCircle2 size={11} className="text-white" />
                ) : isShopping ? (
                  <ShoppingBag size={10} className="text-black" />
                ) : (
                  <Bike size={11} className="text-black" />
                )}
              </div>
            </foreignObject>
          </g>
        </svg>

        {/* Endpoints */}
        <div className="mt-3 flex items-start justify-between">
          {/* Store / Pickup */}
          <div className="flex flex-col items-center" style={{ width: '64px' }}>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border transition-all"
              style={{
                background: isShopping ? 'rgba(128,128,0,0.15)' : 'rgba(255,255,255,0.04)',
                borderColor: isShopping ? 'rgba(128,128,0,0.4)' : 'rgba(255,255,255,0.08)',
              }}>
              {isShopping ? <ShoppingBag size={20} className="text-[#a8c020]" /> : <Store size={20} className="text-white/60" />}
            </div>
            <p className="mt-1.5 max-w-[72px] text-center text-[10px] font-medium leading-tight text-white/50">
              {pickupLabel || 'Store'}
            </p>
          </div>
          {/* Home / Delivery */}
          <div className="flex flex-col items-center" style={{ width: '64px' }}>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border transition-all"
              style={{
                background: isArrived || isDelivered ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)',
                borderColor: isArrived || isDelivered ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.08)',
              }}>
              <Home size={20} className={isArrived || isDelivered ? 'text-green-400' : 'text-white/60'} />
            </div>
            <p className="mt-1.5 max-w-[72px] text-center text-[10px] font-medium leading-tight text-white/50">
              {deliveryLabel || 'You'}
            </p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative mx-auto mt-6 w-full max-w-sm">
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
    </div>
  )
}
