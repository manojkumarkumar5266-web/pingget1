import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context'
import { useNearbyDps } from '../../hooks/useNearbyDps'
import { formatDistance } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { X, Bike, CheckCircle2, ChevronRight, Clock, Search, Loader2 } from 'lucide-react'
import FreeStreetMap, { type MapMarker } from '../../components/map/FreeStreetMap'
import { Images } from '../../lib/customImages'

const SCAN_RADIUS_KM = 5
const MAX_SCANS = 6

export default function SearchingMapPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [partnerFound, setPartnerFound] = useState(false)

  const userLocation = profile?.gps_lat && profile?.gps_lng
    ? { lat: profile.gps_lat, lng: profile.gps_lng }
    : null

  const { dps, scanning, scanCount } = useNearbyDps(userLocation, requestId, SCAN_RADIUS_KM * 1000, 4000, MAX_SCANS)
  const [phase, setPhase] = useState<'scanning' | 'found' | 'none'>('scanning')
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    if (!scanning && scanCount >= MAX_SCANS) {
      setPhase(dps.length > 0 ? 'found' : 'none')
    }
  }, [scanning, scanCount, dps.length])

  useEffect(() => {
    if (phase !== 'none' || !requestId) return
    const timer = setTimeout(() => {
      setRetryCount(c => c + 1)
      setPhase('scanning')
    }, 5000)
    return () => clearTimeout(timer)
  }, [phase, requestId])

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
        if ((next?.status === 'accepted' && next?.accepted_dp_id) ||
            (next?.status === 'dp_reserved' && next?.reserved_dp_id)) {
          setPartnerFound(true)
          setTimeout(() => navigate(`/app/track/${requestId}`, { replace: true }), 2000)
        }
        if (next?.status === 'no_dp_found') setPhase('none')
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [requestId, navigate])

  const cancelRequest = async () => {
    if (!requestId) return
    await supabase.from('requests').update({ status: 'cancelled' }).eq('id', requestId)
    navigate('/app')
  }

  const markers: MapMarker[] = useMemo(() => {
    const list: MapMarker[] = []
    if (userLocation) list.push({ id: 'user', position: userLocation, kind: 'user' })
    dps.forEach(dp => {
      if (dp.current_lat == null || dp.current_lng == null) return
      list.push({
        id: dp.dp_user_id,
        position: { lat: dp.current_lat, lng: dp.current_lng },
        kind: 'bike',
      })
    })
    return list
  }, [userLocation, dps])

  if (partnerFound) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#0B0B0B] px-6">
        <img src={Images.orderAccepted} alt="Order accepted" className="w-full max-w-sm object-contain rounded-3xl" draggable={false} />
        <p className="text-sm text-white/50">Opening order tracking...</p>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="relative flex-1 min-h-0">
        {userLocation ? (
          <FreeStreetMap
            center={userLocation}
            zoom={14}
            markers={markers}
            radiusMeters={SCAN_RADIUS_KM * 1000}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-white/40 text-sm">Getting location…</div>
        )}

        <div className="absolute left-0 right-0 top-0 z-10 px-4 pt-12 pointer-events-none">
          <div className="map-glass-panel p-3 pointer-events-auto">
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
                <p className="text-[10px] text-white/40 mt-0.5">Search radius: {SCAN_RADIUS_KM} km</p>
              </div>
              {phase === 'scanning' && (
                <button type="button" onClick={cancelRequest} className="map-control-btn map-control-dark">
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
      </div>

      <div className="px-4 pb-8 pt-3 shrink-0">
        <div className="mx-auto max-w-md space-y-3">
          {phase === 'scanning' && (
            <div className="map-glass-panel p-4 animate-slide-up">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: 'linear-gradient(135deg,#808000,#606000)' }}>
                  <Search size={20} className="text-white animate-pulse" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Searching for partners...</p>
                  <p className="text-xs text-white/60">
                    {dps.length > 0
                      ? `${dps.length} partner${dps.length === 1 ? '' : 's'} found nearby`
                      : `Scanning ${Math.min(scanCount + 1, MAX_SCANS)}/${MAX_SCANS} within ${SCAN_RADIUS_KM}km`}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
                <Clock size={14} className="text-white/60 shrink-0" />
                <p className="text-xs text-white/70">Tracking opens when a partner accepts</p>
              </div>
            </div>
          )}

          {phase === 'found' && (
            <div className="space-y-2 animate-slide-up">
              <div className="map-glass-panel p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-green-500/80">
                    <CheckCircle2 size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{dps.length} partner{dps.length !== 1 ? 's' : ''} available!</p>
                    <p className="text-xs text-white/60">Waiting for a partner to accept your request</p>
                  </div>
                </div>
                {dps.slice(0, 2).map((dp, i) => (
                  <div key={dp.dp_user_id} className="mt-2 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
                    <Bike size={14} style={{ color: '#808000' }} />
                    <span className="text-xs text-white/80">Partner {i + 1}{dp.distance_meters ? ` · ${formatDistance(dp.distance_meters)} away` : ''}</span>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => navigate('/app/orders')}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white active:scale-95"
                style={{ background: 'linear-gradient(135deg,#808000,#606000)' }}>
                Track My Request <ChevronRight size={16} />
              </button>
            </div>
          )}

          {phase === 'none' && (
            <div className="space-y-2 animate-slide-up">
              <div className="map-glass-panel p-4 text-center">
                <Loader2 size={24} className="mx-auto mb-2 animate-spin" style={{ color: '#A6B300' }} />
                <p className="font-semibold text-white">Still searching for a delivery partner...</p>
                <p className="mt-1 text-xs text-white/60">Retrying automatically in a few seconds (attempt {retryCount + 1})</p>
              </div>
              <button type="button" onClick={cancelRequest}
                className="w-full rounded-2xl py-3 text-sm font-semibold text-white/80 active:scale-95"
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
