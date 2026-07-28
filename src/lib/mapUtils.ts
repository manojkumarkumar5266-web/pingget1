import L from 'leaflet'

export const DEFAULT_CENTER: [number, number] = [17.385, 78.4867] // Hyderabad fallback
export const DEFAULT_ZOOM = 14

export const TILE_URL_LIGHT = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
export const TILE_URL_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
export const TILE_ATTR_LIGHT = '&copy; OpenStreetMap contributors'
export const TILE_ATTR_DARK = '&copy; OpenStreetMap contributors &copy; CARTO'

export const OSRM_BASE = 'https://router.project-osrm.org'

export type LatLng = { lat: number; lng: number }

export type VehicleType = 'motorbike' | 'scooter' | 'bicycle' | 'car' | 'auto' | 'walking' | 'truck'

export function normalizeVehicle(v: string | null): VehicleType {
  const s = (v || '').toLowerCase()
  if (s.includes('cycle') || s === 'bicycle') return 'bicycle'
  if (s.includes('scooter')) return 'scooter'
  if (s.includes('auto')) return 'auto'
  if (s.includes('car')) return 'car'
  if (s.includes('walk')) return 'walking'
  if (s.includes('truck')) return 'truck'
  return 'motorbike'
}

export function vehicleLabel(v: VehicleType): string {
  const labels: Record<VehicleType, string> = {
    motorbike: 'Bike',
    scooter: 'Scooter',
    bicycle: 'Cycle',
    car: 'Car',
    auto: 'Auto',
    walking: 'Walking',
    truck: 'Truck',
  }
  return labels[v]
}

export function vehicleColor(v: VehicleType): string {
  const colors: Record<VehicleType, string> = {
    motorbike: '#808000',
    scooter: '#3b82f6',
    bicycle: '#22c55e',
    car: '#f59e0b',
    auto: '#ef4444',
    walking: '#8b5cf6',
    truck: '#6b7280',
  }
  return colors[v]
}

export function createVehicleIcon(vehicle: VehicleType, heading: number, isOnline: boolean): L.DivIcon {
  const color = vehicleColor(vehicle)
  const svgPaths: Record<VehicleType, string> = {
    motorbike: '<path d="M5 17h14M8 17a3 3 0 1 0 6 0M10 17V8h4v9M12 5l3 3" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/>',
    scooter: '<path d="M5 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0M15 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0M7 17V7h6l2 10" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/>',
    bicycle: '<circle cx="6" cy="17" r="3" stroke="white" stroke-width="2" fill="none"/><circle cx="18" cy="17" r="3" stroke="white" stroke-width="2" fill="none"/><path d="M6 17l4-8h6l-3 8M10 9h4" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/>',
    car: '<path d="M3 14l2-6h14l2 6v4h-2v-2H5v2H3v-4z" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="7" cy="16" r="1.5" fill="white"/><circle cx="17" cy="16" r="1.5" fill="white"/>',
    auto: '<path d="M4 16v-4l3-4h10l3 4v4M4 16h16M7 16a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0M14 16a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/>',
    walking: '<circle cx="12" cy="4" r="2" fill="white"/><path d="M10 8l2 3v6M12 11l3 2M10 11l-3 2" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/>',
    truck: '<path d="M1 14h14V8H1v6zM15 14h4v-3l-2-3h-2v6z" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="5" cy="16" r="1.5" fill="white"/><circle cx="17" cy="16" r="1.5" fill="white"/>',
  }

  const pulse = isOnline
    ? `<div class="dp-marker-pulse" style="border-color:${color}"></div>`
    : ''

  const html = `
    <div class="dp-marker-wrapper">
      ${pulse}
      <div class="dp-marker-body" style="transform:rotate(${heading}deg);background:${color}">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          ${svgPaths[vehicle]}
        </svg>
      </div>
      <div class="dp-marker-arrow" style="border-bottom-color:${color};transform:rotate(${heading}deg)"></div>
    </div>`

  return L.divIcon({
    html,
    className: 'dp-vehicle-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  })
}

export function createUserLocationIcon(): L.DivIcon {
  return L.divIcon({
    html: `
      <div class="user-location-marker">
        <div class="user-location-dot"></div>
        <div class="user-location-pulse"></div>
      </div>`,
    className: 'user-location-icon',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  })
}

export function createPickupIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div class="pickup-marker"><div class="pickup-marker-inner">P</div></div>`,
    className: 'pickup-icon',
    iconSize: [32, 40],
    iconAnchor: [16, 40],
  })
}

export function createDestinationIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div class="destination-marker"><div class="destination-marker-inner">D</div></div>`,
    className: 'destination-icon',
    iconSize: [32, 40],
    iconAnchor: [16, 40],
  })
}

export type RouteInfo = {
  coordinates: [number, number][]
  distance_meters: number
  duration_seconds: number
}

export async function fetchRoute(
  from: LatLng,
  to: LatLng,
  profile: 'driving' | 'cycling' | 'foot' = 'driving'
): Promise<RouteInfo | null> {
  try {
    const url = `${OSRM_BASE}/route/v1/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (!data.routes || data.routes.length === 0) return null
    const route = data.routes[0]
    const coords: [number, number][] = route.geometry.coordinates.map(
      (c: [number, number]) => [c[1], c[0]]
    )
    return {
      coordinates: coords,
      distance_meters: route.distance,
      duration_seconds: route.duration,
    }
  } catch {
    return null
  }
}

export function formatETA(seconds: number): string {
  if (seconds < 60) return '< 1 min'
  const mins = Math.round(seconds / 60)
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  const remMins = mins % 60
  return `${hrs}h ${remMins}m`
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(1)}km`
}

export function formatSpeed(kmh: number): string {
  if (kmh < 1) return '0 km/h'
  return `${Math.round(kmh)} km/h`
}

export function formatBattery(level: number | null | undefined): string {
  if (level == null) return '--'
  return `${level}%`
}

export function interpolatePosition(
  from: LatLng,
  to: LatLng,
  fraction: number
): LatLng {
  return {
    lat: from.lat + (to.lat - from.lat) * fraction,
    lng: from.lng + (to.lng - from.lng) * fraction,
  }
}

export function bearingBetween(from: LatLng, to: LatLng): number {
  const dLng = (to.lng - from.lng) * Math.PI / 180
  const lat1 = from.lat * Math.PI / 180
  const lat2 = to.lat * Math.PI / 180
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}
