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

/**
 * Image-based tracking sequence:
 * reached store → picked up → on the way → arrived → delivered
 */
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
    <div className="relative flex h-full flex-col justify-center overflow-hidden bg-black px-4 py-4">
      <div className="mx-auto w-full max-w-sm">
        <div className="overflow-hidden rounded-3xl" style={{ border: '1px solid rgba(166,179,0,0.2)' }}>
          <img
            src={image}
            alt={label}
            className="w-full h-48 object-cover"
            draggable={false}
          />
          <div className="px-4 py-3 text-center" style={{ background: 'rgba(166,179,0,0.08)' }}>
            <p className="text-base font-bold" style={{ color: '#C4D600' }}>{label}</p>
          </div>
        </div>

        <div className="mt-4 flex items-start justify-between gap-4 px-1">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-white/40">Pickup</p>
            <p className="text-xs font-medium text-white/70 truncate">{pickupLabel || 'Store'}</p>
          </div>
          <div className="flex-1 min-w-0 text-right">
            <p className="text-[10px] uppercase tracking-wider text-white/40">Delivery</p>
            <p className="text-xs font-medium text-white/70 truncate">{deliveryLabel || 'You'}</p>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[10px] text-white/40">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #808000, #a8c020)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
