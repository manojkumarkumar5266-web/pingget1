import { getTrackingStepImage, Images } from '../lib/customImages'

export const STATUS_PROGRESS: Record<string, number> = {
  pending: 0,
  accepted: 12,
  confirmed: 12,
  shopping: 28,
  purchased: 45,
  on_the_way: 68,
  arrived: 88,
  delivered: 100,
  cash_received: 100,
  completed: 100,
}

export const STATUS_ETA: Record<string, string> = {
  pending: 'Waiting...',
  accepted: 'Reached store',
  confirmed: 'Reached store',
  shopping: 'Reached store',
  purchased: 'Order picked up',
  on_the_way: 'On the way',
  arrived: 'Arrived',
  delivered: 'Delivered',
  cash_received: 'Delivered',
  completed: 'Done',
}

const STEP_LABELS: Record<string, string> = {
  accepted: 'Reached store',
  confirmed: 'Reached store',
  shopping: 'Reached store',
  purchased: 'Order picked up',
  on_the_way: 'On the way',
  arrived: 'Arrived',
  delivered: 'Delivered',
  cash_received: 'Delivered',
  completed: 'Delivered',
}

export default function VisualTracking({
  progress,
  status,
  pickupLabel,
  deliveryLabel,
}: {
  progress: number
  status: string
  vehicleType?: string
  dpName?: string
  pickupLabel?: string
  deliveryLabel?: string
  eta?: string
}) {
  const image = getTrackingStepImage(status) || Images.tracking
  const label = STEP_LABELS[status] || STATUS_ETA[status] || 'In Progress'

  return (
    <div className="relative flex h-full flex-col justify-center overflow-hidden bg-[#0B0B0B] px-3 py-2">
      <div className="mx-auto w-full max-w-lg">
        <div className="overflow-hidden rounded-[28px]" style={{ border: '1px solid rgba(166,179,0,0.22)', background: '#121212' }}>
          <img
            src={image}
            alt={label}
            className="w-full object-cover"
            style={{ height: 'min(48vw, 280px)' }}
            draggable={false}
          />
          <div className="px-4 py-3.5 text-center" style={{ background: 'rgba(166,179,0,0.1)' }}>
            <p className="text-lg font-extrabold tracking-tight" style={{ color: '#C0D900' }}>{label}</p>
          </div>
        </div>

        <div className="mt-4 flex items-start justify-between gap-4 px-1">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Pickup</p>
            <p className="text-sm font-semibold text-white/80 truncate">{pickupLabel || 'Store'}</p>
          </div>
          <div className="flex-1 min-w-0 text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Delivery</p>
            <p className="text-sm font-semibold text-white/80 truncate">{deliveryLabel || 'You'}</p>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-white/40">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #808000, #C0D900)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
