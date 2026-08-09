import { getTrackingStepImage, Images } from '../lib/customImages'
import { pg } from '../design/tokens'

export const STATUS_PROGRESS: Record<string, number> = {
  pending: 0, accepted: 12, confirmed: 12, task_started: 12, shopping: 28, purchased: 45,
  on_the_way: 68, arrived: 88, delivered: 100, cash_received: 100, completed: 100,
}

export const STATUS_ETA: Record<string, string> = {
  pending: 'Waiting...', accepted: 'Reached store', confirmed: 'Reached store', task_started: 'Reached store', shopping: 'Reached store',
  purchased: 'Order picked up', on_the_way: 'On the way', arrived: 'Arrived',
  delivered: 'Delivered', cash_received: 'Delivered', completed: 'Done',
}

const STEP_LABELS: Record<string, string> = {
  accepted: 'Reached store', confirmed: 'Reached store', task_started: 'Reached store', shopping: 'Reached store',
  purchased: 'Order picked up', on_the_way: 'On the way', arrived: 'Arrived',
  delivered: 'Delivered', cash_received: 'Delivered', completed: 'Delivered',
}

/** Rebuilt tracking media stage — large step art + optional progress */
export default function VisualTracking({
  progress,
  status,
  pickupLabel,
  deliveryLabel,
  hideProgress = false,
  compact = false,
}: {
  progress: number
  status: string
  vehicleType?: string
  dpName?: string
  pickupLabel?: string
  deliveryLabel?: string
  eta?: string
  hideProgress?: boolean
  compact?: boolean
}) {
  const image = getTrackingStepImage(status) || Images.tracking
  const label = STEP_LABELS[status] || STATUS_ETA[status] || 'In Progress'

  return (
    <div className={`flex flex-col justify-center px-3 ${compact ? 'py-1.5' : 'py-3'}`} style={{ background: pg.bg }}>
      <div className="mx-auto w-full max-w-lg">
        <div
          className="overflow-hidden"
          style={{ borderRadius: compact ? 22 : 28, border: `1px solid rgba(245,197,66,0.22)`, background: '#000' }}
        >
          <div
            className="flex w-full items-center justify-center"
            style={{
              minHeight: compact ? 120 : 200,
              maxHeight: compact ? 160 : 280,
              background: '#000',
            }}
          >
            <img
              src={image}
              alt={label}
              className="h-auto max-w-full object-contain"
              style={{ maxHeight: compact ? 160 : 280, background: '#000' }}
              draggable={false}
            />
          </div>
          <div className="px-4 py-3 text-center" style={{ background: pg.limeDim }}>
            <p className={`font-extrabold tracking-tight ${compact ? 'text-base' : 'text-lg'}`} style={{ color: pg.lime }}>
              {label}
            </p>
          </div>
        </div>

        {!hideProgress && (
          <>
            <div className="mt-4 flex justify-between gap-4 px-1">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: pg.text4 }}>Pickup</p>
                <p className="truncate text-sm font-bold" style={{ color: pg.text2 }}>{pickupLabel || 'Store'}</p>
              </div>
              <div className="min-w-0 flex-1 text-right">
                <p className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: pg.text4 }}>Delivery</p>
                <p className="truncate text-sm font-bold" style={{ color: pg.text2 }}>{deliveryLabel || 'You'}</p>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-[11px] font-bold" style={{ color: pg.text4 }}>
                <span>Progress</span><span>{progress}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${progress}%`, background: `linear-gradient(90deg,#E8B84A,${pg.lime})` }}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
