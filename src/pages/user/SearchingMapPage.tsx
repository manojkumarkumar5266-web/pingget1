import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context'
import { useNearbyDps } from '../../hooks/useNearbyDps'
import { useLeafletMap } from '../../hooks/useLeafletMap'
import { createVehicleIcon, createUserLocationIcon, type VehicleType } from '../../lib/mapUtils'
import { formatDistance } from '../../lib/utils'
import L from 'leaflet'
import { supabase } from '../../lib/supabase'
import { X, Bike, MapPin, CheckCircle2, ChevronRight, Clock, Package, Search } from 'lucide-react'
import { useEffect, useRef } from 'react'

const SCAN_RADIUS_KM = 5
const MAX_SCANS = 6

export default function SearchingMapPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const userLocation = profile?.gps_lat && profile?.gps_lng
    ? { lat: profile.gps_lat, lng: profile.gps_lng }
    : null

  const { dps, scanning, scanCount } = useNearbyDps(userLocation, requestId, SCAN_RADIUS_KM * 1000, 4000, MAX_SCANS)

  const { map, ready } = useLeafletMap('searching-map', userLocation ? [userLocation.lat, userLocation.lng] : undefined, 15)
  const dpMarkerRefs = useRef<Map<string, L.Marker>>(new Map())
  const userMarkerRef = useRef<L.Marker | null>(null)
  const [phase, setPhase] = useState<'scanning' | 'found' | 'none'>('scanning')

  useEffect(() => {
    if (!scanning && scanCount >= MAX_SCANS) {
      setPhase(dps.length > 0 ? 'found' : 'none')
    }
  }, [scanning, scanCount, dps.length])

  // User marker
  useEffect(() => {
    if (!map || !userLocation) return
    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
        icon: createUserLocationIcon(),
        zIndexOffset: 1000,
      }).addTo(map)
    }
  }, [map, userLocation])

  // DP markers
  useEffect(() => {
    if (!map) return
    const refs = dpMarkerRefs.current
    const currentIds = new Set(dps.map(d => d.dp_user_id))

    refs.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        map.removeLayer(marker)
        refs.delete(id)
      }
    })

    dps.forEach(dp => {
      if (!dp.current_lat || !dp.current_lng) return
      const existing = refs.get(dp.dp_user_id)
      const pos: L.LatLngExpression = [dp.current_lat, dp.current_lng]
      if (!existing) {
        const marker = L.marker(pos, {
          icon: createVehicleIcon(dp.vehicle_type as VehicleType, 0, true),
        }).addTo(map)
        refs.set(dp.dp_user_id, marker)
      } else {
        existing.setLatLng(pos)
      }
    })
  }, [map, dps])

  // Listen for acceptance — auto navigate to chat
  useEffect(() => {
    if (!requestId) return
    const channel = supabase
      .channel(`searching-accept-${requestId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'requests',
        filter: `id=eq.${requestId}`,
      }, (payload: any) => {
        const next = payload.new as any
        if (next?.status === 'accepted' && next?.accepted_dp_id) {
          supabase
            .from('chat_rooms')
            .select('id')
            .eq('request_id', requestId)
            .maybeSingle()
            .then(({ data }) => {
              if (data) navigate(`/app/chat/${data.id}`)
            })
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [requestId, navigate])

  const cancelRequest = async () => {
    if (!requestId) return
    await supabase.from('requests').update({ status: 'cancelled' }).eq('id', requestId)
    navigate('/app')
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Top half: Map */}
      <div className="relative" style={{ height: '50vh', minHeight: '280px' }}>
        <div id="searching-map" className="absolute inset-0" />

        {/* Top overlay */}
        <div className="absolute left-0 right-0 top-0 z-[1000] px-4 pt-12">
          <div className="map-glass-panel p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-white/50">
                  {phase === 'scanning' ? 'Scanning...' : phase === 'found' ? 'Partners Found' : 'Search Complete'}
                </p>
                <h2 className="text-base font-bold text-white mt-0.5">
                  {phase === 'scanning'
                    ? 'Finding nearby partners'
                    : phase === 'found'
                    ? `${dps.length} partner${dps.length === 1 ? '' : 's'} nearby`
                    : 'No partners in range'}
                </h2>
              </div>
              {phase === 'scanning' && (
                <button onClick={cancelRequest} className="map-control-btn map-control-dark">
                  <X size={18} />
                </button>
              )}
            </div>
            <div className="mt-2.5 flex items-center gap-1.5">
              {Array.from({ length: MAX_SCANS }).map((_, i) => (
                <div key={i} className="h-1.5 rounded-full transition-all duration-500"
                  style={{ width: i < scanCount ? 24 : 8, background: i < scanCount ? '#808000' : 'rgba(255,255,255,0.15)' }} />
              ))}
            </div>
          </div>
        </div>

        {/* Ripple overlay on map */}
        {phase === 'scanning' && userLocation && map && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-1/2">
            {[1, 2, 3].map(i => (
              <div key={i} className="searching-ripple absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ width: 100, height: 100, animationDelay: `${i * 0.6}s` }} />
            ))}
          </div>
        )}
      </div>

      {/* Bottom half: Live updates panel */}
      <div className="flex-1 overflow-y-auto bg-gray-50 px-4 py-4">
        <div className="mx-auto max-w-md">
          {/* Status header */}
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: 'linear-gradient(135deg, #808000, #606000)' }}>
              {phase === 'scanning' ? <Search size={20} className="text-white animate-pulse" /> : <CheckCircle2 size={20} className="text-white" />}
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">
                {phase === 'scanning' ? 'Searching for partners...' : phase === 'found' ? 'Partners found!' : 'No partners found'}
              </p>
              <p className="text-xs text-gray-500">
                {phase === 'scanning' ? `Scan ${Math.min(scanCount, MAX_SCANS)}/${MAX_SCANS} complete` : 'Your request is live'}
              </p>
            </div>
          </div>

          {/* Live update cards */}
          <div className="space-y-3">
            {phase === 'scanning' && (
              <>
                <div className="rounded-2xl border border-gray-200 bg-white p-4 animate-slide-up">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100">
                      <Search size={16} className="text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">Scanning nearby partners</p>
                      <p className="text-xs text-gray-500">
                        {dps.length > 0
                          ? `${dps.length} partner${dps.length === 1 ? '' : 's'} found${dps[0]?.distance_meters ? ` · ${formatDistance(dps[0].distance_meters)} away` : ''}`
                          : 'Looking for delivery partners within 5km...'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100">
                      <Package size={16} className="text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">Your request is live</p>
                      <p className="text-xs text-gray-500">Partners can see and accept your request</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100">
                      <Clock size={16} className="text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">Waiting for acceptance</p>
                      <p className="text-xs text-gray-500">Once a partner accepts, chat will open automatically</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {phase === 'found' && (
              <>
                <div className="rounded-2xl border border-green-200 bg-green-50 p-4 animate-slide-up">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-100">
                      <CheckCircle2 size={16} className="text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{dps.length} partners available!</p>
                      <p className="text-xs text-gray-500">Ready to accept your request</p>
                    </div>
                  </div>
                </div>
                {dps.slice(0, 3).map((dp, i) => (
                  <div key={dp.dp_user_id} className="rounded-2xl border border-gray-200 bg-white p-4 animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'rgba(128,128,0,0.15)' }}>
                        <Bike size={16} style={{ color: '#808000' }} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">Partner {i + 1}</p>
                        <p className="text-xs text-gray-500">
                          {dp.distance_meters ? `${formatDistance(dp.distance_meters)} away` : 'Nearby'}
                          {dp.vehicle_type ? ` · ${dp.vehicle_type}` : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={() => navigate('/app/orders')}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #808000, #606000)' }}>
                  Track My Request <ChevronRight size={16} />
                </button>
              </>
            )}

            {phase === 'none' && (
              <>
                <div className="rounded-2xl border border-gray-200 bg-white p-4 text-center">
                  <p className="font-semibold text-gray-900">No partners online nearby right now</p>
                  <p className="mt-1 text-xs text-gray-500">Your request is still live — a partner may accept it shortly</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={cancelRequest}
                    className="flex-1 rounded-2xl py-3 text-sm font-semibold text-gray-600 active:scale-95"
                    style={{ background: '#f3f4f6', border: '1px solid #e5e7eb' }}>
                    Cancel
                  </button>
                  <button onClick={() => navigate('/app/orders')}
                    className="flex-1 rounded-2xl py-3 text-sm font-bold text-white active:scale-95"
                    style={{ background: 'linear-gradient(135deg, #808000, #606000)' }}>
                    Track Order
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Info note */}
          <div className="mt-4 rounded-xl bg-gray-100 p-3">
            <p className="text-xs text-gray-500 text-center">
              <MapPin size={12} className="inline mr-1" />
              Once a delivery partner accepts, chat will open automatically to discuss the quotation.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
