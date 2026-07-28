import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, type DeliveryRequest, type Profile, type DeliveryPartner } from '../../lib/supabase'
import { useAuth } from '../../context'
import { useLeafletMap } from '../../hooks/useLeafletMap'
import { useTheme } from '../../context'
import { createVehicleIcon, createUserLocationIcon, createPickupIcon, createDestinationIcon, fetchRoute, formatETA, formatDistance, vehicleLabel, normalizeVehicle, type VehicleType, type LatLng } from '../../lib/mapUtils'
import { formatDistance as fmtDist, STATUS_LABELS } from '../../lib/utils'
import L from 'leaflet'
import { ArrowLeft, Phone, MessageCircle, Star, MapPin, Clock, Bike, Navigation, CheckCircle2, Package } from 'lucide-react'

const TRACKING_STEPS = [
  { key: 'pending', label: 'Searching', icon: MapPin },
  { key: 'accepted', label: 'Accepted', icon: CheckCircle2 },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2 },
  { key: 'shopping', label: 'Shopping', icon: Package },
  { key: 'purchased', label: 'Purchased', icon: Package },
  { key: 'on_the_way', label: 'Partner Coming', icon: Bike },
  { key: 'arrived', label: 'Arrived', icon: MapPin },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
  { key: 'completed', label: 'Completed', icon: CheckCircle2 },
]

export default function LiveTrackingPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { theme } = useTheme()

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
  const isFollowingRef = useRef(true)

  // Fetch request + DP data
  useEffect(() => {
    if (!requestId) return
    const fetchData = async () => {
      const { data: req } = await supabase
        .from('requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle()
      if (!req) { setLoading(false); return }
      setRequest(req as DeliveryRequest)

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

    // Realtime subscription for request updates
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
        filter: `user_id=eq.${request?.accepted_dp_id || ''}`,
      }, (payload: any) => {
        const dp = payload.new as DeliveryPartner
        if (dp.current_lat && dp.current_lng) {
          setDpPosition({ lat: dp.current_lat, lng: dp.current_lng })
        }
        setDpData(dp)
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

  // DP marker with smooth animation
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

        // Compute heading
        const dLng = (to.lng - from.lng) * Math.PI / 180
        const lat1 = from.lat * Math.PI / 180
        const lat2 = to.lat * Math.PI / 180
        const y = Math.sin(dLng) * Math.cos(lat2)
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
        const heading = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
        dpMarkerRef.current?.setIcon(createVehicleIcon(vehicle, heading, true))

        if (isFollowingRef.current) {
          map.panTo([lat, lng], { animate: false })
        }

        if (fraction < 1) {
          animFrameRef.current = requestAnimationFrame(animate)
        } else {
          prevPosRef.current = to
        }
      }
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = requestAnimationFrame(animate)
    }

    // Fetch route from DP to destination
    if (request?.delivery_lat && request?.delivery_lng) {
      fetchRoute(dpPosition, { lat: request.delivery_lat, lng: request.delivery_lng }).then(route => {
        if (!route || !map) return
        if (routeLineRef.current) map.removeLayer(routeLineRef.current)
        routeLineRef.current = L.polyline(route.coordinates, {
          color: '#808000',
          weight: 5,
          opacity: 0.8,
          dashArray: '8 6',
          className: 'route-line-animated',
        }).addTo(map)
        setEta(formatETA(route.duration_seconds))
        setDist(route.distance_meters)
      })
    }
  }, [map, dpPosition, dpData, request])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-white/50">Loading tracking...</div>
      </div>
    )
  }

  if (!request) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-white/60">Order not found</p>
        <button onClick={() => navigate('/app')} className="btn-primary">Back Home</button>
      </div>
    )
  }

  const currentStepIndex = TRACKING_STEPS.findIndex(s => s.key === request.status)
  const isCancelled = request.status === 'cancelled'

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: theme === 'dark' ? '#0f1a0d' : '#f5f5f5' }}>
      {/* Map */}
      <div id="tracking-map" className="absolute inset-0" />

      {/* Top bar */}
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

      {/* Bottom sheet */}
      <div className="absolute bottom-0 left-0 right-0 z-[1000]">
        <div className="map-glass-panel mx-3 mb-4 max-w-md mx-auto">
          <div className="bottom-sheet-handle pt-3" />

          {/* DP info card */}
          {dpProfile && (
            <div className="px-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-2xl bg-white/10">
                  {dpProfile.photo_url ? (
                    <img src={dpProfile.photo_url} alt={dpProfile.full_name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/40">
                      <Bike size={24} />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-white">{dpProfile.full_name}</p>
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <span className="flex items-center gap-0.5">
                      <Star size={12} className="text-yellow-400" />
                      {dpData?.rating_avg?.toFixed(1) || '0.0'}
                    </span>
                    <span>·</span>
                    <span>{vehicleLabel(normalizeVehicle(dpData?.vehicle_type ?? null))}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-white">{eta}</p>
                  <p className="text-xs text-white/40">{dist > 0 ? fmtDist(dist) : ''} away</p>
                </div>
              </div>
            </div>
          )}

          {/* Timeline */}
          {!isCancelled && (
            <div className="px-5 pb-5">
              <div className="mb-3 text-xs font-medium uppercase tracking-wider text-white/40">Order Status</div>
              <div className="space-y-0">
                {TRACKING_STEPS.map((step, idx) => {
                  const Icon = step.icon
                  const isCompleted = idx < currentStepIndex
                  const isActive = idx === currentStepIndex
                  const isLast = idx === TRACKING_STEPS.length - 1
                  return (
                    <div key={step.key} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`timeline-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}>
                          <div className="timeline-dot" />
                        </div>
                        {!isLast && <div className={`timeline-line ${isCompleted ? 'completed' : ''}`} style={{ minHeight: 24 }} />}
                      </div>
                      <div className="pb-4 pt-0.5">
                        <p className={`text-sm font-medium ${isActive ? 'text-white' : isCompleted ? 'text-white/70' : 'text-white/30'}`}>
                          {step.label}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {isCancelled && (
            <div className="px-5 pb-5 text-center">
              <p className="font-semibold text-red-400">Order Cancelled</p>
              <button onClick={() => navigate('/app')} className="btn-primary mt-3">Back Home</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
