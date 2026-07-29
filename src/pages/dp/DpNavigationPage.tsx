import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, type DeliveryRequest } from '../../lib/supabase'
import { useAuth } from '../../context'
import { useLeafletMap } from '../../hooks/useLeafletMap'
import {
  createVehicleIcon, createPickupIcon, createDestinationIcon, fetchRoute,
  formatETA, formatSpeed, formatDistance, normalizeVehicle,
  createRoutePolyline, removeRoutePolyline, type LatLng,
} from '../../lib/mapUtils'
import { STATUS_LABELS } from '../../lib/utils'
import L from 'leaflet'
import { ArrowLeft, Navigation, MapPin, Clock, Gauge, Route as RouteIcon, CheckCircle2, MessageCircle, Package } from 'lucide-react'

function fitBoundsToMarkers(map: L.Map, points: L.LatLngExpression[]) {
  if (points.length < 2) {
    map.setView(points[0], 15, { animate: true })
    return
  }
  const bounds = L.latLngBounds(points)
  map.fitBounds(bounds, { paddingTopLeft: [40, 120], paddingBottomRight: [40, 40], animate: true })
}

export default function DpNavigationPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()

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

  // Pickup & destination markers
  useEffect(() => {
    if (!map || !ready || !request) return
    if (request.pickup_lat && request.pickup_lng) {
      if (!pickupMarkerRef.current) {
        pickupMarkerRef.current = L.marker([request.pickup_lat, request.pickup_lng], { icon: createPickupIcon() }).addTo(map)
      }
    }
    if (request.delivery_lat && request.delivery_lng) {
      if (!destMarkerRef.current) {
        destMarkerRef.current = L.marker([request.delivery_lat, request.delivery_lng], { icon: createDestinationIcon() }).addTo(map)
      }
    }
  }, [map, ready, request])

  // DP marker with smooth animation + route line
  useEffect(() => {
    if (!map || !ready || !dpPosition) return
    const vehicle = normalizeVehicle(null)

    // DP marker
    if (!dpMarkerRef.current) {
      dpMarkerRef.current = L.marker([dpPosition.lat, dpPosition.lng], {
        icon: createVehicleIcon(vehicle, 0, true),
        zIndexOffset: 500,
      }).addTo(map)
      prevPosRef.current = dpPosition
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

        const dLng = (to.lng - from.lng) * Math.PI / 180
        const lat1 = from.lat * Math.PI / 180
        const lat2 = to.lat * Math.PI / 180
        const y = Math.sin(dLng) * Math.cos(lat2)
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
        const heading = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
        dpMarkerRef.current?.setIcon(createVehicleIcon(vehicle, heading, true))

        if (fraction < 1) {
          animFrameRef.current = requestAnimationFrame(animate)
        } else {
          prevPosRef.current = to
        }
      }
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = requestAnimationFrame(animate)
    }

    // Fit bounds to keep DP and destination visible
    const pts: L.LatLngExpression[] = [[dpPosition.lat, dpPosition.lng]]
    if (destMarkerRef.current) pts.push(destMarkerRef.current.getLatLng())
    fitBoundsToMarkers(map, pts)

    // Route from DP to destination — olive green path with casing
    if (request?.delivery_lat && request?.delivery_lng) {
      fetchRoute(dpPosition, { lat: request.delivery_lat, lng: request.delivery_lng }).then(r => {
        if (!r || !map) return
        removeRoutePolyline(map, routeLineRef.current)
        routeLineRef.current = createRoutePolyline(map, r.coordinates)
        setRoute({ distance: r.distance_meters, duration: r.duration_seconds, coords: r.coordinates })
      })
    }
  }, [map, ready, dpPosition, request])

  // Cleanup
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-gray-400">Loading...</div>
  }

  if (!request) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50">
        <p className="text-gray-500">Order not found</p>
        <button onClick={() => navigate('/dp')} className="btn-primary">Back</button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50">
      {/* Top half: Map */}
      <div className="relative" style={{ height: '50vh', minHeight: '280px' }}>
        <div id="dp-nav-map" className="absolute inset-0" />

        {/* Top bar overlay */}
        <div className="absolute left-0 right-0 top-0 z-[1000] px-4 pt-12">
          <div className="map-glass-panel flex items-center gap-3 p-3">
            <button onClick={() => navigate('/dp')} className="map-control-btn map-control-dark">
              <ArrowLeft size={18} />
            </button>
            <div className="flex-1">
              <p className="text-xs text-white/50">Navigation</p>
              <p className="text-sm font-bold text-white">{STATUS_LABELS[request.status] || request.status}</p>
            </div>
            <button onClick={async () => {
              const { data } = await supabase.from('chat_rooms').select('id').eq('request_id', requestId).maybeSingle()
              if (data) navigate(`/dp/chat/${data.id}`)
            }} className="map-control-btn map-control-dark">
              <MessageCircle size={18} />
            </button>
            <button onClick={() => {
              if (dpPosition && request.delivery_lat && request.delivery_lng) {
                window.open(`https://www.openstreetmap.org/directions?from=${dpPosition.lat},${dpPosition.lng}&to=${request.delivery_lat},${request.delivery_lng}`, '_blank')
              }
            }} className="map-control-btn map-control-active">
              <Navigation size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom half: Status updates panel */}
      <div className="flex-1 overflow-y-auto bg-gray-50 px-4 py-4">
        <div className="mx-auto max-w-md">
          {/* Stats grid */}
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-3 text-center">
              <div className="mx-auto mb-1.5 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                <Clock size={18} className="text-amber-600" />
              </div>
              <p className="text-base font-bold text-gray-900">{route ? formatETA(route.duration) : '--'}</p>
              <p className="text-[10px] text-gray-500">ETA</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-3 text-center">
              <div className="mx-auto mb-1.5 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
                <RouteIcon size={18} className="text-blue-600" />
              </div>
              <p className="text-base font-bold text-gray-900">{route ? formatDistance(route.distance) : '--'}</p>
              <p className="text-[10px] text-gray-500">Remaining</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-3 text-center">
              <div className="mx-auto mb-1.5 flex h-10 w-10 items-center justify-center rounded-xl bg-green-100">
                <Gauge size={18} className="text-green-600" />
              </div>
              <p className="text-base font-bold text-gray-900">{formatSpeed(speed)}</p>
              <p className="text-[10px] text-gray-500">Speed</p>
            </div>
          </div>

          {/* Addresses */}
          <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Delivery Details</div>
            <div className="space-y-3">
              {request.pickup_address && (
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-yellow-100">
                    <MapPin size={14} className="text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-gray-400">Pickup</p>
                    <p className="text-sm text-gray-700">{request.pickup_address}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-100">
                  <MapPin size={14} className="text-red-600" />
                </div>
                <div>
                  <p className="text-[10px] uppercase text-gray-400">Destination</p>
                  <p className="text-sm text-gray-700">{request.delivery_address}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Status update buttons */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Update Delivery Status</div>
            <div className="space-y-2">
              {request.status === 'accepted' && (
                <button onClick={async () => {
                  await supabase.from('requests').update({ status: 'confirmed' }).eq('id', requestId)
                  await supabase.from('orders').update({ status: 'confirmed' }).eq('request_id', requestId)
                  await supabase.from('notifications').insert({ user_id: request.user_id, title: 'Order Confirmed', body: 'Your delivery partner confirmed. They will start shopping soon.', type: 'order_status', related_id: requestId })
                }} className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white active:scale-95 transition-transform" style={{ background: 'linear-gradient(135deg, #808000, #606000)' }}>
                  <Package size={18} /> Confirm Order
                </button>
              )}
              {request.status === 'confirmed' && (
                <button onClick={async () => {
                  await supabase.from('requests').update({ status: 'shopping' }).eq('id', requestId)
                  await supabase.from('orders').update({ status: 'shopping' }).eq('request_id', requestId)
                  await supabase.from('notifications').insert({ user_id: request.user_id, title: 'Shopping Started', body: 'Your delivery partner is now shopping for your items.', type: 'order_status', related_id: requestId })
                }} className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white active:scale-95 transition-transform" style={{ background: 'linear-gradient(135deg, #808000, #606000)' }}>
                  <Package size={18} /> Start Shopping
                </button>
              )}
              {request.status === 'shopping' && (
                <button onClick={async () => {
                  await supabase.from('requests').update({ status: 'purchased' }).eq('id', requestId)
                  await supabase.from('orders').update({ status: 'purchased' }).eq('request_id', requestId)
                  await supabase.from('notifications').insert({ user_id: request.user_id, title: 'Items Purchased', body: 'Items purchased! Your delivery partner is heading your way soon.', type: 'order_status', related_id: requestId })
                }} className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white active:scale-95 transition-transform" style={{ background: 'linear-gradient(135deg, #808000, #606000)' }}>
                  <Package size={18} /> Items Purchased
                </button>
              )}
              {request.status === 'purchased' && (
                <button onClick={async () => {
                  await supabase.from('requests').update({ status: 'on_the_way' }).eq('id', requestId)
                  await supabase.from('orders').update({ status: 'on_the_way' }).eq('request_id', requestId)
                  await supabase.from('notifications').insert({ user_id: request.user_id, title: 'On The Way!', body: 'Your delivery partner is heading to your location.', type: 'order_status', related_id: requestId })
                }} className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white active:scale-95 transition-transform" style={{ background: 'linear-gradient(135deg, #808000, #606000)' }}>
                  <Navigation size={18} /> On The Way
                </button>
              )}
              {request.status === 'on_the_way' && (
                <button onClick={async () => {
                  await supabase.from('requests').update({ status: 'arrived' }).eq('id', requestId)
                  await supabase.from('orders').update({ status: 'arrived' }).eq('request_id', requestId)
                  await supabase.from('notifications').insert({ user_id: request.user_id, title: 'Partner Arrived', body: 'Your delivery partner has arrived. Please be ready to receive.', type: 'order_status', related_id: requestId })
                }} className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white active:scale-95 transition-transform" style={{ background: 'linear-gradient(135deg, #808000, #606000)' }}>
                  <MapPin size={18} /> Mark Arrived
                </button>
              )}
              {request.status === 'arrived' && (
                <button onClick={async () => {
                  await supabase.from('requests').update({ status: 'delivered' }).eq('id', requestId)
                  await supabase.from('orders').update({ status: 'delivered' }).eq('request_id', requestId)
                  await supabase.from('notifications').insert({ user_id: request.user_id, title: 'Order Delivered', body: 'Your order has been delivered. Please confirm receipt in the app.', type: 'order_status', related_id: requestId })
                }} className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white active:scale-95 transition-transform" style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>
                  <CheckCircle2 size={18} /> Mark Delivered
                </button>
              )}
              {(request.status === 'delivered' || request.status === 'completed') && (
                <div className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-green-600"
                  style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <CheckCircle2 size={18} />
                  {request.status === 'completed' ? 'Order Completed!' : 'Delivered — Awaiting Customer Confirmation'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
