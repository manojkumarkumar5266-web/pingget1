import { useMemo, useRef } from 'react'
import type { LatLng, VehicleType } from '../../lib/mapUtils'
import { normalizeVehicle } from '../../lib/mapUtils'

export type MapMarker = {
  id: string
  position: LatLng
  kind?: 'user' | 'bike' | 'pickup' | 'destination' | 'dp'
  label?: string
  /** DP vehicle — drives map pin art */
  vehicleType?: string | null
}

type Props = {
  center?: LatLng | null
  zoom?: number
  destination?: LatLng | null
  markers?: MapMarker[]
  routeLine?: LatLng[] | null
  /** Visual search/view ring only (2–5 km). Backend scan stays separate. */
  radiusMeters?: number
  hideRadius?: boolean
  /** Hide the built-in Live map chip (avoids overlapping ETA overlays). */
  hideBadge?: boolean
  light?: boolean
  radar?: boolean
  /** Prefer street tiles (no CSS grid). Default true for light/radar/route maps. */
  instant?: boolean
  className?: string
  style?: React.CSSProperties
  interactive?: boolean
}

/** Visual map area — keep ~2–5 km on screen (do not expand to 10 km). */
export const MAP_VIEW_RADIUS_M = 4_000
/** Backend scanning radius for nearby DPs. */
export const SCAN_BACKEND_RADIUS_M = 10_000
const DEFAULT_ZOOM = 14
const TILE = 256

function stableCoord(n: number, places = 4) {
  const f = 10 ** places
  return Math.round(n * f) / f
}

function project(lat: number, lng: number, center: LatLng, zoom: number, widthPx: number, heightPx: number) {
  const scale = TILE * Math.pow(2, zoom)
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

function latLngToTile(lat: number, lng: number, zoom: number) {
  const n = Math.pow(2, zoom)
  const x = ((lng + 180) / 360) * n
  const latRad = (lat * Math.PI) / 180
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  return { x, y }
}

function RedUserPin() {
  return (
    <svg width="28" height="36" viewBox="0 0 28 36" fill="none" aria-hidden>
      <path
        d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.268 21.732 0 14 0z"
        fill="#E53935"
      />
      <circle cx="14" cy="13.5" r="5.5" fill="#fff" />
    </svg>
  )
}

function PinShell({ color, children, size = 40 }: { color: string; children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden className="drop-shadow-md">
      <circle cx="20" cy="20" r="19" fill={color} />
      <circle cx="20" cy="20" r="19" fill="none" stroke="#0B0B0B" strokeOpacity="0.2" strokeWidth="1.5" />
      {children}
    </svg>
  )
}

/** Motorbike / scooter silhouette */
function BikePin({ size = 40, color = '#0C8A3E' }: { size?: number; color?: string }) {
  return (
    <PinShell color={color} size={size}>
      <g fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="26" r="5" />
        <circle cx="28" cy="26" r="5" />
        <path d="M12 26h7l4-9h5" />
        <path d="M19 26l4-9" />
        <path d="M23 17h5" />
        <path d="M16 17h4" />
        <circle cx="20" cy="17" r="1.6" fill="#FFFFFF" stroke="none" />
      </g>
    </PinShell>
  )
}

function BicyclePin({ size = 40 }: { size?: number }) {
  return (
    <PinShell color="#22c55e" size={size}>
      <g fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="25" r="5.5" />
        <circle cx="29" cy="25" r="5.5" />
        <path d="M11 25h6l4-8h4" />
        <path d="M17 25l3-8" />
        <path d="M21 17h6" />
        <path d="M24 17v-3" />
        <path d="M14 17h5" />
      </g>
    </PinShell>
  )
}

function CarPin({ size = 40 }: { size?: number }) {
  return (
    <PinShell color="#f59e0b" size={size}>
      <g fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 24h24" />
        <path d="M10 24l2-8h16l2 8" />
        <path d="M12 16l2-4h12l2 4" />
        <circle cx="13" cy="24" r="2.5" fill="#FFFFFF" stroke="none" />
        <circle cx="27" cy="24" r="2.5" fill="#FFFFFF" stroke="none" />
        <path d="M14 16h4M22 16h4" />
      </g>
    </PinShell>
  )
}

function AutoPin({ size = 40 }: { size?: number }) {
  return (
    <PinShell color="#ef4444" size={size}>
      <g fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 25h18" />
        <path d="M12 25l1.5-7h13L28 25" />
        <path d="M14 18l1.5-4h9L26 18" />
        <circle cx="14.5" cy="25" r="2.4" fill="#FFFFFF" stroke="none" />
        <circle cx="25.5" cy="25" r="2.4" fill="#FFFFFF" stroke="none" />
        <path d="M20 14v4" />
      </g>
    </PinShell>
  )
}

function TruckPin({ size = 40 }: { size?: number }) {
  return (
    <PinShell color="#6b7280" size={size}>
      <g fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 24h16v-10H8z" />
        <path d="M24 18h5l3 4v2h-8z" />
        <circle cx="13" cy="26" r="2.5" fill="#FFFFFF" stroke="none" />
        <circle cx="27" cy="26" r="2.5" fill="#FFFFFF" stroke="none" />
      </g>
    </PinShell>
  )
}

function WalkingPin({ size = 40 }: { size?: number }) {
  return (
    <PinShell color="#8b5cf6" size={size}>
      <g fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="20" cy="12" r="3" />
        <path d="M20 15v7" />
        <path d="M20 22l-4 6" />
        <path d="M20 22l4 6" />
        <path d="M16 18h8" />
      </g>
    </PinShell>
  )
}

function VehiclePin({ vehicle, size = 40 }: { vehicle?: string | null; size?: number }) {
  const v: VehicleType = normalizeVehicle(vehicle || null)
  if (v === 'bicycle') return <BicyclePin size={size} />
  if (v === 'car') return <CarPin size={size} />
  if (v === 'auto') return <AutoPin size={size} />
  if (v === 'truck') return <TruckPin size={size} />
  if (v === 'walking') return <WalkingPin size={size} />
  if (v === 'scooter') return <BikePin size={size} color="#3b82f6" />
  return <BikePin size={size} color="#0C8A3E" />
}

/**
 * Street tiles — OSM standard has darker road lines than Carto Voyager.
 * Extra contrast filter further darkens roadways for readability.
 */
function StreetTileBasemap({ center, zoom }: { center: LatLng; zoom: number }) {
  const z = Math.max(11, Math.min(16, Math.round(zoom)))
  const { x: cx, y: cy } = latLngToTile(center.lat, center.lng, z)
  const tileX = Math.floor(cx)
  const tileY = Math.floor(cy)
  const fracX = cx - tileX
  const fracY = cy - tileY
  const range = [-1, 0, 1]
  const originLeft = 50 - (fracX + 1) * (100 / 3)
  const originTop = 50 - (fracY + 1) * (100 / 3)

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: '#D9E2EC' }}>
      <div
        className="absolute"
        style={{
          left: `${originLeft}%`,
          top: `${originTop}%`,
          width: '300%',
          height: '300%',
          filter: 'contrast(1.42) saturate(1.08) brightness(0.88)',
        }}
      >
        {range.map((dy) =>
          range.map((dx) => {
            const tx = tileX + dx
            const ty = tileY + dy
            const n = Math.pow(2, z)
            if (ty < 0 || ty >= n) return null
            const wx = ((tx % n) + n) % n
            // Carto Voyager + contrast filter → darker, clearer road lines
            const src = `https://a.basemaps.cartocdn.com/rastertiles/voyager/${z}/${wx}/${ty}.png`
            return (
              <img
                key={`${z}-${wx}-${ty}`}
                src={src}
                alt=""
                draggable={false}
                className="absolute"
                style={{
                  left: `${(dx + 1) * (100 / 3)}%`,
                  top: `${(dy + 1) * (100 / 3)}%`,
                  width: `${100 / 3}%`,
                  height: `${100 / 3}%`,
                  imageRendering: 'auto',
                }}
                loading="eager"
                decoding="async"
              />
            )
          }),
        )}
      </div>
    </div>
  )
}

export default function FreeStreetMap({
  center,
  zoom = DEFAULT_ZOOM,
  destination,
  markers = [],
  routeLine = null,
  radiusMeters = MAP_VIEW_RADIUS_M,
  hideRadius = false,
  hideBadge = false,
  light = false,
  radar = false,
  instant = false,
  className = '',
  style,
}: Props) {
  const c =
    center ||
    markers.find(m => m.kind === 'user')?.position ||
    markers.find(m => m.kind === 'bike')?.position ||
    { lat: 17.385, lng: 78.4867 }

  const dest =
    destination ||
    markers.find(m => m.kind === 'destination')?.position ||
    null
  const pickup = markers.find(m => m.kind === 'pickup')?.position || null

  const viewRadius = Math.min(Math.max(radiusMeters, 2_000), 5_000)
  const z = Math.max(13, Math.min(15, Math.round(zoom || DEFAULT_ZOOM)))
  const useStreetTiles = true

  const googleSrc = useMemo(() => {
    if (useStreetTiles) return null
    if (dest) {
      const from = pickup || c
      return `https://www.google.com/maps?saddr=${stableCoord(from.lat)},${stableCoord(from.lng)}&daddr=${stableCoord(dest.lat)},${stableCoord(dest.lng)}&hl=en&z=${z}&output=embed`
    }
    return `https://www.google.com/maps?q=${stableCoord(c.lat)},${stableCoord(c.lng)}&hl=en&z=${z}&output=embed`
  }, [useStreetTiles, c.lat, c.lng, dest?.lat, dest?.lng, pickup?.lat, pickup?.lng, z])

  const lastGoogle = useRef(googleSrc)
  if (googleSrc) lastGoogle.current = googleSrc

  const W = 390
  const H = 520

  const nearby = markers.filter(m => {
    if (m.kind === 'user' || m.kind === 'bike' || m.kind === 'dp') return true
    if (m.kind === 'pickup' || m.kind === 'destination') return true
    return haversineM(c, m.position) <= viewRadius
  })

  const dpCount = nearby.filter(m => m.kind === 'bike' || m.kind === 'dp').length
  const metersPerPx = (156543.03392 * Math.cos((c.lat * Math.PI) / 180)) / Math.pow(2, z)
  const radiusPx = viewRadius / Math.max(metersPerPx, 0.1)
  const radiusPct = Math.min(92, (radiusPx / H) * 100 * 2)

  const routeSvgPoints = useMemo(() => {
    if (!routeLine || routeLine.length < 2) return ''
    const step = Math.max(1, Math.floor(routeLine.length / 48))
    const pts = routeLine.filter((_, i) => i % step === 0 || i === routeLine.length - 1)
    return pts
      .map(p => {
        const { left, top } = project(p.lat, p.lng, c, z, W, H)
        return `${left},${top}`
      })
      .join(' ')
  }, [routeLine, c.lat, c.lng, z])

  return (
    <div
      className={`free-street-map relative overflow-hidden ${light || useStreetTiles ? 'light-map' : ''} ${className}`}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 200,
        background: light || useStreetTiles ? '#D9E2EC' : '#0B0B0B',
        ...style,
      }}
    >
      {useStreetTiles ? (
        <StreetTileBasemap center={c} zoom={z} />
      ) : (
        <iframe
          key={lastGoogle.current || 'gmap'}
          title="Google Maps live tracking"
          src={lastGoogle.current || undefined}
          className="absolute inset-0 h-full w-full border-0"
          loading="eager"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      )}

      {routeSvgPoints && (
        <svg className="pointer-events-none absolute inset-0 z-[5] h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polyline
            points={routeSvgPoints}
            fill="none"
            stroke="#0C8A3E"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            opacity={0.95}
          />
          <polyline
            points={routeSvgPoints}
            fill="none"
            stroke="#E53935"
            strokeWidth="0.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="2 1.4"
            vectorEffect="non-scaling-stroke"
            opacity={0.9}
          />
        </svg>
      )}

      {!hideRadius && !routeLine && (
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: `${radiusPct}%`,
            height: `${radiusPct}%`,
            border: '1.5px solid rgba(229,57,53,0.3)',
            background: 'rgba(229,57,53,0.05)',
          }}
        />
      )}

      {radar && (
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ width: `${radiusPct}%`, height: `${radiusPct}%` }}
        >
          <span className="radar-ring" />
          <span className="radar-ring" />
          <span className="radar-ring" />
        </div>
      )}

      {nearby.map(m => {
        const { left, top } = project(m.position.lat, m.position.lng, c, z, W, H)
        if (left < -8 || left > 108 || top < -8 || top > 108) return null
        const isDp = m.kind === 'bike' || m.kind === 'dp'
        const isUser = m.kind === 'user'
        return (
          <div
            key={m.id}
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full"
            style={{ left: `${left}%`, top: `${top}%` }}
          >
            {isUser ? (
              <div className="-mb-1">
                <RedUserPin />
              </div>
            ) : isDp ? (
              <div className="translate-y-1/2">
                <VehiclePin vehicle={m.vehicleType} size={40} />
              </div>
            ) : (
              <div
                className="mb-0 flex h-4 w-4 translate-y-1/2 items-center justify-center rounded-full"
                style={{
                  background: m.kind === 'pickup' ? '#F5A524' : '#3B82F6',
                  boxShadow: '0 0 0 4px rgba(0,0,0,0.2)',
                }}
              />
            )}
            {m.label && !isUser && (
              <p
                className="mt-0.5 max-w-[88px] truncate rounded-md px-1.5 py-0.5 text-[9px] font-bold"
                style={{ background: 'rgba(0,0,0,0.94)', color: '#F5F7F6', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                {m.label}
              </p>
            )}
          </div>
        )
      })}

      {!hideBadge && (
        <div
          className="pointer-events-none absolute left-3 top-3 rounded-full px-3 py-1.5 text-[11px] font-bold"
          style={{
            background: 'rgba(0,0,0,0.94)',
            color: '#C62828',
            border: '1px solid rgba(229,57,53,0.35)',
          }}
        >
          {routeLine ? 'Live tracking' : 'Live map'}
          {center ? ' · GPS on' : ''}
          {dpCount > 0 ? ` · ${dpCount} DP` : ''}
        </div>
      )}
    </div>
  )
}
