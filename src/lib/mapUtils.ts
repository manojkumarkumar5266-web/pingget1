/** Map helpers — Google Maps live tracking via FreeStreetMap embed + overlays. */

export const DEFAULT_CENTER: [number, number] = [17.385, 78.4867] // Hyderabad fallback
export const DEFAULT_ZOOM = 14

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
    motorbike: '#C4D600',
    scooter: '#3b82f6',
    bicycle: '#22c55e',
    car: '#f59e0b',
    auto: '#ef4444',
    walking: '#8b5cf6',
    truck: '#6b7280',
  }
  return colors[v]
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

export function interpolatePosition(from: LatLng, to: LatLng, fraction: number): LatLng {
  return {
    lat: from.lat + (to.lat - from.lat) * fraction,
    lng: from.lng + (to.lng - from.lng) * fraction,
  }
}

export function bearingBetween(from: LatLng, to: LatLng): number {
  const dLng = ((to.lng - from.lng) * Math.PI) / 180
  const lat1 = (from.lat * Math.PI) / 180
  const lat2 = (to.lat * Math.PI) / 180
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}
