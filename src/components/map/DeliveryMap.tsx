import FreeStreetMap, { type MapMarker } from './FreeStreetMap'
import type { LatLng } from '../../lib/mapUtils'
import OfflineBanner from './OfflineBanner'

export type DpMarkerData = {
  id: string
  position: LatLng
  heading: number
  vehicle: string
  isOnline: boolean
}

export type RouteEndpoints = {
  pickup?: LatLng
  destination?: LatLng
  dpPosition?: LatLng
}

type Props = {
  containerId?: string
  userLocation?: LatLng | null
  dpMarkers?: DpMarkerData[]
  routeEndpoints?: RouteEndpoints
  followDp?: boolean
  showControls?: boolean
  className?: string
  radiusMeters?: number
}

/** Free OSM street map (MapLibre) — replaces Leaflet DeliveryMap. */
export default function DeliveryMap({
  userLocation,
  dpMarkers = [],
  routeEndpoints,
  className = '',
  radiusMeters,
}: Props) {
  const markers: MapMarker[] = []
  if (userLocation) markers.push({ id: 'user', position: userLocation, kind: 'user' })
  if (routeEndpoints?.pickup) markers.push({ id: 'pickup', position: routeEndpoints.pickup, kind: 'pickup' })
  if (routeEndpoints?.destination) markers.push({ id: 'dest', position: routeEndpoints.destination, kind: 'destination' })
  dpMarkers.forEach(d => {
    markers.push({ id: d.id, position: d.position, kind: 'bike' })
  })
  if (routeEndpoints?.dpPosition) {
    markers.push({ id: 'active-dp', position: routeEndpoints.dpPosition, kind: 'dp' })
  }

  const center =
    routeEndpoints?.dpPosition ||
    userLocation ||
    routeEndpoints?.destination ||
    routeEndpoints?.pickup ||
    { lat: 17.385, lng: 78.4867 }

  return (
    <div className={`relative ${className}`} style={{ minHeight: '300px', height: '100%' }}>
      <OfflineBanner />
      <FreeStreetMap
        center={center}
        zoom={14}
        markers={markers}
        radiusMeters={radiusMeters}
      />
    </div>
  )
}
