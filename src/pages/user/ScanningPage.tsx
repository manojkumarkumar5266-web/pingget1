import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase } from '../../lib/supabase'
import { formatDistance } from '../../lib/utils'
import { CheckCircle2, ChevronRight, X, Bike, Car, Truck, MapPin, Clock, Search, RefreshCw, Navigation } from 'lucide-react'

type DpSpot = {
  id: string
  angle: number
  radius: number
  dist: number
  vehicle_type: string | null
  full_name: string
}

const MIN_RADIUS_M = 100
const MAX_RADIUS_KM = 10
const MAX_RADIUS_M = MAX_RADIUS_KM * 1000
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

  const [phase, setPhase] = useState<'scanning' | 'found' | 'none'>('scanning')
  const [dpCount, setDpCount] = useState(0)
  const [avgDist, setAvgDist] = useState(0)
  const [spots, setSpots] = useState<DpSpot[]>([])
  const [scanCount, setScanCount] = useState(0)
  const [requestCancelled, setRequestCancelled] = useState(false)
  const [radiusMeters, setRadiusMeters] = useState(MAX_RADIUS_M)
  const [ringScale, setRingScale] = useState(0.1)

  const scanRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scanCountRef = useRef(0)
  const ringRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Expanding ring animation — center to edge, repeating
  useEffect(() => {
    if (phase !== 'scanning') return
    setRingScale(0.1)
    ringRef.current = setInterval(() => {
      setRingScale(s => {
        if (s >= 1) return 0.1
        return s + 0.015
      })
    }, 30)
    return () => { if (ringRef.current) clearInterval(ringRef.current) }
  }, [phase])

  // Scan for nearby DPs — repeat until DP accepts
  useEffect(() => {
    const doScan = async () => {
      if (!profile?.gps_lat || !profile?.gps_lng) return
      try {
        const { data } = await supabase.rpc('scan_nearby_dps', {
          p_user_lat: profile.gps_lat,
          p_user_lng: profile.gps_lng,
          p_radius_meters: radiusMeters,
          p_request_id: requestId,
        })
        const dps = (data as any[]) || []
        const count = dps.length
        const avg = count > 0
          ? dps.reduce((s, d) => s + Number(d.distance_meters || 0), 0) / count
          : 0
        setDpCount(count)
        setAvgDist(avg)
        scanCountRef.current += 1
        setScanCount(scanCountRef.current)

        if (count > 0) {
          const newSpots: DpSpot[] = dps.slice(0, 8).map((d, i) => {
            const dist = Number(d.distance_meters || 0)
            const radiusPct = radiusMeters > 0
              ? 35 + Math.min(55, (dist / radiusMeters) * 55)
              : 50
            return {
              id: d.dp_user_id || `dp-${i}`,
              angle: (i * (360 / Math.min(count, 8)) + (dist % 30)) % 360,
              radius: radiusPct,
              dist,
              vehicle_type: d.vehicle_type || null,
              full_name: d.full_name || 'Partner',
            }
          })
          setSpots(newSpots)
        } else {
          setSpots([])
        }

        // Keep scanning — no max scan limit, repeat until DP accepts
      } catch (error) {
        console.error("scan_nearby_dps failed", error)
      }
    }

    doScan()
    scanRef.current = setInterval(doScan, SCAN_INTERVAL_MS)
    return () => { if (scanRef.current) clearInterval(scanRef.current) }
  }, [profile, requestId, radiusMeters])

  // Listen for acceptance — auto navigate to chat
  useEffect(() => {
    if (!requestId) return
    const channel = supabase
      .channel(`scanning-accept-${requestId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'requests',
        filter: `id=eq.${requestId}`,
      }, (payload: any) => {
        const next = payload.new as any
        if (next?.status === 'accepted' && next?.accepted_dp_id) {
          if (scanRef.current) clearInterval(scanRef.current)
          if (ringRef.current) clearInterval(ringRef.current)
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
    setRequestCancelled(true)
    await supabase.from('requests').update({ status: 'cancelled' }).eq('id', requestId)
    navigate('/app')
  }

  const viewOrder = () => navigate('/app/orders')

  const scanAgain = () => {
    scanCountRef.current = 0
    setScanCount(0)
    setSpots([])
    setDpCount(0)
    setPhase('scanning')
  }

  const size = 240
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 10

  const radiusKm = (radiusMeters / 1000).toFixed(radiusMeters < 1000 ? 1 : 0)

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-black">

      {/* Scanner — expanding circle from center to edge */}
      <div className="relative flex h-[30vh] min-h-[220px] w-full items-center justify-center overflow-hidden">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="max-h-full">
          {/* Background rings */}
          {[0.25, 0.5, 0.75, 1].map((pct, i) => (
            <circle key={i} cx={cx} cy={cy} r={r * pct}
              fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
          ))}

          {/* Expanding scan circle — center to edge, repeating */}
          {phase === 'scanning' && (
            <circle cx={cx} cy={cy} r={r * ringScale}
              fill="none" stroke="#facc15" strokeWidth={2.5}
              opacity={1 - ringScale * 0.8} />
          )}
          {phase === 'scanning' && ringScale < 0.5 && (
            <circle cx={cx} cy={cy} r={r * ringScale * 0.6}
              fill="rgba(250,204,21,0.05)" stroke="none" />
          )}

          {/* DP vehicle markers — yellow */}
          {spots.map(spot => {
            const rad = (spot.angle * Math.PI) / 180
            const dr = (spot.radius / 100) * r
            const dx = cx + dr * Math.cos(rad)
            const dy = cy + dr * Math.sin(rad)
            const Icon = vehicleIcon(spot.vehicle_type)
            return (
              <g key={spot.id}>
                <circle cx={dx} cy={dy} r={14} fill="none"
                  stroke="#facc15" strokeWidth={1.5} opacity={0.5} />
                <circle cx={dx} cy={dy} r={11} fill="#facc15" opacity={0.9} />
                <g transform={`translate(${dx - 8}, ${dy - 8}) scale(0.66)`}>
                  <Icon size={24} className="text-black" strokeWidth={2.5} />
                </g>
              </g>
            )
          })}

          {/* Center user dot — red */}
          <circle cx={cx} cy={cy} r={8} fill="#ef4444" />
          <circle cx={cx} cy={cy} r={14} fill="none" stroke="#ef4444" strokeWidth={2} opacity={0.5} />
          <circle cx={cx} cy={cy} r={20} fill="none" stroke="#ef4444" strokeWidth={1} opacity={0.25} />
        </svg>

        {/* Pulsing rings behind scanner */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {[1, 2, 3].map(i => (
            <div key={i} className="absolute rounded-full border border-yellow-800/20"
              style={{
                width: size * (0.3 + i * 0.25),
                height: size * (0.3 + i * 0.25),
                animation: `ping ${1.8 + i * 0.4}s cubic-bezier(0,0,0.2,1) infinite`,
                animationDelay: `${i * 0.5}s`,
              }} />
          ))}
        </div>

        {/* Cancel button overlay */}
        {phase === 'scanning' && (
          <button onClick={cancelRequest} disabled={requestCancelled}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-white/40 hover:text-white/80 transition-colors"
            style={{ background: 'rgba(255,255,255,0.07)' }}>
            <X size={18} />
          </button>
        )}
      </div>

      {/* Status text below scanner */}
      <div className="px-5 pt-3 text-center">
        <p className="text-xs font-medium text-white/40 uppercase tracking-widest">
          {phase === 'scanning' ? 'Scanning...' : phase === 'found' ? 'Partners Found' : 'Search Complete'}
        </p>
        <h2 className="text-lg font-bold text-white mt-0.5">
          {phase === 'scanning'
            ? 'Finding nearby partners'
            : phase === 'found'
            ? `${dpCount} partner${dpCount === 1 ? '' : 's'} nearby`
            : 'No partners in range'}
        </h2>
        <p className="text-[10px] text-white/40 mt-0.5">Search radius: {radiusKm} km</p>
      </div>

      {/* Radius slider */}
      <div className="px-8 py-3">
        <div className="flex items-center justify-between text-[10px] text-white/40 mb-1">
          <span>100m</span>
          <span>10km</span>
        </div>
        <input
          type="range"
          min={MIN_RADIUS_M}
          max={MAX_RADIUS_M}
          step={100}
          value={radiusMeters}
          onChange={e => setRadiusMeters(Number(e.target.value))}
          className="dp-range-slider w-full"
          style={{
            background: `linear-gradient(to right, #facc15 ${(radiusMeters - MIN_RADIUS_M) / (MAX_RADIUS_M - MIN_RADIUS_M) * 100}%, rgba(255,255,255,0.1) ${(radiusMeters - MIN_RADIUS_M) / (MAX_RADIUS_M - MIN_RADIUS_M) * 100}%)`,
          }}
        />
      </div>

      {/* Scan count */}
      <div className="flex items-center justify-center gap-1.5 py-2">
        <p className="text-xs text-white/30">Scan #{scanCount} · repeats until a partner accepts</p>
      </div>

      {/* Legend — user (red) and DP (yellow) */}
      <div className="flex items-center justify-center gap-4 px-5">
        <div className="flex items-center gap-1.5 text-xs text-white/50">
          <div className="h-3 w-3 rounded-full bg-red-500" /> You
        </div>
        <div className="flex items-center gap-1.5 text-xs text-white/50">
          <div className="h-3 w-3 rounded-full bg-yellow-400" /> Delivery Partner
        </div>
      </div>

      {/* Bottom status panel */}
      <div className="flex flex-1 flex-col justify-end px-5 pb-10">
        {phase === 'scanning' && (
          <div className="rounded-2xl p-5 text-center" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="mb-3 flex items-center justify-center gap-2">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                <Search size={20} className="text-white animate-pulse" />
              </div>
            </div>
            <p className="text-sm font-medium text-white/60">
              {dpCount > 0
                ? `${dpCount} partner${dpCount === 1 ? '' : 's'} found so far${avgDist > 0 ? ` · avg ${formatDistance(avgDist)} away` : ''}`
                : 'Scanning for delivery partners...'}
            </p>
            <p className="mt-1 text-xs text-white/30">Your request is live — partners can see it now</p>
            <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-white/5 px-3 py-2">
              <Clock size={14} className="text-white/60 shrink-0" />
              <p className="text-xs text-white/70">Chat opens automatically when a partner accepts</p>
            </div>
          </div>
        )}

        {phase === 'found' && (
          <div className="space-y-3">
            <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                  <Navigation size={24} className="text-yellow-400" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-white">
                    {dpCount} partner{dpCount === 1 ? '' : 's'} available!
                  </p>
                  <p className="text-xs text-white/50">
                    {avgDist > 0 ? `Average ${formatDistance(avgDist)} away` : 'Ready to accept your request'}
                  </p>
                </div>
                <CheckCircle2 size={22} className="text-yellow-400 shrink-0" />
              </div>
              {spots.slice(0, 2).map((spot, i) => {
                const Icon = vehicleIcon(spot.vehicle_type)
                return (
                  <div key={spot.id} className="mt-2 flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
                    <Icon size={14} className="text-yellow-400" />
                    <span className="text-xs text-white/80">Partner {i + 1}{spot.dist ? ` · ${formatDistance(spot.dist)} away` : ''}</span>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-3">
              <button onClick={scanAgain}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white/80 transition-all active:scale-95"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <RefreshCw size={16} /> Scan Again
              </button>
              <button onClick={viewOrder}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white transition-all active:scale-95 bg-white/10">
                Track Request <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {phase === 'none' && (
          <div className="space-y-3">
            <div className="rounded-2xl p-5 text-center" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <MapPin size={24} className="mx-auto mb-2 text-white/50" />
              <p className="font-semibold text-white">No partners online nearby right now</p>
              <p className="mt-1 text-xs text-white/40">
                Your request is still live — a partner may accept it shortly
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={cancelRequest} disabled={requestCancelled}
                className="flex-1 rounded-2xl py-3.5 text-sm font-semibold text-white/60 transition-all active:scale-95"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                Cancel Request
              </button>
              <button onClick={scanAgain}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white transition-all active:scale-95 bg-white/10">
                <RefreshCw size={16} /> Scan Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
