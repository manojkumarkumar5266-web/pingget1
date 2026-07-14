import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase, DeliveryRequest, Profile, DeliveryPartner, Order } from '../../lib/supabase'
import { useGps } from '../../hooks/useGps'
import { EmptyState, ServiceStatusBanner, SkeletonCard, StatCard, CountUp } from '../../components/ui'
import { formatTime, formatDistance, haversineDistance, formatCurrency } from '../../lib/utils'
import { Package, Clock, MapPin, Check, X, WifiOff, Sliders, Bell, Play, Pause, TrendingUp, Star, Zap, Bike, Activity, Navigation, Wallet } from 'lucide-react'

type RequestWithUser = DeliveryRequest & { user_profile?: Profile }

function VoicePlayer({ url }: { url: string }) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const toggle = () => {
    try {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; setPlaying(false); return }
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => { setPlaying(false); audioRef.current = null }
      audio.onerror = () => { setPlaying(false); audioRef.current = null }
      audio.play().then(() => setPlaying(true)).catch(() => { setPlaying(false); audioRef.current = null })
    } catch { setPlaying(false); audioRef.current = null }
  }
  return (
    <div className="mt-2 flex items-center gap-3 rounded-xl border border-white/15 bg-gray-50 px-4 py-2.5 dark:border-gray-700 dark:bg-gray-800">
      <button type="button" onClick={toggle} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white active:scale-90 transition-transform">
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <p className="text-sm font-medium text-white/80">{playing ? 'Playing...' : 'Voice Note'}</p>
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

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 5000)
  }

  useEffect(() => {
    const fetchDp = async () => {
      const { data } = await supabase
        .from('delivery_partners').select('*').eq('user_id', profile!.id).maybeSingle()
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
      const { data: allOrders } = await supabase
        .from('orders').select('*').eq('dp_id', profile!.id).eq('status', 'completed')
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
      const { data } = await supabase
        .from('requests')
        .select('*')
        .eq('status', 'pending')
        .not('declined_by', 'cs', `{${profile!.id}}`)
        .order('created_at', { ascending: false })
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
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'requests' },
        (payload: any) => {
          const updated = payload.new
          if (updated.status === 'accepted' && updated.accepted_dp_id !== profile!.id) {
            setRequests(prev => {
              if (prev.some(r => r.id === updated.id)) {
                showToast('A nearby request was just accepted by another delivery partner')
              }
              return prev
            })
          }
          fetchRequests()
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [dp?.is_online, dpLoading, profile])

  const changeRange = async (km: number) => {
    setRangeKm(km)
    setSavingRange(true)
    await supabase.from('delivery_partners').update({ service_range_meters: km * 1000 }).eq('user_id', profile!.id)
    setSavingRange(false)
  }

  const declineRequest = async (req: RequestWithUser) => {
    setRequests(prev => prev.filter(r => r.id !== req.id))
    const { error } = await supabase.rpc('append_declined_by', { row_id: req.id, dp_id: profile!.id })
    if (error) {
      await supabase.from('requests')
        .update({ declined_by: [...((req as any).declined_by ?? []), profile!.id] })
        .eq('id', req.id)
    }
  }

  const acceptRequest = async (req: RequestWithUser) => {
    const { error } = await supabase.from('requests')
      .update({ status: 'accepted', accepted_dp_id: profile!.id })
      .eq('id', req.id).eq('status', 'pending')
    if (error) { showToast('This request was already accepted by another delivery partner'); return }

    const { data: existing } = await supabase.from('chat_rooms').select('id').eq('request_id', req.id).limit(1)
    let roomId: string | undefined = existing?.[0]?.id
    if (!roomId) {
      const { data: room, error: roomError } = await supabase.from('chat_rooms')
        .insert({ request_id: req.id, user_id: req.user_id, dp_id: profile!.id })
        .select().single()
      if (roomError || !room) { showToast('Failed to create chat room'); return }
      roomId = room.id
    }

    await supabase.from('messages').insert({
      chat_room_id: roomId, sender_id: req.user_id, message_type: 'order_summary',
      quotation_data: {
        title: req.title, description: req.description,
        preferred_shop: req.preferred_shop, pickup_address: req.pickup_address,
        delivery_address: req.delivery_address, expected_time: req.expected_time,
        photo_url: req.photo_url, voice_note_url: req.voice_note_url,
        delivery_lat: req.delivery_lat, delivery_lng: req.delivery_lng,
      },
    })

    const userName = req.user_profile?.full_name ? `Hi ${req.user_profile.full_name}! ` : 'Hello! '
    await supabase.from('messages').insert({
      chat_room_id: roomId, sender_id: profile!.id,
      content: `${userName}I'm ${profile!.full_name} and I've accepted your delivery request. I can see your order details above — let me know if anything needs clarification and we'll get started!`,
      message_type: 'text',
    })

    if (req.delivery_lat && req.delivery_lng) {
      await supabase.from('messages').insert({
        chat_room_id: roomId, sender_id: profile!.id,
        content: req.delivery_address || 'Delivery location',
        message_type: 'location', location_lat: req.delivery_lat, location_lng: req.delivery_lng,
      })
    }

    await supabase.from('notifications').insert({
      user_id: req.user_id, title: 'Request Accepted!',
      body: `${profile!.full_name} accepted your request. Tap to open chat now.`,
      type: 'request_accepted', related_id: req.id,
    })

    navigate(`/dp/chat/${roomId}`)
  }

  const [pendingCommission, setPendingCommission] = useState(0)
  const gps = useGps(profile?.id, true)

  const getDistance = (req: DeliveryRequest): number | null => {
    const lat = gps.lat ?? profile?.gps_lat
    const lng = gps.lng ?? profile?.gps_lng
    if (!lat || !lng || !req.delivery_lat || !req.delivery_lng) return null
    return haversineDistance(lat, lng, req.delivery_lat, req.delivery_lng)
  }

  const rangeMeters = rangeKm * 1000
  const filtered = requests.filter(r => {
    const dist = getDistance(r)
    if (dist === null) return false
    return dist <= rangeMeters
  })

  const todayEarnings = todayOrders.reduce((s, o) => s + Number(o.dp_earnings || 0), 0)
  const weekEarnings = weekOrders.reduce((s, o) => s + Number(o.dp_earnings || 0), 0)
  const todayDeliveries = todayOrders.length
  const rating = dp?.rating_avg || 0
  const ratingCount = dp?.rating_count || 0

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

  if (dpLoading) {
    return <div className="p-4 space-y-3">{[1, 2, 3].map(i => <SkeletonCard key={i} lines={3} />)}</div>
  }

  if (!dp?.is_online) {
    return (
      <div className="mx-auto max-w-md px-4 py-4">
        <ServiceStatusBanner cityName={profile?.city} />
        <div className="mt-16 flex flex-col items-center justify-center gap-4 text-center px-6 animate-fade-in-up">
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl glass animate-bounce-in">
            <WifiOff size={40} className="text-white/40" />
          </div>
          <h2 className="text-xl font-bold text-white">You are Offline</h2>
          <p className="max-w-xs text-sm text-white/50">
            Tap the <span className="font-semibold text-success-600">Go Online</span> button at the top to start receiving delivery requests.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-4">
      <ServiceStatusBanner cityName={profile?.city} />

      {toast && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-accent-50 px-3 py-2 text-xs font-medium text-accent-800 dark:bg-accent-900/40 dark:text-accent-200 animate-slide-up">
          <Bell size={14} className="shrink-0" /> {toast}
        </div>
      )}

      {pendingCommission > 0 && (
        <button onClick={() => navigate('/dp/wallet')} className="mb-3 flex w-full items-center gap-3 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-left dark:border-warning-900/40 dark:bg-warning-950/30 animate-slide-up">
          <Wallet size={20} className="shrink-0 text-warning-600 dark:text-warning-400" />
          <div className="flex-1">
            <p className="text-sm font-bold text-warning-700 dark:text-warning-300">Commission Due: {formatCurrency(pendingCommission)}</p>
            <p className="text-xs text-warning-600 dark:text-warning-400">Tap to pay admin via UPI</p>
          </div>
        </button>
      )}

      {/* Earnings Dashboard */}
      <div className="mb-4 overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 p-5 text-white shadow-lg animate-slide-up" style={{ boxShadow: 'var(--shadow-lg)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-primary-100">Today&apos;s Earnings</p>
            <p className="mt-1 text-3xl font-bold">
              <CountUp value={todayEarnings} prefix="₹" />
            </p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
            <TrendingUp size={28} />
          </div>
        </div>
        <div className="mt-4 flex gap-4">
          <div className="flex-1 rounded-xl bg-white/10 px-3 py-2">
            <p className="text-xs text-primary-100">This Week</p>
            <p className="text-lg font-bold">{formatCurrency(weekEarnings)}</p>
          </div>
          <div className="flex-1 rounded-xl bg-white/10 px-3 py-2">
            <p className="text-xs text-primary-100">Deliveries</p>
            <p className="text-lg font-bold">{todayDeliveries} today</p>
          </div>
        </div>
      </div>

      {/* Performance Stats */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="card p-3 text-center animate-slide-up">
          <Star size={18} className="mx-auto mb-1 text-accent-400" />
          <p className="text-lg font-bold text-white">{rating > 0 ? rating.toFixed(1) : '—'}</p>
          <p className="text-[10px] text-gray-500">Rating{ratingCount > 0 ? ` (${ratingCount})` : ''}</p>
        </div>
        <div className="card p-3 text-center animate-slide-up" style={{ animationDelay: '50ms' }}>
          <Package size={18} className="mx-auto mb-1 text-primary-500" />
          <p className="text-lg font-bold text-white">{totalOrders}</p>
          <p className="text-[10px] text-gray-500">Total Orders</p>
        </div>
        <div className="card p-3 text-center animate-slide-up" style={{ animationDelay: '100ms' }}>
          <Activity size={18} className="mx-auto mb-1 text-success-500" />
          <p className="text-lg font-bold text-white">{dp?.is_online ? 'Active' : '—'}</p>
          <p className="text-[10px] text-gray-500">Status</p>
        </div>
      </div>

      {/* Service Range */}
      <div className="mb-4 card p-4 animate-slide-up">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white/50">
            <Sliders size={13} /> Service range
          </div>
          <span className="text-sm font-bold text-primary-600 dark:text-primary-400">{rangeKm} km</span>
        </div>
        <input
          type="range" min={1} max={50} step={1} value={rangeKm}
          onChange={e => setRangeKm(Number(e.target.value))}
          onMouseUp={(e: any) => changeRange(Number(e.target.value))}
          onTouchEnd={(e: any) => changeRange(Number(e.target.value))}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 dark:bg-gray-700 accent-primary-600"
        />
        <div className="mt-1 flex justify-between text-[10px] text-white/40">
          <span>1 km</span><span>25 km</span><span>50 km</span>
        </div>
        {profile?.gps_lat ? (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-success-600 dark:text-success-400">
            <MapPin size={12} className="shrink-0" />
            <span>Location auto-detected: {profile.gps_lat.toFixed(4)}, {profile.gps_lng!.toFixed(4)}</span>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-warning-600 dark:text-warning-400">
            <Navigation size={12} className="shrink-0 animate-pulse" />
            <span>Waiting for GPS location... Allow location access.</span>
          </div>
        )}
      </div>

      {/* Nearby Requests */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white">Nearby Requests</h3>
          <p className="text-xs text-white/50">{filtered.length} within {rangeKm} km</p>
        </div>
        {savingRange && <span className="text-xs text-white/40 animate-pulse">Saving...</span>}
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <SkeletonCard key={i} lines={3} />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Package size={48} />} title="No requests in your range"
          description={gps.loading ? 'Waiting for GPS location... Allow location access.' : `No pending requests within ${rangeKm} km. Increase your range to see more.`} />
      ) : (
        <div className="space-y-3">
          {filtered.map((req, i) => {
            const dist = getDistance(req)
            return (
              <div key={req.id} className="card p-4 animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="flex items-start justify-between">
                  <p className="font-semibold text-white">{req.title}</p>
                  {dist !== null && (
                    <span className="badge bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                      {formatDistance(dist)}
                    </span>
                  )}
                </div>
                {req.description && (
                  <ul className="mt-1.5 space-y-0.5">
                    {req.description.split('\n').map((line, i) => line.trim() && (
                      <li key={i} className="flex items-start gap-1.5 text-sm text-white/80">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />
                        <span>{line.trim()}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {req.photo_url && (
                  <a href={req.photo_url} target="_blank" rel="noopener noreferrer" className="mt-2 block">
                    <img src={req.photo_url} alt="Order" className="w-full max-h-40 rounded-xl object-cover" />
                  </a>
                )}
                <div className="mt-3 space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 text-white/50">
                    <Clock size={13} className="shrink-0" /><span>{formatTime(req.created_at)}</span>
                  </div>
                  {req.preferred_shop && (
                    <div className="flex items-center gap-2 text-white/50">
                      <Package size={13} className="shrink-0" />
                      <span>Shop: <span className="font-medium text-white/80">{req.preferred_shop}</span></span>
                    </div>
                  )}
                  {req.pickup_address && (
                    <div className="flex items-start gap-2 text-white/50">
                      <MapPin size={13} className="shrink-0 mt-0.5 text-accent-500" />
                      <span>Pickup: <span className="font-medium text-white/80">{req.pickup_address}</span></span>
                    </div>
                  )}
                  <div className="flex items-start gap-2 text-white/50">
                    <MapPin size={13} className="shrink-0 mt-0.5 text-error-500" />
                    <span>Deliver to: <span className="font-medium text-white/80">{req.delivery_address}</span></span>
                  </div>
                  {req.expected_time && (
                    <div className="flex items-center gap-2 text-white/50">
                      <Clock size={13} className="shrink-0 text-warning-500" />
                      <span>Expected: <span className="font-medium text-white/80">{req.expected_time}</span></span>
                    </div>
                  )}
                </div>
                {req.voice_note_url && <VoicePlayer url={req.voice_note_url} />}
                <div className="mt-3 flex gap-2">
                  <button onClick={() => acceptRequest(req)} className="btn-primary flex-1 active:scale-95 transition-transform">
                    <Check size={18} /> Accept
                  </button>
                  <button onClick={() => declineRequest(req)} className="btn-secondary px-4 active:scale-95 transition-transform">
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
