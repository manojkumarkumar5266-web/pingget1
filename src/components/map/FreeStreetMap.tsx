import type { LatLng } from '../../lib/mapUtils'

export type MapMarker = {
  id: string
  position: LatLng
  kind?: 'user' | 'bike' | 'pickup' | 'destination' | 'dp'
  label?: string
}

type Props = {
  center?: LatLng | null
  zoom?: number
  /** Optional second point — shows directions street map */
  destination?: LatLng | null
  markers?: MapMarker[]
  radiusMeters?: number
  className?: string
  style?: React.CSSProperties
  interactive?: boolean
}

/**
 * Normal Google street map (recognizable roads/buildings).
 * Uses live GPS center so User & DP locations are detected on the map.
 * No OpenStreetMap / MapLibre.
 */
export default function FreeStreetMap({
  center,
  zoom = 15,
  destination,
  markers = [],
  className = '',
  style,
}: Props) {
  const c = center || markers.find(m => m.kind === 'user')?.position || { lat: 17.385, lng: 78.4867 }
  const dest =
    destination ||
    markers.find(m => m.kind === 'destination')?.position ||
    null
  const pickup = markers.find(m => m.kind === 'pickup')?.position || null

  let src: string
  if (dest) {
    const from = pickup || c
    src = `https://www.google.com/maps?saddr=${from.lat},${from.lng}&daddr=${dest.lat},${dest.lng}&hl=en&z=${zoom}&output=embed`
  } else {
    src = `https://www.google.com/maps?q=${c.lat},${c.lng}&hl=en&z=${zoom}&output=embed`
  }

  const bikeCount = markers.filter(m => m.kind === 'bike' || m.kind === 'dp').length

  return (
    <div
      className={`relative overflow-hidden bg-[#0B0B0B] ${className}`}
      style={{ width: '100%', height: '100%', minHeight: 200, ...style }}
    >
      <iframe
        title="Street map"
        src={src}
        className="absolute inset-0 h-full w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
      {/* Location detect chip */}
      <div
        className="pointer-events-none absolute left-3 top-3 rounded-full px-3 py-1.5 text-[11px] font-bold"
        style={{ background: 'rgba(11,11,11,0.88)', color: '#C0D900', border: '1px solid rgba(212,240,0,0.4)' }}
      >
        {center ? '📍 Live location' : 'Map'}
        {bikeCount > 0 ? ` · ${bikeCount} nearby` : ''}
      </div>
    </div>
  )
}
