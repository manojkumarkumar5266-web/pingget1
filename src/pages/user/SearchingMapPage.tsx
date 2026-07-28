import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context'
import { useNearbyDps } from '../../hooks/useNearbyDps'
import { useLeafletMap } from '../../hooks/useLeafletMap'
import { useTheme } from '../../context'
import { createVehicleIcon, createUserLocationIcon, vehicleLabel, type VehicleType } from '../../lib/mapUtils'
import { formatDistance } from '../../lib/utils'
import L from 'leaflet'
import { supabase } from '../../lib/supabase'
import { X, Bike, Star, MapPin, Clock, CheckCircle2, ChevronRight } from 'lucide-react'
import { useEffect, useRef } from 'react'

const SCAN_RADIUS_KM = 5
const MAX_SCANS = 6

export default function SearchingMapPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { theme } = useTheme()

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

  const cancelRequest = async () => {
    if (!requestId) return
    await supabase.from('requests').update({ status: 'cancelled' }).eq('id', requestId)
    navigate('/app')
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: theme === 'dark' ? '#0f1a0d' : '#f5f5f5' }}>
      {/* Map background */}
      <div id="searching-map" className="absolute inset-0" />

      {/* Top overlay */}
      <div className="absolute left-0 right-0 top-0 z-[1000] px-5 pt-12">
        <div className="map-glass-panel p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-white/50">
                {phase === 'scanning' ? 'Scanning...' : phase === 'found' ? 'Partners Found' : 'Search Complete'}
              </p>
              <h2 className="text-lg font-bold text-white mt-0.5">
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

          {/* Scan progress */}
          <div className="mt-3 flex items-center gap-1.5">
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

      {/* Bottom sheet */}
      <div className="absolute bottom-0 left-0 right-0 z-[1000]">
        <div className="map-glass-panel mx-3 mb-4 max-w-md mx-auto p-5">
          {phase === 'scanning' && (
            <div className="text-center">
              <p className="text-sm font-medium text-white/70">
                {dps.length > 0
                  ? `${dps.length} partner${dps.length === 1 ? '' : 's'} found${dps[0]?.distance_meters ? ` · ${formatDistance(dps[0].distance_meters)} away` : ''}`
                  : 'Scanning for delivery partners...'}
              </p>
              <p className="mt-1 text-xs text-white/40">Your request is live — partners can see it now</p>
            </div>
          )}

          {phase === 'found' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-2xl p-4" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(16,185,129,0.2)' }}>
                  <Bike size={20} className="text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-white">{dps.length} partners available!</p>
                  <p className="text-xs text-white/50">Ready to accept your request</p>
                </div>
                <CheckCircle2 size={20} className="text-green-400" />
              </div>
              <button onClick={() => navigate('/app/orders')}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white active:scale-95"
                style={{ background: 'linear-gradient(135deg, #808000, #606000)' }}>
                Track My Request <ChevronRight size={16} />
              </button>
            </div>
          )}

          {phase === 'none' && (
            <div className="space-y-3">
              <div className="rounded-2xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <p className="font-semibold text-white">No partners online nearby right now</p>
                <p className="mt-1 text-xs text-white/40">Your request is still live — a partner may accept it shortly</p>
              </div>
              <div className="flex gap-3">
                <button onClick={cancelRequest}
                  className="flex-1 rounded-2xl py-3 text-sm font-semibold text-white/60 active:scale-95"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  Cancel
                </button>
                <button onClick={() => navigate('/app/orders')}
                  className="flex-1 rounded-2xl py-3 text-sm font-bold text-white active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #808000, #606000)' }}>
                  Track Order
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
