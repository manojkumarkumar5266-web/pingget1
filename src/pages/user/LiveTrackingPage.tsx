import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, type DeliveryRequest, type Profile, type DeliveryPartner } from '../../lib/supabase'
import { useAuth } from '../../context'
import { useLeafletMap } from '../../hooks/useLeafletMap'
import { createVehicleIcon, createUserLocationIcon, createPickupIcon, createDestinationIcon, fetchRoute, formatETA, vehicleLabel, normalizeVehicle, type LatLng } from '../../lib/mapUtils'
import { formatDistance as fmtDist, STATUS_LABELS } from '../../lib/utils'
import L from 'leaflet'
import { ArrowLeft, Phone, MessageCircle, Star, MapPin, Clock, Bike, Navigation, CheckCircle2, Package } from 'lucide-react'

const TRACKING_STEPS = [
  { key: 'accepted', label: 'Order Accepted', icon: CheckCircle2 },
  { key: 'confirmed', label: 'Quotation Confirmed', icon: CheckCircle2 },
  { key: 'shopping', label: 'Partner Shopping', icon: Package },
  { key: 'purchased', label: 'Items Purchased', icon: Package },
  { key: 'on_the_way', label: 'Partner On The Way', icon: Bike },
  { key: 'arrived', label: 'Partner Arrived', icon: MapPin },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
]

export default function LiveTrackingPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [request, setRequest] = useState<DeliveryRequest | null>(null)
  const [dpProfile, setDpProfile] = useState<Profile | null>(null)
  const [dpData, setDpData] = useState<DeliveryPartner | null>(null)
  const [dpPosition, setDpPosition] = useState<LatLng | null>(null)
  const [eta, setEta] = useState<string>('--')
  const [dist, setDist] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  const { map, ready } = useLeafletMap('tracking-map')
  const dpMarkerRef = useRef<L.Marker | null>(null)
  const userMarkerRef = useRef<L.Marker | null>(null)
  const pickupMarkerRef = useRef<L.Marker | null>(null)
  const destMarkerRef = useRef<L.Marker | null>(null)
  const routeLineRef = useRef<L.Polyline | null>(null)
  const prevPosRef = useRef<LatLng | null>(null)
  const animFrameRef = useRef<number | null>(null)

  // Fetch request + DP data
  useEffect(() => {
    if (!requestId) return
    let dpId: string | null = null

    const fetchData = async () => {
      const { data: req } = await supabase
        .from('requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle()
      if (!req) { setLoading(false); return }
      setRequest(req as DeliveryRequest)
      dpId = req.accepted_dp_id

      if (req.accepted_dp_id) {
        const { data: dpProf } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', req.accepted_dp_id)
          .maybeSingle()
        setDpProfile(dpProf as Profile | null)

        const { data: dp } = await supabase
          .from('delivery_partners')
          .select('*')
          .eq('user_id', req.accepted_dp_id)
          .maybeSingle()
        setDpData(dp as DeliveryPartner | null)

        if (dp?.current_lat && dp?.current_lng) {
          setDpPosition({ lat: dp.current_lat, lng: dp.current_lng })
        }
      }
      setLoading(false)
    }
    fetchData()

    const channel = supabase
      .channel(`tracking-${requestId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'requests',
        filter: `id=eq.${requestId}`,
      }, (payload: any) => {
        setRequest(payload.new as DeliveryRequest)
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'delivery_partners',
      }, (payload: any) => {
        const dp = payload.new as DeliveryPartner
        if (dpId && dp.user_id === dpId) {
          if (dp.current_lat && dp.current_lng) {
            setDpPosition({ lat: dp.current_lat, lng: dp.current_lng })
          }
          setDpData(dp)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [requestId])

  // User marker
  useEffect(() => {
    if (!map || !profile?.gps_lat || !profile?.gps_lng) return
    const pos: L.LatLngExpression = [profile.gps_lat, profile.gps_lng]
    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker(pos, { icon: createUserLocationIcon(), zIndexOffset: 1000 }).addTo(map)
    } else {
      userMarkerRef.current.setLatLng(pos)
    }
  }, [map, profile])

  // Pickup & destination markers
  useEffect(() => {
    if (!map || !request) return
    if (request.pickup_lat && request.pickup_lng) {
      if (!pickupMarkerRef.current) {
        pickupMarkerRef.current = L.marker([request.pickup_lat, request.pickup_lng], { icon: createPickupIcon() }).addTo(map)
      } else {
        pickupMarkerRef.current.setLatLng([request.pickup_lat, request.pickup_lng])
      }
    }
    if (request.delivery_lat && request.delivery_lng) {
      if (!destMarkerRef.current) {
        destMarkerRef.current = L.marker([request.delivery_lat, request.delivery_lng], { icon: createDestinationIcon() }).addTo(map)
      } else {
        destMarkerRef.current.setLatLng([request.delivery_lat, request.delivery_lng])
      }
    }
  }, [map, request])

  // DP marker with smooth animation + route line
  useEffect(() => {
    if (!map || !dpPosition) return
    const vehicle = normalizeVehicle(dpData?.vehicle_type ?? null)
    const prev = prevPosRef.current

    if (!dpMarkerRef.current) {
      dpMarkerRef.current = L.marker([dpPosition.lat, dpPosition.lng], {
        icon: createVehicleIcon(vehicle, 0, true),
        zIndexOffset: 500,
      }).addTo(map)
      prevPosRef.current = dpPosition
      map.setView([dpPosition.lat, dpPosition.lng], 15)
    } else if (prev) {
      const from = prev
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

    // Fetch route from DP to user's delivery location — olive green path
    if (request?.delivery_lat && request?.delivery_lng) {
      fetchRoute(dpPosition, { lat: request.delivery_lat, lng: request.delivery_lng }).then(route => {
        if (!route || !map) return
        if (routeLineRef.current) map.removeLayer(routeLineRef.current)
        routeLineRef.current = L.polyline(route.coordinates, {
          color: '#808000',
          weight: 5,
          opacity: 0.8,
          className: 'route-line-animated',
        }).addTo(map)
        setEta(formatETA(route.duration_seconds))
        setDist(route.distance_meters)
      })
    }
  }, [map, dpPosition, dpData, request])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-400">Loading tracking...</div>
      </div>
    )
  }

  if (!request) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50">
        <p className="text-gray-500">Order not found</p>
        <button onClick={() => navigate('/app')} className="btn-primary">Back Home</button>
      </div>
    )
  }

  const currentStepIndex = TRACKING_STEPS.findIndex(s => s.key === request.status)
  const isCancelled = request.status === 'cancelled'
  const isPending = request.status === 'pending'

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50">
      {/* Top half: Map */}
      <div className="relative" style={{ height: '50vh', minHeight: '280px' }}>
        <div id="tracking-map" className="absolute inset-0" />

        {/* Top bar overlay */}
        <div className="absolute left-0 right-0 top-0 z-[1000] px-4 pt-12">
          <div className="map-glass-panel flex items-center gap-3 p-3">
            <button onClick={() => navigate('/app')} className="map-control-btn map-control-dark">
              <ArrowLeft size={18} />
            </button>
            <div className="flex-1">
              <p className="text-xs text-white/50">Order Tracking</p>
              <p className="text-sm font-bold text-white">{STATUS_LABELS[request.status] || request.status}</p>
            </div>
            {dpProfile && (
              <div className="flex items-center gap-2">
                <button onClick={() => window.location.href = `tel:${dpProfile.phone || ''}`}
                  className="map-control-btn map-control-dark">
                  <Phone size={18} />
                </button>
                <button onClick={async () => {
                  const { data } = await supabase.from('chat_rooms').select('id').eq('request_id', requestId).maybeSingle()
                  if (data) navigate(`/app/chat/${data.id}`)
                }} className="map-control-btn map-control-dark">
                  <MessageCircle size={18} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ETA badge on map */}
        {dpPosition && !isPending && (
          <div className="absolute bottom-3 left-1/2 z-[1000] -translate-x-1/2">
            <div className="map-glass-panel flex items-center gap-3 px-4 py-2">
              <Clock size={16} className="text-[#808000]" />
              <span className="text-sm font-bold text-white">{eta}</span>
              <span className="text-xs text-white/50">{dist > 0 ? fmtDist(dist) : ''} away</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom half: Live updates panel */}
      <div className="flex-1 overflow-y-auto bg-gray-50 px-4 py-4">
        <div className="mx-auto max-w-md">
          {/* Pending state */}
          {isPending && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100">
                  <Clock size={22} className="animate-pulse text-amber-600" />
                </div>
                <p className="font-bold text-gray-900">Waiting for partner to accept</p>
                <p className="mt-1 text-xs text-gray-500">Your request is live. Chat will open automatically when a partner accepts.</p>
              </div>
              <button onClick={async () => {
                await supabase.from('requests').update({ status: 'cancelled' }).eq('id', requestId)
                navigate('/app')
              }} className="w-full rounded-2xl py-3 text-sm font-semibold text-red-600 active:scale-95"
                style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                Cancel Request
              </button>
            </div>
          )}

          {/* DP info card */}
          {dpProfile && !isCancelled && (
            <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 animate-slide-up">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-2xl bg-gray-100">
                  {dpProfile.photo_url ? (
                    <img src={dpProfile.photo_url} alt={dpProfile.full_name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-400">
                      <Bike size={24} />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{dpProfile.full_name}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="flex items-center gap-0.5">
                      <Star size={12} className="text-yellow-400" />
                      {dpData?.rating_avg?.toFixed(1) || '0.0'}
                    </span>
                    <span>·</span>
                    <span>{vehicleLabel(normalizeVehicle(dpData?.vehicle_type ?? null))}</span>
                  </div>
                </div>
                <button onClick={async () => {
                  const { data } = await supabase.from('chat_rooms').select('id').eq('request_id', requestId).maybeSingle()
                  if (data) navigate(`/app/chat/${data.id}`)
                }} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-white active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #808000, #606000)' }}>
                  <MessageCircle size={16} /> Chat
                </button>
              </div>
            </div>
          )}

          {/* Timeline / live updates */}
          {!isCancelled && !isPending && (
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Live Updates</div>
              <div className="space-y-0">
                {TRACKING_STEPS.map((step, idx) => {
                  const Icon = step.icon
                  const isCompleted = idx < currentStepIndex
                  const isActive = idx === currentStepIndex
                  const isLast = idx === TRACKING_STEPS.length - 1
                  return (
                    <div key={step.key} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${isCompleted ? 'bg-green-100' : isActive ? 'bg-amber-100' : 'bg-gray-100'}`}>
                          <Icon size={14} className={isCompleted ? 'text-green-600' : isActive ? 'text-amber-600 animate-pulse' : 'text-gray-400'} />
                        </div>
                        {!isLast && <div className={`w-0.5 ${isCompleted ? 'bg-green-300' : 'bg-gray-200'}`} style={{ minHeight: 28 }} />}
                      </div>
                      <div className="pb-4 pt-1.5">
                        <p className={`text-sm font-medium ${isActive ? 'text-gray-900' : isCompleted ? 'text-gray-600' : 'text-gray-400'}`}>
                          {step.label}
                        </p>
                        {isActive && (
                          <p className="text-xs text-amber-600 mt-0.5">In progress...</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Cancelled state */}
          {isCancelled && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
              <p className="font-semibold text-red-600">Order Cancelled</p>
              <button onClick={() => navigate('/app')} className="btn-primary mt-3">Back Home</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
