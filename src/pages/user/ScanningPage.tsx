import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase } from '../../lib/supabase'
import { useGps } from '../../hooks/useGps'
import { formatDistance } from '../../lib/utils'
import { X, Clock, RefreshCw, MapPinOff, Loader2, Radar, MapPin } from 'lucide-react'
import { Images } from '../../lib/customImages'
import FreeStreetMap, { type MapMarker } from '../../components/map/FreeStreetMap'
import { pg } from '../../design/tokens'
import { CTA, IconButton, Surface } from '../../design/primitives'

type DpSpot = {
  id: string
  lat: number
  lng: number
  dist: number
  vehicle_type: string | null
  full_name: string
}

const RADIUS_STEPS_M = [2000, 5000, 10000]
const RADIUS_STEP_INTERVAL_MS = 8000
const SCAN_INTERVAL_MS = 3500
const DEFAULT_MAP_RADIUS_M = 10_000

/** Offset a point roughly by distance/bearing for map display when RPC omits coords */
function offsetFromCenter(lat: number, lng: number, distM: number, angleDeg: number): { lat: number; lng: number } {
  const R = 6371000
  const br = (angleDeg * Math.PI) / 180
  const d = Math.max(40, distM)
  const lat1 = (lat * Math.PI) / 180
  const lng1 = (lng * Math.PI) / 180
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d / R) + Math.cos(lat1) * Math.sin(d / R) * Math.cos(br))
  const lng2 =
    lng1 +
    Math.atan2(Math.sin(br) * Math.sin(d / R) * Math.cos(lat1), Math.cos(d / R) - Math.sin(lat1) * Math.sin(lat2))
  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI }
}

export default function ScanningPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const gps = useGps(profile?.id, !!profile)

  const [phase, setPhase] = useState<'scanning' | 'found' | 'none'>('scanning')
  const [dpCount, setDpCount] = useState(0)
  const [avgDist, setAvgDist] = useState(0)
  const [spots, setSpots] = useState<DpSpot[]>([])
  const [scanCount, setScanCount] = useState(0)
  const [requestCancelled, setRequestCancelled] = useState(false)
  const [radiusStepIndex, setRadiusStepIndex] = useState(0)
  const [waitingForAccept, setWaitingForAccept] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [retrying, setRetrying] = useState(false)
  const [partnerFound, setPartnerFound] = useState(false)

  const scanRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scanCountRef = useRef(0)
  const radiusStepRef = useRef(0)
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const radiusMeters = RADIUS_STEPS_M[radiusStepIndex]
  const centerLat = gps.lat ?? profile?.gps_lat ?? null
  const centerLng = gps.lng ?? profile?.gps_lng ?? null
  const center = centerLat != null && centerLng != null ? { lat: centerLat, lng: centerLng } : null

  useEffect(() => {
    elapsedRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000)
    return () => {
      if (elapsedRef.current) clearInterval(elapsedRef.current)
    }
  }, [])

  useEffect(() => {
    if (phase !== 'scanning') return
    const stepTimer = setInterval(() => {
      if (radiusStepRef.current < RADIUS_STEPS_M.length - 1) {
        radiusStepRef.current += 1
        setRadiusStepIndex(radiusStepRef.current)
      }
    }, RADIUS_STEP_INTERVAL_MS)
    return () => clearInterval(stepTimer)
  }, [phase])

  const triggerRetry = () => {
    setRetrying(true)
    setSpots([])
    setDpCount(0)
    radiusStepRef.current = 0
    setRadiusStepIndex(0)
    retryTimeoutRef.current = setTimeout(() => setRetrying(false), 1200)
  }

  useEffect(() => {
    const doScan = async () => {
      if (centerLat == null || centerLng == null) return
      try {
        const { data } = await supabase.rpc('scan_nearby_dps', {
          p_user_lat: centerLat,
          p_user_lng: centerLng,
          p_radius_meters: radiusMeters,
          p_request_id: requestId,
        })
        const dps = (data as any[]) || []
        const count = dps.length
        const avg = count > 0 ? dps.reduce((s, d) => s + Number(d.distance_meters || 0), 0) / count : 0
        setDpCount(count)
        setAvgDist(avg)
        scanCountRef.current += 1
        setScanCount(scanCountRef.current)
        if (count > 0) {
          setWaitingForAccept(true)
          setSpots(
            dps.slice(0, 8).map((d, i) => {
              const dist = Number(d.distance_meters || 0)
              const hasCoords = d.gps_lat != null && d.gps_lng != null
              const pos = hasCoords
                ? { lat: Number(d.gps_lat), lng: Number(d.gps_lng) }
                : offsetFromCenter(centerLat, centerLng, dist || 200 + i * 80, i * (360 / Math.min(count, 8)))
              return {
                id: d.dp_user_id || `dp-${i}`,
                lat: pos.lat,
                lng: pos.lng,
                dist,
                vehicle_type: d.vehicle_type || null,
                full_name: d.full_name || 'Partner',
              }
            })
          )
        } else {
          setSpots([])
          if (scanCountRef.current > 0 && scanCountRef.current % 3 === 0) triggerRetry()
        }
      } catch (e) {
        console.error('scan_nearby_dps failed', e)
      }
    }
    doScan()
    scanRef.current = setInterval(doScan, SCAN_INTERVAL_MS)
    return () => {
      if (scanRef.current) clearInterval(scanRef.current)
    }
  }, [centerLat, centerLng, requestId, radiusMeters])

  useEffect(() => {
    if (!requestId) return
    const channel = supabase
      .channel(`scanning-accept-${requestId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'requests', filter: `id=eq.${requestId}` },
        (payload: any) => {
          const next = payload.new as any
          const reservedStatus =
            next?.status === 'accepted' ||
            next?.status === 'dp_reserved' ||
            next?.status === 'waiting_payment'
          const hasDp = next?.accepted_dp_id || next?.reserved_dp_id
          if (reservedStatus && hasDp) {
            if (scanRef.current) clearInterval(scanRef.current)
            if (elapsedRef.current) clearInterval(elapsedRef.current)
            setPartnerFound(true)
            setTimeout(() => {
              navigate(`/app/track/${requestId}`, { replace: true })
            }, 2000)
          }
          if (next?.status === 'cancelled' || next?.status === 'expired') {
            navigate('/app')
          }
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [requestId, navigate])

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
    }
  }, [])

  const cancelRequest = async () => {
    if (!requestId) return
    setRequestCancelled(true)
    await supabase.from('requests').update({ status: 'cancelled' }).eq('id', requestId)
    navigate('/app')
  }

  const scanAgain = () => {
    scanCountRef.current = 0
    setScanCount(0)
    setSpots([])
    setDpCount(0)
    radiusStepRef.current = 0
    setRadiusStepIndex(0)
    setPhase('scanning')
  }

  const radiusLabel = formatDistance(radiusMeters)
  const estimatedWaitSeconds = (() => {
    if (dpCount > 0) return 30 + Math.max(0, 60 - dpCount * 8)
    return Math.min(60 + radiusStepIndex * 45, 300)
  })()
  const fmtWait = (s: number) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`)

  const markers: MapMarker[] = useMemo(() => {
    const list: MapMarker[] = []
    if (center) list.push({ id: 'user', position: center, kind: 'user' })
    spots.forEach(s => {
      list.push({ id: s.id, position: { lat: s.lat, lng: s.lng }, kind: 'bike', label: s.full_name })
    })
    return list
  }, [center, spots])

  if (partnerFound) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 px-6" style={{ background: '#050505' }}>
        <img
          src={Images.orderAccepted}
          alt="Order accepted"
          className="w-full max-w-md object-contain"
          style={{ borderRadius: 28 }}
          draggable={false}
        />
        <p className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.45)' }}>Opening order tracking…</p>
      </div>
    )
  }

  if (gps.permissionDenied) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 px-8 text-center" style={{ background: pg.bg }}>
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl" style={{ background: 'rgba(239,68,68,0.1)' }}>
          <MapPinOff size={40} className="text-red-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Location Access Required</h2>
          <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Please allow location access so we can find delivery partners near you.
          </p>
        </div>
        <CTA onClick={() => gps.requestPermission()}>Allow Location</CTA>
        <button onClick={cancelRequest} className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden" style={{ background: pg.bg }}>
      <div className="flex items-center justify-between px-5 pb-2 pt-12 shrink-0">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em]" style={{ color: pg.lime }}>
            {waitingForAccept ? 'Waiting' : 'Scanning'}
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            {waitingForAccept ? 'Partner nearby' : 'Finding partners'}
          </h1>
        </div>
        <IconButton onClick={cancelRequest} disabled={requestCancelled} className="!h-11 !w-11">
          <X size={18} />
        </IconButton>
      </div>

      <div className="relative mx-3 h-[46vh] min-h-[260px] overflow-hidden shrink-0" style={{ borderRadius: 28, border: '1px solid rgba(255,255,255,0.1)' }}>
        {center ? (
          <FreeStreetMap
            center={center}
            zoom={radiusStepIndex === 0 ? 14 : radiusStepIndex === 1 ? 13 : 12}
            markers={markers}
            radiusMeters={DEFAULT_MAP_RADIUS_M}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm" style={{ background: pg.surface, color: pg.text3 }}>
            Detecting your location…
          </div>
        )}
        <div
          className="pointer-events-none absolute right-3 top-3 rounded-full px-3 py-1.5 text-xs font-extrabold"
          style={{ background: 'rgba(5,5,5,0.9)', color: pg.lime, border: '1px solid rgba(212,240,0,0.35)' }}
        >
          Radius {radiusLabel}
        </div>
      </div>

      <div className="flex items-center gap-4 px-5 py-4 shrink-0">
        <img src={Images.userWaiting} alt="" className="h-36 w-32 object-contain" draggable={false} />
        <div className="flex-1">
          <h2 className="text-lg font-bold text-white">
            {waitingForAccept
              ? 'Waiting for Partner to Accept...'
              : retrying
              ? 'Retrying search...'
              : dpCount > 0
              ? `${dpCount} Partner${dpCount > 1 ? 's' : ''} Nearby`
              : 'Searching nearby Delivery Partners...'}
          </h2>
          <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {retrying
              ? 'Expanding search radius and retrying...'
              : `Scan #${scanCount} · ${fmtWait(elapsedSeconds)} elapsed`}
          </p>
        </div>
      </div>

      <div className="px-6 py-1.5 shrink-0">
        <div className="flex items-center justify-between gap-1">
          {RADIUS_STEPS_M.map((step, i) => (
            <div
              key={step}
              className="flex-1 rounded-full py-1 text-center text-[10px] font-bold transition-all"
              style={{
                background: i <= radiusStepIndex ? 'rgba(212,240,0,0.18)' : 'rgba(255,255,255,0.05)',
                color: i <= radiusStepIndex ? pg.lime : pg.text4,
                border: i === radiusStepIndex ? '1px solid rgba(212,240,0,0.4)' : '1px solid transparent',
              }}
            >
              {formatDistance(step)}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-10">
        {waitingForAccept || phase === 'scanning' ? (
          <Surface
            className="p-4"
            accent={waitingForAccept}
            style={!waitingForAccept ? { background: pg.bgElevated } : undefined}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: pg.limeDim }}>
                {waitingForAccept ? (
                  <Loader2 size={18} style={{ color: pg.lime }} className="animate-spin" />
                  ) : retrying ? (
                  <RefreshCw size={18} style={{ color: pg.lime }} className="animate-spin" />
                  ) : (
                  <Radar size={18} style={{ color: pg.lime }} className="animate-pulse" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">
                  {dpCount > 0 ? `${dpCount} partner${dpCount > 1 ? 's' : ''} notified` : 'Searching...'}
                </p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {dpCount > 0 && avgDist > 0 ? `Avg ${formatDistance(avgDist)} away` : 'Your request is live — partners can see it'}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-2xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="flex items-center gap-1.5">
                <Clock size={13} style={{ color: 'rgba(255,255,255,0.5)' }} />
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>Est. wait</p>
              </div>
              <p className="text-xs font-extrabold" style={{ color: pg.lime }}>{fmtWait(estimatedWaitSeconds)}</p>
            </div>
            <p className="mt-2 text-center text-xs" style={{ color: pg.text3 }}>
              Order tracking opens automatically when a partner accepts
            </p>
          </Surface>
        ) : (
          <div className="space-y-2">
            <Surface className="p-4 text-center">
              <MapPin size={24} className="mx-auto mb-2" style={{ color: pg.text3 }} />
              <p className="font-extrabold">No Partners Online Nearby</p>
              <p className="mt-1 text-xs" style={{ color: pg.text3 }}>
                Your request is live — a partner may accept shortly.
              </p>
            </Surface>
            <div className="flex gap-2">
              <CTA variant="secondary" onClick={cancelRequest} disabled={requestCancelled} className="flex-1">
                Cancel
              </CTA>
              <CTA variant="secondary" onClick={scanAgain} className="flex-1">
                <RefreshCw size={15} /> Scan Again
              </CTA>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
