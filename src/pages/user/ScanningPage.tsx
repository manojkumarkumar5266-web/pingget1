import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase } from '../../lib/supabase'
import { formatDistance } from '../../lib/utils'
import { CheckCircle2, ChevronRight, Bike, X } from 'lucide-react'

type DpDot = { id: string; angle: number; radius: number; dist: number }

const SCAN_RADIUS_KM = 5
const SCAN_INTERVAL_MS = 3500
const MAX_SCANS = 6

export default function ScanningPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [phase, setPhase] = useState<'scanning' | 'found' | 'none'>('scanning')
  const [dpCount, setDpCount] = useState(0)
  const [avgDist, setAvgDist] = useState(0)
  const [dots, setDots] = useState<DpDot[]>([])
  const [scanAngle, setScanAngle] = useState(0)
  const [scanCount, setScanCount] = useState(0)
  const [requestCancelled, setRequestCancelled] = useState(false)

  const sweepRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scanRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scanCountRef = useRef(0)

  // Animate sweep line
  useEffect(() => {
    sweepRef.current = setInterval(() => {
      setScanAngle(a => (a + 3) % 360)
    }, 30)
    return () => { if (sweepRef.current) clearInterval(sweepRef.current) }
  }, [])

  // Scan for DPs
  useEffect(() => {
    const doScan = async () => {
      if (!profile?.gps_lat || !profile?.gps_lng) return
      try {
        const { data } = await supabase.rpc('scan_nearby_dps_stats', {
          p_user_lat: profile.gps_lat,
          p_user_lng: profile.gps_lng,
          p_radius_meters: SCAN_RADIUS_KM * 1000,
          p_request_id: requestId,
        })
        const row = data?.[0]
        const count = row?.dp_count ?? 0
        const avg = row?.avg_distance_meters ?? 0
        setDpCount(count)
        setAvgDist(avg)
        scanCountRef.current += 1
        setScanCount(scanCountRef.current)

        // Generate dot positions for found DPs
        if (count > 0) {
          const newDots: DpDot[] = Array.from({ length: Math.min(count, 8) }, (_, i) => ({
            id: `dp-${i}`,
            angle: (i * (360 / Math.min(count, 8)) + Math.random() * 30) % 360,
            radius: 35 + Math.random() * 40,
            dist: avg * (0.7 + Math.random() * 0.6),
          }))
          setDots(newDots)
        }

        if (scanCountRef.current >= MAX_SCANS) {
          if (sweepRef.current) clearInterval(sweepRef.current)
          if (scanRef.current) clearInterval(scanRef.current)
          setPhase(count > 0 ? 'found' : 'none')
        }
      } catch (error) {
  console.error("scan_nearby_dps_stats failed", error);
}

    doScan()
    scanRef.current = setInterval(doScan, SCAN_INTERVAL_MS)
    return () => { if (scanRef.current) clearInterval(scanRef.current) }
  }, [profile])

  const cancelRequest = async () => {
    if (!requestId) return
    setRequestCancelled(true)
    await supabase.from('requests').update({ status: 'cancelled' }).eq('id', requestId)
    navigate('/app')
  }

  const viewOrder = () => navigate('/app/orders')

  const size = 280 // radar circle diameter
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 10

  const sweepRad = (scanAngle * Math.PI) / 180
  const sweepX = cx + r * Math.cos(sweepRad)
  const sweepY = cy + r * Math.sin(sweepRad)

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #0f1a0d 0%, #1a2a0e 100%)' }}>

      {/* Top bar */}
      <div className="flex w-full max-w-md items-center justify-between px-5 pt-12">
        <div>
          <p className="text-xs font-medium text-white/40 uppercase tracking-widest">
            {phase === 'scanning' ? 'Scanning...' : phase === 'found' ? 'Partners Found' : 'Search Complete'}
          </p>
          <h2 className="text-xl font-bold text-white mt-0.5">
            {phase === 'scanning'
              ? 'Finding nearby partners'
              : phase === 'found'
              ? `${dpCount} partner${dpCount === 1 ? '' : 's'} nearby`
              : 'No partners in range'}
          </h2>
        </div>
        {phase === 'scanning' && (
          <button onClick={cancelRequest} disabled={requestCancelled}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/40 hover:text-white/80 transition-colors"
            style={{ background: 'rgba(255,255,255,0.07)' }}>
            <X size={18} />
          </button>
        )}
      </div>

      {/* Radar */}
      <div className="relative flex items-center justify-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background rings */}
          {[0.25, 0.5, 0.75, 1].map((pct, i) => (
            <circle key={i} cx={cx} cy={cy} r={r * pct}
              fill="none" stroke="rgba(128,160,0,0.15)" strokeWidth={1} />
          ))}

          {/* Sweep gradient */}
          <defs>
            <radialGradient id="sweepGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#809000" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#809000" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Sweep sector — 60 degree cone */}
          {phase === 'scanning' && (() => {
            const sweepEndRad = ((scanAngle - 60) * Math.PI) / 180
            const x1 = cx + r * Math.cos(sweepRad)
            const y1 = cy + r * Math.sin(sweepRad)
            const x2 = cx + r * Math.cos(sweepEndRad)
            const y2 = cy + r * Math.sin(sweepEndRad)
            return (
              <path
                d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 0 ${x2} ${y2} Z`}
                fill="url(#sweepGrad)"
              />
            )
          })()}

          {/* Sweep line */}
          {phase === 'scanning' && (
            <line x1={cx} y1={cy} x2={sweepX} y2={sweepY}
              stroke="#a0b800" strokeWidth={2} opacity={0.8} />
          )}

          {/* DP dots */}
          {dots.map(dot => {
            const rad = (dot.angle * Math.PI) / 180
            const dr = (dot.radius / 100) * r
            const dx = cx + dr * Math.cos(rad)
            const dy = cy + dr * Math.sin(rad)
            return (
              <g key={dot.id}>
                <circle cx={dx} cy={dy} r={6} fill="#ffd700" opacity={0.9} />
                <circle cx={dx} cy={dy} r={10} fill="none" stroke="#ffd700"
                  strokeWidth={1.5} opacity={0.4} />
              </g>
            )
          })}

          {/* Center user dot */}
          <circle cx={cx} cy={cy} r={8} fill="#ff4444" />
          <circle cx={cx} cy={cy} r={14} fill="none" stroke="#ff4444" strokeWidth={2} opacity={0.5} />
          <circle cx={cx} cy={cy} r={20} fill="none" stroke="#ff4444" strokeWidth={1} opacity={0.25} />
        </svg>

        {/* Pulsing rings behind radar */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {[1, 2, 3].map(i => (
            <div key={i} className="absolute rounded-full border border-yellow-700/20"
              style={{
                width: size * (0.3 + i * 0.25),
                height: size * (0.3 + i * 0.25),
                animation: `ping ${1.8 + i * 0.4}s cubic-bezier(0,0,0.2,1) infinite`,
                animationDelay: `${i * 0.5}s`,
              }} />
          ))}
        </div>
      </div>

      {/* Bottom status panel */}
      <div className="w-full max-w-md px-5 pb-10">

        {/* Scan count indicator */}
        <div className="mb-4 flex items-center justify-center gap-1.5">
          {Array.from({ length: MAX_SCANS }).map((_, i) => (
            <div key={i}
              className="h-1.5 rounded-full transition-all duration-500"
              style={{
                width: i < scanCount ? 20 : 8,
                background: i < scanCount ? '#808000' : 'rgba(255,255,255,0.15)',
              }} />
          ))}
        </div>

        {phase === 'scanning' && (
          <div className="rounded-2xl p-5 text-center" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-sm font-medium text-white/60">
              {dpCount > 0
                ? `${dpCount} partner${dpCount === 1 ? '' : 's'} found so far${avgDist > 0 ? ` · avg ${formatDistance(avgDist)} away` : ''}`
                : 'Scanning for delivery partners...'}
            </p>
            <p className="mt-1 text-xs text-white/30">Your request is live — partners can see it now</p>
          </div>
        )}

        {phase === 'found' && (
          <div className="space-y-3">
            <div className="rounded-2xl p-5" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                  style={{ background: 'rgba(16,185,129,0.2)' }}>
                  <Bike size={24} className="text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-white">
                    {dpCount} partner{dpCount === 1 ? '' : 's'} available!
                  </p>
                  <p className="text-xs text-white/50">
                    {avgDist > 0 ? `Average ${formatDistance(avgDist)} away` : 'Ready to accept your request'}
                  </p>
                </div>
                <CheckCircle2 size={22} className="text-green-400 shrink-0" />
              </div>
            </div>
            <button onClick={viewOrder}
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, #808000, #606000)' }}>
              Track My Request <ChevronRight size={18} />
            </button>
          </div>
        )}

        {phase === 'none' && (
          <div className="space-y-3">
            <div className="rounded-2xl p-5 text-center" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
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
              <button onClick={viewOrder}
                className="flex-1 rounded-2xl py-3.5 text-sm font-bold text-white transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg, #808000, #606000)' }}>
                Track Order
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
