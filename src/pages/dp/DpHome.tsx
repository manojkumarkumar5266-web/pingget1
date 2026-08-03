
function getDpGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase, DeliveryRequest, Profile, DeliveryPartner, Order } from '../../lib/supabase'
import { useGps } from '../../hooks/useGps'
import { EmptyState, ServiceStatusBanner, SkeletonList, EarningsCard, CountUp, StatCard } from '../../components/ui'
import { formatTime, formatDistance, haversineDistance, formatCurrency, STATUS_LABELS, STATUS_COLORS } from '../../lib/utils'
import { Package, Clock, MapPin, Check, X, WifiOff, Sliders, Bell, Play, Pause, TrendingUp, Star, Bike, Car, Truck, Activity, Navigation, Wallet, ChevronRight, MapPinOff, Loader2, CalendarClock } from 'lucide-react'

function vehicleIcon(vehicleType: string | null) {
  const v = (vehicleType || '').toLowerCase()
  if (v === 'bicycle' || v === 'motorbike' || v === 'scooter' || v === 'auto') return Bike
  if (v === 'car') return Car
  return Truck
}

type RequestWithUser = DeliveryRequest & { user_profile?: Profile }

function VoicePlayer({ url }: { url: string }) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const toggle = () => {
    try {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; setPlaying(false); return }
      const audio = new Audio(url); audioRef.current = audio
      audio.onended = () => { setPlaying(false); audioRef.current = null }
      audio.onerror = () => { setPlaying(false); audioRef.current = null }
      audio.play().then(() => setPlaying(true)).catch(() => { setPlaying(false); audioRef.current = null })
    } catch { setPlaying(false); audioRef.current = null }
  }
  return (
    <div className="mt-2.5 flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5" style={{ background: 'rgba(166,179,0,0.08)', border: '1px solid rgba(166,179,0,0.18)' }}>
      <button type="button" onClick={toggle} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all active:scale-90"
        style={{ background: '#A6B300' }}>
        {playing ? <Pause size={14} className="text-[#0B0B0B]" /> : <Play size={14} className="text-[#0B0B0B]" />}
      </button>
      <div className="flex flex-1 items-center gap-0.5 h-7">
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} className={`flex-1 rounded-full ${playing ? 'animate-pulse' : ''}`}
            style={{ height: `${30 + Math.sin(i) * 40}%`, background: 'rgba(166,179,0,0.4)', animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
      <p className="text-xs font-medium shrink-0" style={{ color: '#A6B300' }}>{playing ? 'Playing' : 'Voice Note'}</p>
    </div>
  )
}

export default function DpHome() {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [requests, setRequests] = useState<RequestWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [dp, setDp] = useState<DeliveryPartner | null>(null)
  const [dpLoading, setDpLoading] = useState(true)
  const [savingRange, setSavingRange] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [rangeKm, setRangeKm] = useState(5)
  const rangeInitialised = useRef(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [todayOrders, setTodayOrders] = useState<Order[]>([])
  const [weekOrders, setWeekOrders] = useState<Order[]>([])
  const [totalOrders, setTotalOrders] = useState(0)
  const [pendingCommission, setPendingCommission] = useState(0)
  const gps = useGps(profile?.id, true)

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 5000)
  }

  useEffect(() => {
    const fetchDp = async () => {
      const { data } = await supabase.from('delivery_partners').select('*').eq('user_id', profile!.id).maybeSingle()
      setDp(data as DeliveryPartner)
      setDpLoading(false)
    }
    fetchDp()
    const dpChannel = supabase.channel('dp-self-status')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'delivery_partners', filter: `user_id=eq.${profile!.id}` },
        (payload) => setDp(payload.new as DeliveryPartner))
      .subscribe()
    return () => { supabase.removeChannel(dpChannel) }
  }, [profile])

  useEffect(() => {
    if (dpLoading || !profile) return
    const fetchStats = async () => {
      const { data: allOrders } = await supabase.from('orders').select('*').eq('dp_id', profile!.id).eq('status', 'completed')
      const orders = (allOrders as Order[]) || []
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString()
      setTodayOrders(orders.filter(o => o.completed_at && o.completed_at >= todayStart))
      setWeekOrders(orders.filter(o => o.completed_at && o.completed_at >= weekStart))
      setTotalOrders(orders.length)
    }
    fetchStats()
  }, [dpLoading, profile])

  useEffect(() => {
    if (dp && !rangeInitialised.current) {
      rangeInitialised.current = true
      const meters = dp.service_range_meters ?? 5000
      setRangeKm(Math.round(meters / 1000))
    }
  }, [dp])

  useEffect(() => {
    if (dpLoading) return
    if (!dp?.is_online) { setLoading(false); setRequests([]); return }
    setLoading(true)
    const fetchRequests = async () => {
      const { data, error } = await supabase.rpc('get_nearby_requests', { p_dp_user_id: profile!.id })
      if (error) { console.error('[DpHome] get_nearby_requests:', error); setLoading(false); return }
      if (!data) { setLoading(false); return }
      const userIds = [...new Set(data.map((r: any) => r.user_id))]
      let profileMap = new Map<string, Profile>()
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('*').in('id', userIds)
        profiles?.forEach((p: any) => profileMap.set(p.id, p as Profile))
      }
      setRequests((data as DeliveryRequest[]).map(r => ({ ...r, user_profile: profileMap.get(r.user_id) })))
      setLoading(false)
    }
    fetchRequests()
    const channel = supabase.channel('dp-requests')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requests', filter: 'status=eq.pending' },
        () => { showToast('New delivery request nearby!'); fetchRequests() })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requests', filter: 'status=eq.searching_dp' },
        () => { showToast('New advance booking nearby!'); fetchRequests() })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'requests' }, () => fetchRequests())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [dp?.is_online, dpLoading, profile])

  useEffect(() => {
    const checkCommission = async () => {
      if (!profile) return
      const [ordersRes, confirmedRes] = await Promise.all([
        supabase.from('orders').select('commission_amount').eq('dp_id', profile.id).eq('status', 'completed'),
        supabase.from('dp_commission_receipts').select('amount').eq('dp_user_id', profile.id).eq('status', 'confirmed'),
      ])
      const totalOwed = (ordersRes.data || []).reduce((s: number, o: any) => s + Number(o.commission_amount || 0), 0)
      const totalPaid = (confirmedRes.data || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0)
      setPendingCommission(Math.max(0, totalOwed - totalPaid))
    }
    checkCommission()
  }, [profile, todayOrders])

  const changeRange = async (km: number) => {
    setRangeKm(km); setSavingRange(true)
    await supabase.from('delivery_partners').update({ service_range_meters: km * 1000 }).eq('user_id', profile!.id)
    setSavingRange(false)
  }

  const declineRequest = async (req: RequestWithUser) => {
    setRequests(prev => prev.filter(r => r.id !== req.id))
    const { error } = await supabase.rpc('append_declined_by', { row_id: req.id, dp_id: profile!.id })
    if (error) { console.error('[DpHome] decline RPC failed:', error.message); showToast('Could not decline — check your connection.') }
  }

  const acceptRequest = async (req: RequestWithUser) => {
    // For advance bookings in searching_dp status, use the reservation RPC
    if (req.order_type === 'advance' && req.status === 'searching_dp') {
      const { data: reserved, error } = await supabase.rpc(
        'reserve_dp_for_advance',
        { p_request_id: req.id, p_dp_user_id: profile!.id }
      )
      if (error || !reserved) {
        showToast(error?.message || 'Failed to reserve this booking')
        return
      }
      // Navigate to the chat room for this request
      const { data: room } = await supabase.from('chat_rooms').select('id').eq('request_id', req.id).maybeSingle()
      if (room) navigate(`/dp/chat/${room.id}`)
      else navigate('/dp/orders')
      return
    }
    const { data, error } = await supabase.rpc('accept_request', { p_request_id: req.id, p_dp_user_id: profile!.id })
    const row = Array.isArray(data) ? data[0] : data
    if (error || !row?.success) { showToast(row?.error_msg || error?.message || 'Failed to accept request'); return }
    navigate(`/dp/chat/${row.chat_room_id}`)
  }

  const getDistance = (req: DeliveryRequest): number | null => {
    const lat = gps.lat ?? profile?.gps_lat
    const lng = gps.lng ?? profile?.gps_lng
    const r = req as RequestWithUser
    const userLat = r.user_profile?.gps_lat ?? req.pickup_lat ?? req.delivery_lat
    const userLng = r.user_profile?.gps_lng ?? req.pickup_lng ?? req.delivery_lng
    if (!lat || !lng || !userLat || !userLng) return null
    return haversineDistance(lat, lng, userLat, userLng)
  }

  const rangeMeters = rangeKm * 1000
  const filtered = requests.filter(r => {
    const dist = getDistance(r)
    if (dist === null) return true
    return dist <= rangeMeters
  })

  const todayEarnings = todayOrders.reduce((s, o) => s + Number(o.dp_earnings || 0), 0)
  const weekEarnings = weekOrders.reduce((s, o) => s + Number(o.dp_earnings || 0), 0)
  const todayDeliveries = todayOrders.length
  const rating = dp?.rating_avg || 0
  const ratingCount = dp?.rating_count || 0

  if (dpLoading) return <div className="p-4 space-y-3"><SkeletonList count={3} lines={3} /></div>

  const dpFirstName = profile?.full_name?.split(' ')[0] || 'Partner'
  const dpGreetWord = getDpGreeting()

  const GpsBanner = () => {
    if (gps.permissionDenied) {
      return (
        <div className="mb-4 flex items-center gap-3 rounded-2xl px-4 py-3.5 animate-slide-down"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <MapPinOff size={20} className="shrink-0 text-red-400" />
          <div className="flex-1">
            <p className="text-sm font-bold text-red-300">Location Access Required</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Please allow location access to receive delivery requests near you.</p>
          </div>
          <button onClick={() => gps.requestPermission()} className="shrink-0 rounded-xl px-3 py-2 text-xs font-bold text-white" style={{ background: '#ef4444' }}>
            Allow
          </button>
        </div>
      )
    }
    if (gps.loading) {
      return (
        <div className="mb-4 flex items-center gap-2.5 rounded-2xl px-4 py-3 animate-slide-down"
          style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <Loader2 size={16} className="shrink-0 animate-spin text-blue-400" />
          <p className="text-sm text-blue-300">Getting your location...</p>
        </div>
      )
    }
    return null
  }

  if (!dp?.is_online) {
    return (
      <div className="mx-auto max-w-md px-4 py-4">
        <ServiceStatusBanner cityName={profile?.city} />

        <GpsBanner />

        {/* Greeting */}
        <div className="mb-5 animate-fade-in-up">
          <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Good {dpGreetWord},</p>
          <h1 className="text-2xl font-bold text-white leading-tight">{dpFirstName} 👋</h1>
        </div>

        {/* Offline earnings card */}
        <div className="mb-5 animate-slide-up">
          <EarningsCard today={todayEarnings} week={weekEarnings} deliveries={todayDeliveries} />
        </div>

        {/* Stats */}
        <div className="mb-5 grid grid-cols-3 gap-2.5 animate-slide-up" style={{ animationDelay: '80ms' }}>
          <div className="card p-3 text-center">
            <div className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'rgba(245,158,11,0.15)' }}>
              <Star size={16} className="text-yellow-400" />
            </div>
            <p className="text-xl font-bold text-white">{rating > 0 ? rating.toFixed(1) : '—'}</p>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Rating{ratingCount > 0 ? ` (${ratingCount})` : ''}</p>
          </div>
          <div className="card p-3 text-center">
            <div className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'rgba(166,179,0,0.15)' }}>
              <Package size={16} style={{ color: '#A6B300' }} />
            </div>
            <p className="text-xl font-bold text-white">{totalOrders}</p>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Total Orders</p>
          </div>
          <div className="card p-3 text-center">
            <div className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'rgba(59,130,246,0.15)' }}>
              <Activity size={16} className="text-blue-400" />
            </div>
            <p className="text-xl font-bold text-white">Offline</p>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Status</p>
          </div>
        </div>

        {/* Offline message */}
        <div className="flex flex-col items-center justify-center gap-4 text-center animate-fade-in-up py-8 px-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl animate-float" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <WifiOff size={36} style={{ color: 'rgba(255,255,255,0.2)' }} />
          </div>
          <div>
            <p className="text-lg font-bold text-white">You're Offline</p>
            <p className="mt-1.5 max-w-xs text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Tap <strong className="text-green-400">Go Online</strong> in the header to start receiving requests.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-4">
      <ServiceStatusBanner cityName={profile?.city} />

      <GpsBanner />

      {/* Greeting */}
      <div className="mb-5 animate-fade-in-up">
        <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Good {dpGreetWord},</p>
        <h1 className="text-2xl font-bold text-white leading-tight">{dpFirstName} 👋</h1>
      </div>

      {/* Commission due banner */}
      {pendingCommission > 0 && (
        <button onClick={() => navigate('/dp/wallet')} className="mb-4 flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-all active:scale-98 animate-slide-up"
          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <Wallet size={20} className="shrink-0 text-yellow-400" />
          <div className="flex-1">
            <p className="text-sm font-bold text-yellow-300">Commission Due: {formatCurrency(pendingCommission)}</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Tap to pay admin via UPI</p>
          </div>
          <ChevronRight size={16} className="text-yellow-400/60" />
        </button>
      )}

      {/* Toast */}
      {toast && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium animate-slide-down"
          style={{ background: 'rgba(166,179,0,0.1)', border: '1px solid rgba(166,179,0,0.25)', color: '#A6B300' }}>
          <Bell size={14} className="shrink-0" /> {toast}
        </div>
      )}

      {/* Earnings Dashboard */}
      <div className="mb-4 animate-slide-up">
        <EarningsCard today={todayEarnings} week={weekEarnings} deliveries={todayDeliveries} />
      </div>

      {/* Performance Stats */}
      <div className="mb-4 grid grid-cols-3 gap-2.5 animate-slide-up" style={{ animationDelay: '80ms' }}>
        <div className="card p-3 text-center">
          <div className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'rgba(245,158,11,0.15)' }}>
            <Star size={16} className="text-yellow-400" />
          </div>
          <p className="text-xl font-bold text-white">{rating > 0 ? rating.toFixed(1) : '—'}</p>
          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Rating{ratingCount > 0 ? ` (${ratingCount})` : ''}</p>
        </div>
        <div className="card p-3 text-center">
          <div className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'rgba(166,179,0,0.15)' }}>
            <Package size={16} style={{ color: '#A6B300' }} />
          </div>
          <p className="text-xl font-bold text-white">{totalOrders}</p>
          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Total Orders</p>
        </div>
        <div className="card p-3 text-center">
          <div className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'rgba(16,185,129,0.15)' }}>
            <Activity size={16} className="text-green-400" />
          </div>
          <p className="text-xl font-bold text-white">Active</p>
          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Status</p>
        </div>
      </div>

      {/* Service Range */}
      <div className="mb-4 card p-4 animate-slide-up" style={{ animationDelay: '120ms' }}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sliders size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Service Range</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-2xl font-bold" style={{ color: '#A6B300' }}>{rangeKm}</span>
            <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>km</span>
            {savingRange && <span className="ml-1 text-xs animate-pulse" style={{ color: 'rgba(255,255,255,0.3)' }}>saving...</span>}
          </div>
        </div>
        <input type="range" min={1} max={20} step={1} value={rangeKm}
          onChange={e => setRangeKm(Number(e.target.value))}
          onMouseUp={(e: any) => changeRange(Number(e.target.value))}
          onTouchEnd={(e: any) => changeRange(Number(e.target.value))}
          className="dp-range-slider w-full mb-3"
          style={{ background: `linear-gradient(to right, #A6B300 0%, #A6B300 ${((rangeKm - 1) / 19) * 100}%, rgba(255,255,255,0.1) ${((rangeKm - 1) / 19) * 100}%, rgba(255,255,255,0.1) 100%)` }}
        />
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 5, 10, 15, 20].map(km => (
            <button key={km} type="button" onClick={() => { setRangeKm(km); changeRange(km) }}
              className="rounded-full px-3 py-1.5 text-xs font-bold transition-all active:scale-95"
              style={rangeKm === km
                ? { background: '#A6B300', color: '#0B0B0B' }
                : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
              {km} km
            </button>
          ))}
        </div>
        {gps.loading && !gps.lat && (
          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-blue-400">
            <Loader2 size={11} className="shrink-0 animate-spin" />
            <span>Getting your location...</span>
          </div>
        )}
        {gps.permissionDenied && (
          <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <span className="flex items-center gap-1.5 text-red-300"><MapPinOff size={11} /> Location access denied</span>
            <button onClick={() => gps.requestPermission()} className="font-bold text-red-400 hover:text-red-300">Allow</button>
          </div>
        )}
      </div>

      {/* Nearby Requests header */}
      <div className="mb-3 flex items-center justify-between animate-slide-up" style={{ animationDelay: '160ms' }}>
        <div>
          <h3 className="text-base font-bold text-white">Nearby Requests</h3>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {filtered.length} within {rangeKm} km
          </p>
        </div>
      </div>

      {loading ? (
        <SkeletonList count={3} lines={3} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Package size={40} />} title="No requests in range"
          description={gps.loading ? 'Waiting for GPS...' : `No pending requests within ${rangeKm} km. Try increasing your range.`} />
      ) : (
        <div className="space-y-3 pb-8">
          {filtered.map((req, i) => {
            const dist = getDistance(req)
            const VehicleIcon = vehicleIcon(null)
            return (
              <div key={req.id} className="card p-4 animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-semibold text-white leading-snug line-clamp-1 flex-1">
                    {req.description?.split('\n')[0]?.trim() || 'Delivery Request'}
                  </p>
                  {dist !== null && (
                    <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: 'rgba(166,179,0,0.15)', color: '#A6B300', border: '1px solid rgba(166,179,0,0.25)' }}>
                      {formatDistance(dist)}
                    </span>
                  )}
                </div>

                {/* V3 Status badge for advance requests */}
                {req.order_type === 'advance' && req.status !== 'searching_dp' && req.status !== 'pending' && STATUS_LABELS[req.status] && (
                  <div className="mb-2 flex items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_COLORS[req.status] || ''}`}>
                      {STATUS_LABELS[req.status]}
                    </span>
                  </div>
                )}

                {/* Scheduled badge */}
                {req.is_scheduled && req.request_category && (
                  <div className="mb-2 flex items-center gap-1.5">
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)' }}>
                      {req.request_category}
                    </span>
                    {req.scheduled_slot && (
                      <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        Scheduled: {req.scheduled_slot}
                      </span>
                    )}
                    {req.order_type === 'advance' && req.status === 'searching_dp' && (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold animate-pulse" style={{ background: 'rgba(166,179,0,0.15)', color: '#A6B300', border: '1px solid rgba(166,179,0,0.25)' }}>
                        Reserve Now
                      </span>
                    )}
                  </div>
                )}

                {/* Items list */}
                {req.description && (
                  <ul className="mb-2 space-y-1">
                    {req.description.split('\n').slice(0, 4).map((line, i) => line.trim() && (
                      <li key={i} className="flex items-start gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: '#A6B300' }} />
                        {line.trim()}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Photos */}
                {req.photo_urls && req.photo_urls.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {req.photo_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt={`Photo ${i + 1}`} className="h-16 w-16 rounded-xl object-cover" style={{ border: '1px solid rgba(255,255,255,0.1)' }} />
                      </a>
                    ))}
                  </div>
                )}

                {/* Meta info */}
                <div className="flex flex-wrap gap-3 text-xs mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <span className="flex items-center gap-1"><Clock size={11} />{formatTime(req.created_at)}</span>
                  {req.preferred_shop && <span className="flex items-center gap-1"><Package size={11} />{req.preferred_shop}</span>}
                  {req.pickup_address && (
                    <span className="flex items-start gap-1"><MapPin size={11} className="shrink-0 mt-0.5 text-yellow-400" />{req.pickup_address}</span>
                  )}
                  <span className="flex items-start gap-1"><MapPin size={11} className="shrink-0 mt-0.5 text-red-400" />
                    <span className="text-white/60">{req.delivery_address}</span>
                  </span>
                </div>

                {req.voice_note_url && <VoicePlayer url={req.voice_note_url} />}

                {/* Action buttons */}
                <div className="mt-3.5 flex gap-2">
                  <button onClick={() => acceptRequest(req)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition-all active:scale-95"
                    style={{ background: '#A6B300', color: '#0B0B0B', boxShadow: '0 4px 16px rgba(166,179,0,0.3)' }}>
                    {req.order_type === 'advance' && req.status === 'searching_dp' ? <><CalendarClock size={16} /> Reserve</> : <><Check size={16} strokeWidth={3} /> Accept</>}
                  </button>
                  <button onClick={() => declineRequest(req)}
                    className="flex items-center justify-center rounded-2xl px-4 py-3 transition-all active:scale-95"
                    style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                    <X size={18} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
