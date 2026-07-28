import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { useLeafletMap } from '../../hooks/useLeafletMap'
import { useTheme } from '../../context'
import {
  createVehicleIcon, createUserLocationIcon, createPickupIcon, createDestinationIcon,
  fetchRoute, interpolatePosition, bearingBetween,
  type LatLng, type VehicleType, type RouteInfo,
} from '../../lib/mapUtils'
import MapControls from './MapControls'
import OfflineBanner from './OfflineBanner'

export type DpMarkerData = {
  id: string
  position: LatLng
  heading: number
  vehicle: VehicleType
  isOnline: boolean
}

export type RouteEndpoints = {
  pickup?: LatLng
  destination?: LatLng
  dpPosition?: LatLng
}

type Props = {
  containerId: string
  userLocation?: LatLng | null
  dpMarkers?: DpMarkerData[]
  routeEndpoints?: RouteEndpoints
  followDp?: boolean
  showControls?: boolean
  onMapReady?: (map: L.Map) => void
  onDpClick?: (dpId: string) => void
  className?: string
}

export default function DeliveryMap({
  containerId,
  userLocation,
  dpMarkers = [],
  routeEndpoints,
  followDp = false,
  showControls = true,
  onMapReady,
  onDpClick,
  className = '',
}: Props) {
  const { map, ready } = useLeafletMap(containerId)
  const { theme } = useTheme()
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isFollowing, setIsFollowing] = useState(followDp)
  const [heading, setHeading] = useState<number | null>(null)

  const userMarkerRef = useRef<L.Marker | null>(null)
  const userAccuracyRef = useRef<L.Circle | null>(null)
  const dpMarkerRefs = useRef<Map<string, L.Marker>>(new Map())
  const prevPositions = useRef<Map<string, LatLng>>(new Map())
  const animFrameRef = useRef<number | null>(null)
  const pickupMarkerRef = useRef<L.Marker | null>(null)
  const destMarkerRef = useRef<L.Marker | null>(null)
  const routeLineRef = useRef<L.Polyline | null>(null)
  const completedRouteRef = useRef<L.Polyline | null>(null)
  const routeInfoRef = useRef<RouteInfo | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Notify parent when map is ready
  useEffect(() => {
    if (ready && map && onMapReady) onMapReady(map)
  }, [ready, map, onMapReady])

  // User location marker
  useEffect(() => {
    if (!map || !userLocation) return
    const pos: L.LatLngExpression = [userLocation.lat, userLocation.lng]
    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker(pos, { icon: createUserLocationIcon(), zIndexOffset: 1000 }).addTo(map)
      userAccuracyRef.current = L.circle(pos, {
        radius: 50,
        className: 'accuracy-circle',
      }).addTo(map)
    } else {
      userMarkerRef.current.setLatLng(pos)
      userAccuracyRef.current?.setLatLng(pos)
    }
  }, [map, userLocation])

  // Smooth DP marker animation
  useEffect(() => {
    if (!map) return
    const markerMap = dpMarkerRefs.current
    const prevMap = prevPositions.current

    // Remove markers for DPs no longer in the list
    const currentIds = new Set(dpMarkers.map(d => d.id))
    markerMap.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        map.removeLayer(marker)
        markerMap.delete(id)
        prevMap.delete(id)
      }
    })

    // Add or update markers
    dpMarkers.forEach(dp => {
      const existing = markerMap.get(dp.id)
      const prev = prevMap.get(dp.id)

      if (!existing) {
        const marker = L.marker([dp.position.lat, dp.position.lng], {
          icon: createVehicleIcon(dp.vehicle, dp.heading, dp.isOnline),
        }).addTo(map)
        if (onDpClick) marker.on('click', () => onDpClick(dp.id))
        markerMap.set(dp.id, marker)
        prevMap.set(dp.id, dp.position)
      } else if (prev) {
        // Animate from prev to new position
        const from = prev
        const to = dp.position
        const duration = 2000
        const startTime = performance.now()
        const startHeading = dp.heading

        const animate = (now: number) => {
          const elapsed = now - startTime
          const fraction = Math.min(elapsed / duration, 1)
          const interp = interpolatePosition(from, to, fraction)
          existing.setLatLng([interp.lat, interp.lng])

          // Update heading
          const newHeading = bearingBetween(from, to)
          existing.setIcon(createVehicleIcon(dp.vehicle, newHeading, dp.isOnline))

          if (fraction < 1) {
            animFrameRef.current = requestAnimationFrame(animate)
          } else {
            prevMap.set(dp.id, to)
            existing.setIcon(createVehicleIcon(dp.vehicle, startHeading, dp.isOnline))
          }
        }
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = requestAnimationFrame(animate)
      }
    })

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [map, dpMarkers, onDpClick])

  // Follow DP
  useEffect(() => {
    if (!map || !isFollowing) return
    const dp = dpMarkers[0]
    if (dp) {
      map.panTo([dp.position.lat, dp.position.lng], { animate: true, duration: 1 })
      setHeading(dp.heading)
    }
  }, [map, isFollowing, dpMarkers])

  // Route drawing
  useEffect(() => {
    if (!map || !routeEndpoints) return
    const { pickup, destination, dpPosition } = routeEndpoints

    // Pickup marker
    if (pickup) {
      if (!pickupMarkerRef.current) {
        pickupMarkerRef.current = L.marker([pickup.lat, pickup.lng], { icon: createPickupIcon() }).addTo(map)
      } else {
        pickupMarkerRef.current.setLatLng([pickup.lat, pickup.lng])
      }
    }

    // Destination marker
    if (destination) {
      if (!destMarkerRef.current) {
        destMarkerRef.current = L.marker([destination.lat, destination.lng], { icon: createDestinationIcon() }).addTo(map)
      } else {
        destMarkerRef.current.setLatLng([destination.lat, destination.lng])
      }
    }

    // Fetch and draw route
    const drawRoute = async () => {
      const from = dpPosition || pickup
      const to = destination
      if (!from || !to) return

      const route = await fetchRoute(from, to)
      if (!route) return
      routeInfoRef.current = route

      if (routeLineRef.current) {
        map.removeLayer(routeLineRef.current)
      }
      routeLineRef.current = L.polyline(route.coordinates, {
        color: '#808000',
        weight: 5,
        opacity: 0.8,
        dashArray: '8 6',
        className: 'route-line-animated',
      }).addTo(map)

      // Fit bounds to show the route
      const bounds = L.latLngBounds(route.coordinates)
      map.fitBounds(bounds, { padding: [60, 60] })
    }

    drawRoute()
  }, [map, routeEndpoints])

  // Fullscreen
  useEffect(() => {
    if (!containerRef.current) return
    if (isFullscreen) {
      containerRef.current.classList.add('map-fullscreen')
    } else {
      containerRef.current.classList.remove('map-fullscreen')
    }
    if (map) map.invalidateSize()
  }, [isFullscreen, map])

  const handleLocate = () => {
    if (!map || !userLocation) return
    map.flyTo([userLocation.lat, userLocation.lng], 16, { duration: 1 })
  }

  const handleZoomIn = () => map?.zoomIn()
  const handleZoomOut = () => map?.zoomOut()
  const handleCompass = () => {
    if (!map) return
    setHeading(null)
  }
  const handleFullscreen = () => setIsFullscreen(prev => !prev)
  const handleFollow = () => setIsFollowing(prev => !prev)

  return (
    <>
      <OfflineBanner />
      <div ref={containerRef} id={containerId} className={`relative ${className}`} style={{ minHeight: '300px' }} />
      {showControls && map && (
        <MapControls
          onLocate={handleLocate}
          onFollow={handleFollow}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onCompass={handleCompass}
          onFullscreen={handleFullscreen}
          isFullscreen={isFullscreen}
          isFollowing={isFollowing}
          heading={heading}
        />
      )}
    </>
  )
}
