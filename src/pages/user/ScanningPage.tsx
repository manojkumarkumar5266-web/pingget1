import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase } from '../../lib/supabase'
import { useGps } from '../../hooks/useGps'
import { formatDistance } from '../../lib/utils'
import {
  CheckCircle2, X, Bike, Car, Truck, MapPin, Clock, RefreshCw,
  Navigation, Search, MapPinOff, Loader2, Radar,
} from 'lucide-react'

type DpSpot = {
  id: string
  angle: number
  radius: number
  dist: number
  vehicle_type: string | null
  full_name: string
}

const RADIUS_STEPS_M = [500, 1000, 2000, 5000, 10000]
const RADIUS_STEP_INTERVAL_MS = 8000
const SCAN_INTERVAL_MS = 3500

function vehicleIcon(vehicleType: string | null) {
  const v = (vehicleType || '').toLowerCase()
  if (v === 'bicycle' || v === 'motorbike' || v === 'scooter' || v === 'auto') return Bike
  if (v === 'car') return Car
  return Truck
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
  const [ringScale, setRingScale] = useState(0.1)
  const [partnerFound, setPartnerFound] = useState(false)
  const [waitingForAccept, setWaitingForAccept] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [retrying, setRetrying] = useState(false)
  const [orderType, setOrderType] = useState<'instant' | 'advance' | null>(null)

  const scanRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scanCountRef = useRef(0)
  const ringRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const radiusStepRef = useRef(0)
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const radiusMeters = RADIUS_STEPS_M[radiusStepIndex]

  useEffect(() => {
    if (!requestId) return
    supabase
      .from('requests')
      .select('order_type')
      .eq('id', requestId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setOrderType(data.order_type as 'instant' | 'advance')
      })
  }, [requestId])

  useEffect(() => {
    if (phase !== 'scanning') return
    setRingScale(0.1)
    ringRef.current = setInterval(() => {
      setRingScale(s => (s >= 1 ? 0.1 : s + 0.015))
    }, 30)
    return () => {
      if (ringRef.current) clearInterval(ringRef.current)
    }
  }, [phase])

  useEffect(() => {
    elapsedRef.current = setInterval(() => {
      setElapsedSeconds(s => s + 1)
    }, 1000)
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
      const lat = gps.lat ?? profile?.gps_lat ?? null
      const lng = gps.lng ?? profile?.gps_lng ?? null
      if (lat == null || lng == null) return
      try {
        const { data } = await supabase.rpc('scan_nearby_dps', {
          p_user_lat: lat,
          p_user_lng: lng,
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
              const radiusPct = radiusMeters > 0 ? 35 + Math.min(55, (dist / radiusMeters) * 55) : 50
              return {
                id: d.dp_user_id || `dp-${i}`,
                angle: (i * (360 / Math.min(count, 8)) + (dist % 30)) % 360,
                radius: radiusPct,
                dist,
                vehicle_type: d.vehicle_type || null,
                full_name: d.full_name || 'Partner',
              }
            })
          )
        } else {
          setSpots([])
          if (scanCountRef.current > 0 && scanCountRef.current % 3 === 0) {
            triggerRetry()
          }
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
  }, [gps.lat, gps.lng, profile, requestId, radiusMeters])

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
            if (ringRef.current) clearInterval(ringRef.current)
            if (elapsedRef.current) clearInterval(elapsedRef.current)
            setPartnerFound(true)
            setTimeout(() => {
              supabase
                .from('chat_rooms')
                .select('id')
                .eq('request_id', requestId)
                .maybeSingle()
                .then(({ data }) => {
                  if (data) navigate(`/app/chat/${data.id}`)
                  else navigate('/app')
                })
            }, 1800)
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

  const SIZE = 260
  const CX = SIZE / 2
  const CY = SIZE / 2
  const R = SIZE / 2 - 12
  const radiusLabel = formatDistance(radiusMeters)

  const estimatedWaitSeconds = (() => {
    if (dpCount > 0) return 30 + Math.max(0, 60 - dpCount * 8)
    const base = 60 + radiusStepIndex * 45
    return Math.min(base, 300)
  })()
  const fmtWait = (s: number) => {
    if (s < 60) return `${s}s`
    return `${Math.floor(s / 60)}m ${s % 60}s`
  }

  if (partnerFound) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[#0B0B0B] animate-fade-in">
        <div className="relative flex items-center justify-center">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="absolute rounded-full border-2 animate-ping"
              style={{
                width: 60 + i * 50,
                height: 60 + i * 50,
                borderColor: 'rgba(166,179,0,0.3)',
                animationDelay: `${i * 0.2}s`,
                animationDuration: '1.5s',
              }}
            />
          ))}
          <div
            className="relative flex h-24 w-24 items-center justify-center rounded-full animate-success-pop"
            style={{
              background: 'linear-gradient(135deg, #A6B300, #BFD400)',
              boxShadow: '0 0 40px rgba(166,179,0,0.6)',
            }}
          >
            <CheckCircle2 size={44} className="text-[#0B0B0B]" strokeWidth={2.5} />
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white">Partner Found!</h2>
          <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Opening chat...
          </p>
        </div>
      </div>
    )
  }

  if (gps.permissionDenied) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[#0B0B0B] px-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl" style={{ background: 'rgba(239,68,68,0.1)' }}>
          <MapPinOff size={40} className="text-red-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Location Access Required</h2>
          <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Please allow location access so we can find delivery partners near you.
          </p>
        </div>
        <button onClick={() => gps.requestPermission()} className="btn px-6 py-3 text-sm font-bold" style={{ background: '#A6B300', color: '#0B0B0B' }}>
          Allow Location
        </button>
        <button onClick={cancelRequest} className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#0B0B0B]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {waitingForAccept ? 'Waiting' : 'Scanning'}
          </p>
          <h1 className="text-xl font-bold text-white">
            {waitingForAccept ? 'Partner Found' : 'Finding Partners'}
          </h1>
        </div>
        <button
          onClick={cancelRequest}
          disabled={requestCancelled}
          className="flex h-10 w-10 items-center justify-center rounded-full transition-all active:scale-90"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <X size={18} style={{ color: 'rgba(255,255,255,0.6)' }} />
        </button>
      </div>

      {/* Radar */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden" style={{ maxHeight: '48vh' }}>
        {/* Ambient glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="h-64 w-64 rounded-full blur-3xl"
            style={{
              background: dpCount > 0 ? 'rgba(166,179,0,0.06)' : 'transparent',
              transition: 'background 0.8s',
            }}
          />
        </div>

        {/* Pulsing background rings */}
        {phase === 'scanning' &&
          [1, 2, 3].map(i => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: SIZE * (0.3 + i * 0.25),
                height: SIZE * (0.3 + i * 0.25),
                border: '1px solid rgba(166,179,0,0.06)',
                animation: `radarPing ${1.8 + i * 0.4}s ease-out infinite`,
                animationDelay: `${i * 0.5}s`,
              }}
            />
          ))}

        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ position: 'relative', zIndex: 1 }}>
          {/* Background rings */}
          {[0.25, 0.5, 0.75, 1].map((pct, i) => (
            <circle key={i} cx={CX} cy={CY} r={R * pct} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
          ))}

          {/* Accent ring at 50% */}
          <circle cx={CX} cy={CY} r={R * 0.5} fill="none" stroke="rgba(166,179,0,0.12)" strokeWidth={1.5} />

          {/* Expanding scan circle */}
          {phase === 'scanning' && (
            <>
              <circle cx={CX} cy={CY} r={R * ringScale} fill="none" stroke="#A6B300" strokeWidth={2} opacity={1.2 - ringScale * 1.2} />
              <circle cx={CX} cy={CY} r={R * ringScale * 0.75} fill={`rgba(166,179,0,${0.03 * (1 - ringScale)})`} stroke="none" />
            </>
          )}

          {/* DP markers */}
          {spots.map(spot => {
            const rad = (spot.angle * Math.PI) / 180
            const dr = (spot.radius / 100) * R
            const dx = CX + dr * Math.cos(rad)
            const dy = CY + dr * Math.sin(rad)
            const Icon = vehicleIcon(spot.vehicle_type)
            return (
              <g key={spot.id}>
                <circle cx={dx} cy={dy} r={18} fill="rgba(166,179,0,0.08)" stroke="rgba(166,179,0,0.3)" strokeWidth={1.5} />
                <circle cx={dx} cy={dy} r={13} fill="#A6B300" />
                <g transform={`translate(${dx - 9}, ${dy - 9}) scale(0.75)`}>
                  <Icon size={24} style={{ color: '#0B0B0B' }} strokeWidth={2.5} />
                </g>
              </g>
            )
          })}

          {/* User dot — center */}
          <circle cx={CX} cy={CY} r={22} fill="rgba(59,130,246,0.08)" stroke="rgba(59,130,246,0.2)" strokeWidth={1.5} />
          <circle cx={CX} cy={CY} r={10} fill="#3b82f6" />
          <circle cx={CX} cy={CY} r={16} fill="none" stroke="#3b82f6" strokeWidth={1.5} opacity={0.5} />
        </svg>

        <div className="absolute flex flex-col items-center" style={{ top: '50%', transform: 'translateY(30px)', pointerEvents: 'none' }}>
          <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>You</p>
        </div>
      </div>

      {/* Status */}
      <div className="px-5 py-2 text-center">
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
            : `Search radius: ${radiusLabel} · Scan #${scanCount} · ${fmtWait(elapsedSeconds)} elapsed`}
        </p>
      </div>

      {/* Radius stepper */}
      <div className="px-6 py-1.5">
        <div className="flex items-center justify-between gap-1">
          {RADIUS_STEPS_M.map((step, i) => (
            <div
              key={step}
              className="flex-1 rounded-full py-1 text-center text-[10px] font-bold transition-all"
              style={{
                background: i <= radiusStepIndex ? 'rgba(166,179,0,0.18)' : 'rgba(255,255,255,0.05)',
                color: i <= radiusStepIndex ? '#A6B300' : 'rgba(255,255,255,0.3)',
                border: i === radiusStepIndex ? '1px solid rgba(166,179,0,0.4)' : '1px solid transparent',
              }}
            >
              {formatDistance(step)}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-5 pb-1">
        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
          <div className="h-2.5 w-2.5 rounded-full bg-blue-500" /> You
        </div>
        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
          <div className="h-2.5 w-2.5 rounded-full" style={{ background: '#A6B300' }} /> Partner
        </div>
      </div>

      {/* Bottom Panel */}
      <div className="px-4 pb-10">
        {waitingForAccept ? (
          <div className="rounded-3xl p-4" style={{ background: 'rgba(166,179,0,0.08)', border: '1px solid rgba(166,179,0,0.2)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: 'rgba(166,179,0,0.15)' }}>
                <Loader2 size={18} style={{ color: '#A6B300' }} className="animate-spin" />
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
              <p className="text-xs font-bold" style={{ color: '#A6B300' }}>{fmtWait(estimatedWaitSeconds)}</p>
            </div>
            <p className="mt-2 text-center text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Chat opens automatically when a partner accepts
            </p>
          </div>
        ) : phase === 'scanning' ? (
          <div className="rounded-3xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: 'rgba(166,179,0,0.15)' }}>
                {retrying ? (
                  <RefreshCw size={18} style={{ color: '#A6B300' }} className="animate-spin" />
                ) : (
                  <Radar size={18} style={{ color: '#A6B300' }} className="animate-pulse" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">
                  {retrying ? 'Retrying...' : dpCount > 0 ? `${dpCount} partner${dpCount > 1 ? 's' : ''} online` : 'Searching...'}
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
              <p className="text-xs font-bold" style={{ color: '#A6B300' }}>{fmtWait(estimatedWaitSeconds)}</p>
            </div>
            <p className="mt-2 text-center text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Chat opens automatically when a partner accepts
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="rounded-3xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <MapPin size={24} className="mx-auto mb-2" style={{ color: 'rgba(255,255,255,0.4)' }} />
              <p className="font-bold text-white">No Partners Online Nearby</p>
              <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Your request is live — a partner may accept shortly.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={cancelRequest} disabled={requestCancelled} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={scanAgain}
                className="flex-1 btn flex items-center justify-center gap-2"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'white' }}
              >
                <RefreshCw size={15} /> Scan Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
