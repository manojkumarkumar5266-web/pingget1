import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context'
import { useNearbyDps } from '../../hooks/useNearbyDps'
import { formatDistance } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { X, Bike, CheckCircle2, ChevronRight, Search, Loader2 } from 'lucide-react'
import FreeStreetMap, { MAP_VIEW_RADIUS_M, SCAN_BACKEND_RADIUS_M, type MapMarker } from '../../components/map/FreeStreetMap'
import { Images } from '../../lib/customImages'
import { MobileFrame } from '../../design/primitives'
import { pg } from '../../design/tokens'

const SCAN_RADIUS_M = SCAN_BACKEND_RADIUS_M
const MAX_SCANS = 6

export default function SearchingMapPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [partnerFound, setPartnerFound] = useState(false)

  const userLocation = profile?.gps_lat && profile?.gps_lng
    ? { lat: profile.gps_lat, lng: profile.gps_lng }
    : null

  const { dps, scanning, scanCount } = useNearbyDps(userLocation, requestId, SCAN_RADIUS_M, 4000, MAX_SCANS)
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
          setTimeout(async () => {
            const { data: room } = await supabase
              .from('chat_rooms')
              .select('id')
              .eq('request_id', requestId)
              .maybeSingle()
            if (room?.id) navigate(`/app/chat/${room.id}`, { replace: true })
            else navigate(`/app/track/${requestId}`, { replace: true })
          }, 2000)
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
        vehicleType: dp.vehicle_type,
      })
    })
    return list
  }, [userLocation, dps])

  if (partnerFound) {
    return (
      <MobileFrame overlay className="items-center justify-center gap-4 overflow-hidden px-6">
        <img src={Images.orderAccepted} alt="Order accepted" className="w-full max-w-sm object-contain rounded-3xl" draggable={false} />
        <p className="text-sm text-black/50">Opening chat...</p>
      </MobileFrame>
    )
  }

  return (
    <MobileFrame overlay className="overflow-hidden">
      <div className="relative flex-1 min-h-0">
        <FreeStreetMap
          center={userLocation || { lat: 17.6868, lng: 83.2185 }}
          zoom={14}
          markers={markers}
          radiusMeters={MAP_VIEW_RADIUS_M}
          light
          radar
          instant
        />

        <div className="absolute left-0 right-0 top-0 z-10 px-4 pt-12 pointer-events-none">
          <div className="map-glass-panel p-3 pointer-events-auto">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-black/50">
                  {phase === 'scanning' ? 'Scanning...' : phase === 'found' ? 'Partners Found' : 'Search Complete'}
                </p>
                <h2 className="text-base font-bold text-[#F5F7F6] mt-0.5">
                  {phase === 'scanning'
                    ? 'Finding nearby partners'
                    : phase === 'found'
                    ? `${dps.length} partner${dps.length === 1 ? '' : 's'} nearby`
                    : 'No partners in range'}
                </h2>
                <p className="text-[10px] text-black/40 mt-0.5">Search radius: {Math.round(SCAN_RADIUS_M / 1000)} km</p>
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
                  style={{ width: i < scanCount ? 24 : 8, background: i < scanCount ? '#0C8A3E' : 'rgba(255,255,255,0.15)' }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 px-4 pb-8 pt-3" style={{ background: pg.bg }}>
        <div className="mx-auto max-w-md space-y-3">
          {phase === 'scanning' && (
            <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: pg.surface, color: pg.ink, border: `1px solid ${pg.line}` }}>
              <Loader2 size={20} className="animate-spin" style={{ color: pg.lime }} />
              <div>
                <p className="text-sm font-extrabold text-[#F5F7F6]">Scanning nearby…</p>
                <p className="text-xs" style={{ color: pg.text3 }}>Pass {scanCount}/{MAX_SCANS}</p>
              </div>
            </div>
          )}
          {phase === 'found' && dps.map((dp: any) => (
            <div key={dp.dp_user_id || dp.id} className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: pg.surface, color: pg.ink, border: `1px solid ${pg.line}` }}>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: pg.limeDim }}>
                <Bike size={18} style={{ color: pg.lime }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold text-[#F5F7F6]">{dp.full_name || 'Partner'}</p>
                <p className="text-xs" style={{ color: pg.text3 }}>
                  {formatDistance(Number(dp.distance_meters || 0))} away
                </p>
              </div>
              <CheckCircle2 size={16} style={{ color: pg.lime }} />
            </div>
          ))}
          {phase === 'none' && (
            <div className="rounded-2xl px-4 py-5 text-center" style={{ background: pg.surface, color: pg.ink, border: `1px solid ${pg.line}` }}>
              <Search size={22} className="mx-auto mb-2" style={{ color: pg.text3 }} />
              <p className="font-extrabold text-[#F5F7F6]">No partners nearby</p>
              <p className="mt-1 text-xs" style={{ color: pg.text3 }}>Try again or wait — your request stays live.</p>
              <button
                type="button"
                onClick={() => { setRetryCount(c => c + 1); setPhase('scanning') }}
                className="mt-3 text-sm font-extrabold"
                style={{ color: pg.lime }}
              >
                Scan again <ChevronRight size={14} className="inline" />
              </button>
            </div>
          )}
          {(phase === 'none' || phase === 'found') && (
            <button type="button" onClick={cancelRequest} className="w-full py-2 text-sm" style={{ color: pg.text3 }}>
              Cancel request
            </button>
          )}
        </div>
      </div>
    </MobileFrame>
  )
}
