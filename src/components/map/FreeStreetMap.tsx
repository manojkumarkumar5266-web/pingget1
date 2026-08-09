import { useMemo, useRef, useState } from 'react'
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
  /** Polyline points (lat/lng) drawn between DP ↔ user */
  routeLine?: LatLng[] | null
  /** Search / visibility radius in meters (default 10 km) */
  radiusMeters?: number
  /** Hide radius ring (use for live tracking) */
  hideRadius?: boolean
  /** Light white map with warm street tint (scanning) */
  light?: boolean
  /** Pulsing radar rings from center out to radius */
  radar?: boolean
  /**
   * Instant map mode for scanning — local light basemap + optional street tiles.
   * No Google iframe (eliminates scan-page load lag).
   */
  instant?: boolean
  className?: string
  style?: React.CSSProperties
  interactive?: boolean
}

const DEFAULT_RADIUS_M = 10_000

function stableCoord(n: number, places = 3) {
  const f = 10 ** places
  return Math.round(n * f) / f
}

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

/** Optional street tiles — never blocks UI; fades in if available */
function streetTileUrl(lat: number, lng: number, zoom: number) {
  const clat = stableCoord(lat)
  const clng = stableCoord(lng)
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${clat},${clng}&zoom=${zoom}&size=640x480&maptype=mapnik`
}

/** Instant white + yellow street grid — paints in 0ms, no network */
function InstantLightBasemap() {
  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundColor: '#F4F6F8',
        backgroundImage: [
          // major yellow streets (horizontal)
          'repeating-linear-gradient(0deg, transparent 0 46px, rgba(245,197,66,0.55) 46px 49px, transparent 49px 96px)',
          // major yellow streets (vertical)
          'repeating-linear-gradient(90deg, transparent 0 52px, rgba(245,197,66,0.5) 52px 55px, transparent 55px 108px)',
          // minor grey streets
          'repeating-linear-gradient(0deg, transparent 0 22px, rgba(180,188,198,0.45) 22px 23px, transparent 23px 48px)',
          'repeating-linear-gradient(90deg, transparent 0 24px, rgba(180,188,198,0.4) 24px 25px, transparent 25px 54px)',
          // soft blocks
          'radial-gradient(ellipse at 30% 40%, rgba(220,230,240,0.9), transparent 55%)',
          'radial-gradient(ellipse at 70% 65%, rgba(210,222,235,0.7), transparent 50%)',
        ].join(','),
      }}
    />
  )
}

/**
 * Street map + overlay pins.
 * Scanning (`instant` / light+radar): local light basemap — no Google iframe lag.
 */
export default function FreeStreetMap({
  center,
  zoom = 13,
  destination,
  markers = [],
  routeLine = null,
  radiusMeters = DEFAULT_RADIUS_M,
  hideRadius = false,
  light = false,
  radar = false,
  instant = false,
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

  // Lock zoom after first paint so the map never reloads mid-scan
  const lockedZoom = useRef<number | null>(null)
  const zBase = radiusMeters >= 8000 ? Math.min(zoom, 12) : zoom
  if (lockedZoom.current == null) lockedZoom.current = zBase
  // Live tracking with route: allow slightly tighter zoom, still locked
  const z = instant || light ? lockedZoom.current : zBase

  const useInstant = instant || light || !!routeLine
  const [tileReady, setTileReady] = useState(false)

  const tileSrc = useMemo(() => {
    if (!useInstant) return null
    return streetTileUrl(c.lat, c.lng, z)
  }, [useInstant, c.lat, c.lng, z])

  const googleSrc = useMemo(() => {
    if (useInstant) return null
    if (dest) {
      const from = pickup || c
      return `https://www.google.com/maps?saddr=${stableCoord(from.lat)},${stableCoord(from.lng)}&daddr=${stableCoord(dest.lat)},${stableCoord(dest.lng)}&hl=en&z=${z}&output=embed`
    }
    return `https://www.google.com/maps?q=${stableCoord(c.lat)},${stableCoord(c.lng)}&hl=en&z=${z}&output=embed`
  }, [useInstant, c.lat, c.lng, dest?.lat, dest?.lng, pickup?.lat, pickup?.lng, z])

  // Stabilize Google iframe src against GPS jitter
  const lastGoogle = useRef(googleSrc)
  if (googleSrc) lastGoogle.current = googleSrc

  const W = 390
  const H = 520

  const nearby = markers.filter(m => {
    if (m.kind === 'user' || m.kind === 'bike' || m.kind === 'dp') return true
    if (m.kind === 'pickup' || m.kind === 'destination') return true
    return haversineM(c, m.position) <= radiusMeters
  })

  const dpCount = nearby.filter(m => m.kind === 'bike' || m.kind === 'dp').length

  const metersPerPx = (156543.03392 * Math.cos((c.lat * Math.PI) / 180)) / Math.pow(2, z)
  const radiusPx = radiusMeters / Math.max(metersPerPx, 0.1)
  const radiusPct = Math.min(92, (radiusPx / H) * 100 * 2)

  const routeSvgPoints = useMemo(() => {
    if (!routeLine || routeLine.length < 2) return ''
    return routeLine
      .map(p => {
        const { left, top } = project(p.lat, p.lng, c, z, W, H)
        return `${left},${top}`
      })
      .join(' ')
  }, [routeLine, c.lat, c.lng, z])

  return (
    <div
      className={`free-street-map relative overflow-hidden ${light || useInstant ? 'light-map' : ''} ${className}`}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 200,
        background: light || useInstant ? '#F4F6F8' : '#0B0B0B',
        ...style,
      }}
    >
      {useInstant ? (
        <>
          <InstantLightBasemap />
          {tileSrc && (
            <img
              src={tileSrc}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
              style={{
                opacity: tileReady ? 0.92 : 0,
                filter: 'grayscale(0.4) brightness(1.25) contrast(1.06) saturate(0.4) sepia(0.1)',
              }}
              decoding="async"
              fetchPriority="low"
              draggable={false}
              onLoad={() => setTileReady(true)}
              onError={() => setTileReady(false)}
            />
          )}
        </>
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

      {(light || useInstant) && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,236,160,0.16) 50%, rgba(255,255,255,0.12) 100%)',
            mixBlendMode: 'soft-light',
          }}
        />
      )}

      {/* Route line DP ↔ user */}
      {routeSvgPoints && (
        <svg className="pointer-events-none absolute inset-0 z-[5] h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polyline
            points={routeSvgPoints}
            fill="none"
            stroke="#F5C542"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="0"
            vectorEffect="non-scaling-stroke"
            opacity={0.95}
          />
          <polyline
            points={routeSvgPoints}
            fill="none"
            stroke="#E53935"
            strokeWidth="0.55"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="2 1.5"
            vectorEffect="non-scaling-stroke"
            opacity={0.85}
          />
        </svg>
      )}

      {!hideRadius && !routeLine && (
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: `${radiusPct}%`,
            height: `${radiusPct}%`,
            border: light || useInstant ? '1.5px solid rgba(229,57,53,0.28)' : `2px solid rgba(245,197,66,0.4)`,
            background: light || useInstant ? 'rgba(229,57,53,0.04)' : 'rgba(245,197,66,0.05)',
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
              <div className="-mb-1 drop-shadow-md">
                <RedUserPin />
              </div>
            ) : isDp ? (
              <img
                src={Images.bikeMarker}
                alt=""
                className="mb-0 h-9 w-9 translate-y-1/2 object-contain drop-shadow-lg"
                draggable={false}
                onError={(e) => {
                  const el = e.target as HTMLImageElement
                  el.onerror = null
                  el.src =
                    'data:image/svg+xml,' +
                    encodeURIComponent(
                      '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#F5C542"/><path d="M10 22a4 4 0 1 0 0.01 0zm16 0a4 4 0 1 0 0.01 0zM12 22h8l3-7h-5l-2 4h-2z" fill="#140F05"/></svg>',
                    )
                }}
              />
            ) : (
              <div
                className="mb-0 flex h-4 w-4 translate-y-1/2 items-center justify-center rounded-full"
                style={{
                  background: m.kind === 'pickup' ? '#F5A524' : '#3B82F6',
                  boxShadow: '0 0 0 4px rgba(0,0,0,0.25)',
                }}
              />
            )}
            {m.label && !isUser && (
              <p
                className="mt-0.5 max-w-[88px] truncate rounded-md px-1.5 py-0.5 text-[9px] font-bold"
                style={{ background: 'rgba(7,8,11,0.88)', color: '#fff' }}
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
          background: light || useInstant ? 'rgba(255,255,255,0.92)' : 'rgba(11,11,11,0.9)',
          color: light || useInstant ? '#C62828' : pg.lime,
          border: light || useInstant ? '1px solid rgba(229,57,53,0.35)' : '1px solid rgba(245,197,66,0.4)',
        }}
      >
        {routeLine ? 'Live tracking' : useInstant ? 'Live map' : 'Google Maps · Live'}
        {center ? ' · GPS on' : ''}
        {dpCount > 0 ? ` · ${dpCount} DP` : ''}
      </div>
    </div>
  )
}
