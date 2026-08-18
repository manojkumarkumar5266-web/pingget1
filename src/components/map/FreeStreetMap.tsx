import { useMemo, useRef, useState } from 'react'
import type { LatLng, VehicleType } from '../../lib/mapUtils'
import { normalizeVehicle } from '../../lib/mapUtils'

export type MapMarker = {
  id: string
  position: LatLng
  kind?: 'user' | 'bike' | 'pickup' | 'destination' | 'dp'
  label?: string
  vehicleType?: string | null
}

type Props = {
  center?: LatLng | null
  zoom?: number
  destination?: LatLng | null
  markers?: MapMarker[]
  routeLine?: LatLng[] | null
  radiusMeters?: number
  hideRadius?: boolean
  hideBadge?: boolean
  light?: boolean
  radar?: boolean
  instant?: boolean
  className?: string
  style?: React.CSSProperties
  interactive?: boolean
}

export const MAP_VIEW_RADIUS_M = 4_000
export const SCAN_BACKEND_RADIUS_M = 10_000
const DEFAULT_ZOOM = 15
const TILE = 256

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

function PinShell({ color, children, size = 44 }: { color: string; children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden className="drop-shadow-lg">
      <circle cx="22" cy="22" r="20" fill={color} />
      <circle cx="22" cy="22" r="14" fill="#FFFFFF" fillOpacity="0.12" />
      <circle cx="22" cy="22" r="20" fill="none" stroke="#FFFFFF" strokeOpacity="0.4" strokeWidth="2" />
      {children}
    </svg>
  )
}

/** Modern delivery scooter / bike */
function BikePin({ size = 44, color = '#0C8A3E' }: { size?: number; color?: string }) {
  return (
    <PinShell color={color} size={size}>
      <g transform="translate(5 6)">
        <circle cx="9" cy="24" r="5.2" fill="none" stroke="#fff" strokeWidth="2.2" />
        <circle cx="25" cy="24" r="5.2" fill="none" stroke="#fff" strokeWidth="2.2" />
        <path d="M9 24h7.5l3.2-8.2h6.2" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16.5 24l3-8.2" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M19.5 15.8h6.5" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M13.2 15.8h4.2" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
        <rect x="24.5" y="10.2" width="5.2" height="3.2" rx="1" fill="#fff" />
        <circle cx="17.8" cy="15.8" r="1.5" fill="#fff" />
      </g>
    </PinShell>
  )
}

/** Modern city bicycle */
function BicyclePin({ size = 44 }: { size?: number }) {
  return (
    <PinShell color="#16A34A" size={size}>
      <g transform="translate(4 7)">
        <circle cx="8" cy="23" r="5.5" fill="none" stroke="#fff" strokeWidth="2.2" />
        <circle cx="28" cy="23" r="5.5" fill="none" stroke="#fff" strokeWidth="2.2" />
        <path d="M8 23h8l4.5-9h5" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 23l3.8-9" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M19.8 14h7" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M23.5 14V9.5" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M21.5 9.5h4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M11.5 14h5" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      </g>
    </PinShell>
  )
}

/** Modern sedan */
function CarPin({ size = 44 }: { size?: number }) {
  return (
    <PinShell color="#F59E0B" size={size}>
      <g transform="translate(5 8)">
        <path
          d="M4 20h26v2.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V20z"
          fill="#fff"
          fillOpacity="0.25"
        />
        <path
          d="M5 19.5l2.2-7.2A3 3 0 0 1 10.1 10h13.8a3 3 0 0 1 2.9 2.3L29 19.5H5z"
          fill="#fff"
        />
        <path d="M11 10.4l1.4-2.8h9.2L23 10.4" fill="none" stroke="#F59E0B" strokeWidth="1.4" strokeLinejoin="round" />
        <circle cx="10" cy="20.2" r="2.6" fill="#0B0B0B" />
        <circle cx="24" cy="20.2" r="2.6" fill="#0B0B0B" />
        <circle cx="10" cy="20.2" r="1.1" fill="#fff" />
        <circle cx="24" cy="20.2" r="1.1" fill="#fff" />
        <rect x="12.5" y="12.2" width="4.2" height="3.2" rx="0.6" fill="#F59E0B" fillOpacity="0.55" />
        <rect x="18" y="12.2" width="4.2" height="3.2" rx="0.6" fill="#F59E0B" fillOpacity="0.55" />
      </g>
    </PinShell>
  )
}

/** Modern auto-rickshaw */
function AutoPin({ size = 44 }: { size?: number }) {
  return (
    <PinShell color="#EF4444" size={size}>
      <g transform="translate(6 7)">
        <path d="M4 21h24v1.8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V21z" fill="#fff" fillOpacity="0.2" />
        <path d="M5 20.5l1.8-8.2A2.5 2.5 0 0 1 9.2 10h13.6a2.5 2.5 0 0 1 2.4 2.3L27 20.5H5z" fill="#fff" />
        <path d="M10 10.2l1.2-3.2h9.6L22 10.2" fill="none" stroke="#EF4444" strokeWidth="1.5" />
        <path d="M16 7v3.2" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="10.5" cy="21" r="2.5" fill="#0B0B0B" />
        <circle cx="22.5" cy="21" r="2.5" fill="#0B0B0B" />
        <circle cx="10.5" cy="21" r="1" fill="#fff" />
        <circle cx="22.5" cy="21" r="1" fill="#fff" />
      </g>
    </PinShell>
  )
}

function TruckPin({ size = 44 }: { size?: number }) {
  return (
    <PinShell color="#64748B" size={size}>
      <g transform="translate(5 8)">
        <rect x="2" y="9" width="18" height="12" rx="1.5" fill="#fff" />
        <path d="M20 13h6l3 4v4h-9v-8z" fill="#fff" />
        <circle cx="9" cy="23" r="2.6" fill="#0B0B0B" />
        <circle cx="24" cy="23" r="2.6" fill="#0B0B0B" />
        <circle cx="9" cy="23" r="1" fill="#fff" />
        <circle cx="24" cy="23" r="1" fill="#fff" />
      </g>
    </PinShell>
  )
}

function WalkingPin({ size = 44 }: { size?: number }) {
  return (
    <PinShell color="#8B5CF6" size={size}>
      <g fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="22" cy="12" r="3.2" fill="#fff" stroke="none" />
        <path d="M22 16.5v8" />
        <path d="M22 24.5l-4.5 7" />
        <path d="M22 24.5l4.5 7" />
        <path d="M17.5 20h9" />
      </g>
    </PinShell>
  )
}

function VehiclePin({ vehicle, size = 44 }: { vehicle?: string | null; size?: number }) {
  const v: VehicleType = normalizeVehicle(vehicle || null)
  if (v === 'bicycle') return <BicyclePin size={size} />
  if (v === 'car') return <CarPin size={size} />
  if (v === 'auto') return <AutoPin size={size} />
  if (v === 'truck') return <TruckPin size={size} />
  if (v === 'walking') return <WalkingPin size={size} />
  if (v === 'scooter') return <BikePin size={size} color="#2563EB" />
  return <BikePin size={size} color="#0C8A3E" />
}

type TileProvider = 'voyager' | 'osm' | 'esri_street'

function tileUrl(provider: TileProvider, z: number, x: number, y: number) {
  if (provider === 'esri_street') {
    // Esri World Street Map — roads, buildings, parks (XYZ uses /z/y/x)
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}`
  }
  if (provider === 'osm') {
    return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
  }
  // Carto Voyager — dark-grey roads, greenery, building blocks
  return `https://a.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`
}

/**
 * GPS basemap for scanning + tracking (User + DP).
 * White canvas with Carto Voyager — visible dark-grey roads, greenery, buildings.
 */
function StreetTileBasemap({ center, zoom }: { center: LatLng; zoom: number }) {
  const [provider, setProvider] = useState<TileProvider>('voyager')
  const failCount = useRef(0)
  const z = Math.max(13, Math.min(16, Math.round(zoom)))
  const { x: cx, y: cy } = latLngToTile(center.lat, center.lng, z)
  const tileX = Math.floor(cx)
  const tileY = Math.floor(cy)
  const fracX = cx - tileX
  const fracY = cy - tileY
  const range = [-1, 0, 1]
  const originLeft = 50 - (fracX + 1) * (100 / 3)
  const originTop = 50 - (fracY + 1) * (100 / 3)

  const onTileError = () => {
    failCount.current += 1
    if (failCount.current < 2) return
    failCount.current = 0
    setProvider(prev => {
      if (prev === 'voyager') return 'osm'
      if (prev === 'osm') return 'esri_street'
      return prev
    })
  }

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: '#FFFFFF' }}>
      <div
        className="absolute"
        style={{
          left: `${originLeft}%`,
          top: `${originTop}%`,
          width: '300%',
          height: '300%',
        }}
      >
        {range.map((dy) =>
          range.map((dx) => {
            const tx = tileX + dx
            const ty = tileY + dy
            const n = Math.pow(2, z)
            if (ty < 0 || ty >= n) return null
            const wx = ((tx % n) + n) % n
            const src = tileUrl(provider, z, wx, ty)
            return (
              <img
                key={`${provider}-${z}-${wx}-${ty}`}
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
                  filter: 'contrast(1.08) saturate(1.05)',
                }}
                loading="eager"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={onTileError}
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
  className = '',
  style,
}: Props) {
  const c =
    center ||
    markers.find(m => m.kind === 'user')?.position ||
    markers.find(m => m.kind === 'bike')?.position ||
    { lat: 17.385, lng: 78.4867 }

  const viewRadius = Math.min(Math.max(radiusMeters, 2_000), 5_000)
  const z = Math.max(14, Math.min(16, Math.round(zoom || DEFAULT_ZOOM)))

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
      className={`free-street-map relative overflow-hidden ${light ? 'light-map' : ''} ${className}`}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 200,
        background: '#FFFFFF',
        ...style,
      }}
    >
      <StreetTileBasemap center={c} zoom={z} />

      {routeSvgPoints && (
        <svg className="pointer-events-none absolute inset-0 z-[5] h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polyline
            points={routeSvgPoints}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            opacity={0.98}
          />
          <polyline
            points={routeSvgPoints}
            fill="none"
            stroke="#0C8A3E"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            opacity={1}
          />
          <polyline
            points={routeSvgPoints}
            fill="none"
            stroke="#E53935"
            strokeWidth="0.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="2 1.4"
            vectorEffect="non-scaling-stroke"
            opacity={0.95}
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
                <VehiclePin vehicle={m.vehicleType} size={44} />
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
