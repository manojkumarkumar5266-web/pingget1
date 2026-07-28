import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, type DeliveryRequest } from '../../lib/supabase'
import { useAuth } from '../../context'
import { useLeafletMap } from '../../hooks/useLeafletMap'
import { useTheme } from '../../context'
import { createVehicleIcon, createPickupIcon, createDestinationIcon, fetchRoute, formatETA, formatSpeed, vehicleLabel, normalizeVehicle, type LatLng } from '../../lib/mapUtils'
import { formatDistance as fmtDist, STATUS_LABELS } from '../../lib/utils'
import L from 'leaflet'
import { ArrowLeft, Navigation, MapPin, Clock, Gauge, Route as RouteIcon, CheckCircle2, Package } from 'lucide-react'

export default function DpNavigationPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { theme } = useTheme()

  const [request, setRequest] = useState<DeliveryRequest | null>(null)
  const [dpPosition, setDpPosition] = useState<LatLng | null>(null)
  const [route, setRoute] = useState<{ distance: number; duration: number; coords: [number, number][] } | null>(null)
  const [speed, setSpeed] = useState(0)
  const [loading, setLoading] = useState(true)

  const { map, ready } = useLeafletMap('dp-nav-map')
  const dpMarkerRef = useRef<L.Marker | null>(null)
  const pickupMarkerRef = useRef<L.Marker | null>(null)
  const destMarkerRef = useRef<L.Marker | null>(null)
  const routeLineRef = useRef<L.Polyline | null>(null)
  const prevPosRef = useRef<LatLng | null>(null)
  const animFrameRef = useRef<number | null>(null)

  // Fetch request
  useEffect(() => {
    if (!requestId) return
    const fetchData = async () => {
      const { data: req } = await supabase
        .from('requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle()
      if (req) setRequest(req as DeliveryRequest)
      setLoading(false)
    }
    fetchData()

    const channel = supabase
      .channel(`dp-nav-${requestId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests', filter: `id=eq.${requestId}` }, (payload: any) => {
        setRequest(payload.new as DeliveryRequest)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [requestId])

  // Watch DP GPS
  useEffect(() => {
    if (!profile) return
    if (!navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setDpPosition(newPos)
        setSpeed(pos.coords.speed ? pos.coords.speed * 3.6 : 0)
        supabase.rpc('update_location', { p_lat: pos.coords.latitude, p_lng: pos.coords.longitude })
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [profile])

  // Markers + route
  useEffect(() => {
    if (!map || !dpPosition) return
    const vehicle = normalizeVehicle(null)

    // DP marker
    if (!dpMarkerRef.current) {
      dpMarkerRef.current = L.marker([dpPosition.lat, dpPosition.lng], {
        icon: createVehicleIcon(vehicle, 0, true),
        zIndexOffset: 500,
      }).addTo(map)
      prevPosRef.current = dpPosition
      map.setView([dpPosition.lat, dpPosition.lng], 15)
    } else if (prevPosRef.current) {
      const from = prevPosRef.current
      const to = dpPosition
      const duration = 2000
      const startTime = performance.now()
      const animate = (now: number) => {
        const elapsed = now - startTime
        const fraction = Math.min(elapsed / duration, 1)
        const lat = from.lat + (to.lat - from.lat) * fraction
        const lng = from.lng + (to.lng - from.lng) * fraction
        dpMarkerRef.current?.setLatLng([lat, lng])
        map.panTo([lat, lng], { animate: false })
        if (fraction < 1) {
          animFrameRef.current = requestAnimationFrame(animate)
        } else {
          prevPosRef.current = to
        }
      }
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = requestAnimationFrame(animate)
    }

    // Pickup & destination markers
    if (request?.pickup_lat && request?.pickup_lng) {
      if (!pickupMarkerRef.current) {
        pickupMarkerRef.current = L.marker([request.pickup_lat, request.pickup_lng], { icon: createPickupIcon() }).addTo(map)
      }
    }
    if (request?.delivery_lat && request?.delivery_lng) {
      if (!destMarkerRef.current) {
        destMarkerRef.current = L.marker([request.delivery_lat, request.delivery_lng], { icon: createDestinationIcon() }).addTo(map)
      }
    }

    // Route from DP to destination
    if (request?.delivery_lat && request?.delivery_lng) {
      fetchRoute(dpPosition, { lat: request.delivery_lat, lng: request.delivery_lng }).then(r => {
        if (!r || !map) return
        if (routeLineRef.current) map.removeLayer(routeLineRef.current)
        routeLineRef.current = L.polyline(r.coordinates, {
          color: '#808000', weight: 5, opacity: 0.8, dashArray: '8 6', className: 'route-line-animated',
        }).addTo(map)
        setRoute({ distance: r.distance_meters, duration: r.duration_seconds, coords: r.coordinates })
      })
    }
  }, [map, dpPosition, request])

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-white/50">Loading...</div>
  }

  if (!request) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-white/60">Order not found</p>
        <button onClick={() => navigate('/dp')} className="btn-primary">Back</button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: theme === 'dark' ? '#0f1a0d' : '#f5f5f5' }}>
      <div id="dp-nav-map" className="absolute inset-0" />

      {/* Top bar */}
      <div className="absolute left-0 right-0 top-0 z-[1000] px-4 pt-12">
        <div className="map-glass-panel flex items-center gap-3 p-3">
          <button onClick={() => navigate('/dp')} className="map-control-btn map-control-dark">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <p className="text-xs text-white/50">Navigation</p>
            <p className="text-sm font-bold text-white">{STATUS_LABELS[request.status] || request.status}</p>
          </div>
          <button onClick={() => {
            if (dpPosition && request.delivery_lat && request.delivery_lng) {
              window.open(`https://www.openstreetmap.org/directions?from=${dpPosition.lat},${dpPosition.lng}&to=${request.delivery_lat},${request.delivery_lng}`, '_blank')
            }
          }} className="map-control-btn map-control-active">
            <Navigation size={18} />
          </button>
        </div>
      </div>

      {/* Bottom sheet with stats */}
      <div className="absolute bottom-0 left-0 right-0 z-[1000]">
        <div className="map-glass-panel mx-3 mb-4 max-w-md mx-auto p-5">
          <div className="bottom-sheet-handle" />

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="mx-auto mb-1.5 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                <Clock size={18} className="text-[#808000]" />
              </div>
              <p className="text-base font-bold text-white">{route ? formatETA(route.duration) : '--'}</p>
              <p className="text-[10px] text-white/40">ETA</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-1.5 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                <RouteIcon size={18} className="text-blue-400" />
              </div>
              <p className="text-base font-bold text-white">{route ? fmtDist(route.distance) : '--'}</p>
              <p className="text-[10px] text-white/40">Remaining</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-1.5 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                <Gauge size={18} className="text-green-400" />
              </div>
              <p className="text-base font-bold text-white">{formatSpeed(speed)}</p>
              <p className="text-[10px] text-white/40">Speed</p>
            </div>
          </div>

          {/* Addresses */}
          <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
            {request.pickup_address && (
              <div className="flex items-start gap-2">
                <MapPin size={14} className="mt-0.5 shrink-0 text-yellow-400" />
                <div>
                  <p className="text-[10px] uppercase text-white/40">Pickup</p>
                  <p className="text-xs text-white/70">{request.pickup_address}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2">
              <MapPin size={14} className="mt-0.5 shrink-0 text-red-400" />
              <div>
                <p className="text-[10px] uppercase text-white/40">Destination</p>
                <p className="text-xs text-white/70">{request.delivery_address}</p>
              </div>
            </div>
          </div>

          {/* Status update buttons */}
          <div className="mt-4 flex gap-2">
            {request.status === 'accepted' && (
              <button onClick={async () => {
                await supabase.from('requests').update({ status: 'on_the_way' }).eq('id', requestId)
              }} className="flex-1 rounded-xl py-3 text-sm font-bold text-white active:scale-95"
                style={{ background: 'linear-gradient(135deg, #808000, #606000)' }}>
                Start Trip
              </button>
            )}
            {request.status === 'on_the_way' && (
              <button onClick={async () => {
                await supabase.from('requests').update({ status: 'arrived' }).eq('id', requestId)
              }} className="flex-1 rounded-xl py-3 text-sm font-bold text-white active:scale-95"
                style={{ background: 'linear-gradient(135deg, #808000, #606000)' }}>
                Mark Arrived
              </button>
            )}
            {request.status === 'arrived' && (
              <button onClick={async () => {
                await supabase.from('requests').update({ status: 'delivered' }).eq('id', requestId)
              }} className="flex-1 rounded-xl py-3 text-sm font-bold text-white active:scale-95"
                style={{ background: 'linear-gradient(135deg, #808000, #606000)' }}>
                Mark Delivered
              </button>
            )}
            {(request.status === 'delivered' || request.status === 'completed') && (
              <div className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-green-400"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <CheckCircle2 size={18} /> Delivered
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
