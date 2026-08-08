import type { LatLng } from '../../lib/mapUtils'
import { Images } from '../../lib/customImages'
import { pg } from '../../design/tokens'

export type MapMarker = {
  id: string
  position: LatLng
  kind?: 'user' | 'bike' | 'pickup' | 'destination' | 'dp'
  label?: string
}

type Props = {
  center?: LatLng | null
  zoom?: number
  destination?: LatLng | null
  markers?: MapMarker[]
  /** Search / visibility radius in meters (default 10 km) */
  radiusMeters?: number
  className?: string
  style?: React.CSSProperties
  interactive?: boolean
}

const DEFAULT_RADIUS_M = 10_000

/** Web Mercator helpers — project lat/lng to overlay % within current viewport */
function project(lat: number, lng: number, center: LatLng, zoom: number, widthPx: number, heightPx: number) {
  const scale = 256 * Math.pow(2, zoom)
  const world = (la: number, ln: number) => {
    const x = ((ln + 180) / 360) * scale
    const sin = Math.sin((la * Math.PI) / 180)
    const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale
    return { x, y }
  }
  const c = world(center.lat, center.lng)
  const p = world(lat, lng)
  const left = ((p.x - c.x) / widthPx) * 100 + 50
  const top = ((p.y - c.y) / heightPx) * 100 + 50
  return { left, top }
}

function haversineM(a: LatLng, b: LatLng) {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/**
 * Google Maps live street view + overlay pins for User / DP within radius.
 * No OpenStreetMap / MapLibre / Leaflet.
 */
export default function FreeStreetMap({
  center,
  zoom = 13,
  destination,
  markers = [],
  radiusMeters = DEFAULT_RADIUS_M,
  className = '',
  style,
}: Props) {
  const c =
    center ||
    markers.find(m => m.kind === 'user')?.position ||
    { lat: 17.385, lng: 78.4867 }

  const dest =
    destination ||
    markers.find(m => m.kind === 'destination')?.position ||
    null
  const pickup = markers.find(m => m.kind === 'pickup')?.position || null

  // Keep zoom readable for ~10 km radius
  const z = radiusMeters >= 8000 ? Math.min(zoom, 12) : zoom

  let src: string
  if (dest) {
    const from = pickup || c
    src = `https://www.google.com/maps?saddr=${from.lat},${from.lng}&daddr=${dest.lat},${dest.lng}&hl=en&z=${z}&output=embed`
  } else {
    src = `https://www.google.com/maps?q=${c.lat},${c.lng}&hl=en&z=${z}&output=embed`
  }

  // Assume map container ~390x520 for overlay math (mobile); CSS % still works reasonably
  const W = 390
  const H = 520

  const nearby = markers.filter(m => {
    if (m.kind === 'user') return true
    if (m.kind === 'pickup' || m.kind === 'destination') return true
    return haversineM(c, m.position) <= radiusMeters
  })

  const dpCount = nearby.filter(m => m.kind === 'bike' || m.kind === 'dp').length

  // Radius ring size as % of map height (approx meters → pixels at zoom)
  const metersPerPx = (156543.03392 * Math.cos((c.lat * Math.PI) / 180)) / Math.pow(2, z)
  const radiusPx = radiusMeters / Math.max(metersPerPx, 0.1)
  const radiusPct = Math.min(90, (radiusPx / H) * 100 * 2)

  return (
    <div
      className={`relative overflow-hidden bg-[#0B0B0B] ${className}`}
      style={{ width: '100%', height: '100%', minHeight: 200, ...style }}
    >
      <iframe
        title="Google Maps live tracking"
        src={src}
        className="absolute inset-0 h-full w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />

      {/* 10 km (or configured) range ring */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: `${radiusPct}%`,
          height: `${radiusPct}%`,
          border: '2px solid rgba(212,240,0,0.45)',
          background: 'rgba(212,240,0,0.06)',
          boxShadow: '0 0 0 1px rgba(212,240,0,0.15)',
        }}
      />

      {/* Live pins */}
      {nearby.map(m => {
        const { left, top } = project(m.position.lat, m.position.lng, c, z, W, H)
        if (left < -5 || left > 105 || top < -5 || top > 105) return null
        const isDp = m.kind === 'bike' || m.kind === 'dp'
        const isUser = m.kind === 'user'
        return (
          <div
            key={m.id}
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${left}%`, top: `${top}%` }}
          >
            {isDp ? (
              <img
                src={Images.bikeMarker}
                alt=""
                className="h-9 w-9 object-contain drop-shadow-lg"
                draggable={false}
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            ) : (
              <div
                className="flex h-4 w-4 items-center justify-center rounded-full"
                style={{
                  background: isUser ? pg.lime : m.kind === 'pickup' ? '#F5A524' : '#3B82F6',
                  boxShadow: '0 0 0 4px rgba(0,0,0,0.35)',
                }}
              />
            )}
            {m.label && (
              <p
                className="mt-0.5 max-w-[88px] truncate rounded-md px-1.5 py-0.5 text-[9px] font-bold"
                style={{ background: 'rgba(5,5,5,0.85)', color: '#fff' }}
              >
                {m.label}
              </p>
            )}
          </div>
        )
      })}

      <div
        className="pointer-events-none absolute left-3 top-3 rounded-full px-3 py-1.5 text-[11px] font-bold"
        style={{
          background: 'rgba(11,11,11,0.9)',
          color: pg.lime,
          border: '1px solid rgba(212,240,0,0.4)',
        }}
      >
        Google Maps · Live
        {center ? ' · GPS on' : ''}
        {` · ${Math.round(radiusMeters / 1000)} km`}
        {dpCount > 0 ? ` · ${dpCount} DP` : ''}
      </div>
    </div>
  )
}
