import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase, DeliveryRequest, Profile, DeliveryPartner, Order } from '../../lib/supabase'
import { ensureAdvanceTaskDayReminders } from '../../lib/advanceTaskReminders'
import { useGps } from '../../hooks/useGps'
import { ServiceStatusBanner, SkeletonList, CountUp } from '../../components/ui'
import { formatTime, formatDistance, haversineDistance, formatCurrency, STATUS_LABELS, STATUS_COLORS } from '../../lib/utils'
import GreetingHeader from '../../components/GreetingHeader'
import { Screen, Surface, CTA, Chip, SectionLabel, EmptyBlock, IconButton, RangeSlider } from '../../design/primitives'
import { pg } from '../../design/tokens'
import {
  Package, Clock, MapPin, Check, X, WifiOff, Bell, Play, Pause,
  Star, Activity, Wallet, ChevronRight, MapPinOff, Loader2, CalendarClock, TrendingUp, Repeat,
} from 'lucide-react'
import { fetchDpCommissionBreakdown } from '../../lib/commission'
import { acceptNearbyRequest, declineNearbyRequest, isAdvanceNearbyRequest } from '../../lib/dpNearbyRespond'

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
    <div
      className="mt-3 flex items-center gap-3 rounded-2xl px-3.5 py-2.5"
      style={{ background: pg.limeDim, border: `1px solid rgba(196,214,0,0.22)` }}
    >
      <button
        type="button"
        onClick={toggle}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition active:scale-90"
        style={{ background: pg.lime, color: pg.limeText }}
      >
        {playing ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
      </button>
      <div className="flex h-8 flex-1 items-center gap-0.5">
        {Array.from({ length: 16 }).map((_, i) => (
          <div
            key={i}
            className={`flex-1 rounded-full ${playing ? 'animate-pulse' : ''}`}
            style={{
              height: `${28 + Math.sin(i * 0.8) * 45}%`,
              background: playing ? pg.lime : 'rgba(196,214,0,0.35)',
              animationDelay: `${i * 55}ms`,
            }}
          />
        ))}
      </div>
      <p className="shrink-0 text-[11px] font-extrabold uppercase tracking-wide" style={{ color: pg.lime }}>
        {playing ? 'Playing' : 'Voice'}
      </p>
    </div>
  )
}

function EarningsHero({ today, week, deliveries, totalCommission }: { today: number; week: number; deliveries: number; totalCommission: number }) {
  return (
    <Surface accent className="relative overflow-hidden p-5">
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full opacity-25 blur-3xl"
        style={{ background: pg.lime }}
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: pg.lime }}>
              Today's earnings
            </p>
            <p className="mt-1 text-[34px] font-extrabold leading-none tracking-tight">
              <CountUp value={today} prefix="₹" />
            </p>
          </div>
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ background: pg.limeDim, border: `1px solid rgba(196,163,90,0.25)` }}
          >
            <TrendingUp size={22} style={{ color: pg.lime }} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl px-3 py-2.5" style={{ background: pg.bgElevated, border: `1px solid ${pg.line}` }}>
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: pg.text4 }}>This week</p>
            <p className="mt-0.5 text-sm font-extrabold">₹{week.toLocaleString()}</p>
          </div>
          <div className="rounded-2xl px-3 py-2.5" style={{ background: pg.bgElevated, border: `1px solid ${pg.line}` }}>
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: pg.text4 }}>Deliveries</p>
            <p className="mt-0.5 text-sm font-extrabold">{deliveries} today</p>
          </div>
          <div className="rounded-2xl px-3 py-2.5" style={{ background: pg.bgElevated, border: `1px solid ${pg.line}` }}>
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: pg.text4 }}>Commission</p>
            <p className="mt-0.5 text-sm font-extrabold">₹{totalCommission.toLocaleString()}</p>
          </div>
        </div>
      </div>
    </Surface>
  )
}

function StatsGrid({
  rating, ratingCount, totalOrders, statusLabel, statusTone,
}: {
  rating: number; ratingCount: number; totalOrders: number; statusLabel: string; statusTone: string
}) {
  const items = [
    { label: `Rating${ratingCount > 0 ? ` (${ratingCount})` : ''}`, value: rating > 0 ? rating.toFixed(1) : '—', icon: <Star size={18} />, tone: '#F5A524' },
    { label: 'Total orders', value: totalOrders, icon: <Package size={18} />, tone: pg.lime },
    { label: 'Status', value: statusLabel, icon: <Activity size={18} />, tone: statusTone },
  ]
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {items.map(s => (
        <div
          key={s.label}
          className="rounded-[20px] px-2 py-3.5 text-center"
          style={{ background: pg.surface, color: pg.ink, border: `1px solid ${pg.line}` }}
        >
          <div
            className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: `${s.tone}22`, color: s.tone }}
          >
            {s.icon}
          </div>
          <p className="text-xl font-extrabold tracking-tight">{s.value}</p>
          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: pg.text4 }}>{s.label}</p>
        </div>
      ))}
    </div>
  )
}

function GpsBanner({ gps }: { gps: ReturnType<typeof useGps> }) {
  if (gps.permissionDenied) {
    return (
      <Surface className="mb-4 flex items-center gap-3 p-4" style={{ borderColor: 'rgba(255,77,79,0.28)' }}>
        <MapPinOff size={20} className="shrink-0 text-red-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-red-300">Location access required</p>
          <p className="text-xs" style={{ color: pg.text3 }}>Allow location to receive requests near you.</p>
        </div>
        <CTA variant="danger" className="min-h-0 shrink-0 px-3 py-2 text-xs" onClick={() => gps.requestPermission()}>
          Allow
        </CTA>
      </Surface>
    )
  }
  if (gps.loading) {
    return (
      <Surface className="mb-4 flex items-center gap-2.5 p-3.5" style={{ borderColor: 'rgba(59,130,246,0.25)' }}>
        <Loader2 size={16} className="shrink-0 animate-spin text-blue-400" />
        <p className="text-sm font-medium text-blue-300">Getting your location…</p>
      </Surface>
    )
  }
  return null
}

export default function DpHome() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [requests, setRequests] = useState<RequestWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [dp, setDp] = useState<DeliveryPartner | null>(null)
  const [dpLoading, setDpLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [reservingId, setReservingId] = useState<string | null>(null)
  const [rangeKm, setRangeKm] = useState(5)
  const rangeInitialised = useRef(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [todayOrders, setTodayOrders] = useState<Order[]>([])
  const [weekOrders, setWeekOrders] = useState<Order[]>([])
  const [totalOrders, setTotalOrders] = useState(0)
  const [pendingCommission, setPendingCommission] = useState(0)
  const [commissionDueNow, setCommissionDueNow] = useState(0)
  const [totalCommission, setTotalCommission] = useState(0)
  const [rangeTick, setRangeTick] = useState(0)
  const [fetchError, setFetchError] = useState<string | null>(null)
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
      void ensureAdvanceTaskDayReminders(profile.id, 'dp')
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
    if (!dp?.is_online) {
      setLoading(false)
      setRequests([])
      return
    }
    const fetchRequests = async (silent = true) => {
      if (!silent) setLoading(true)
      const { data, error } = await supabase.rpc('get_nearby_requests', { p_dp_user_id: profile!.id })
      if (error) {
        console.error('[DpHome] get_nearby_requests:', error)
        const raw = error.message || 'Could not load nearby requests'
        setFetchError(
          /ambiguous/i.test(raw)
            ? 'Database matching function is out of date. Run supabase/APPLY_NOW_FIX_DP_NEARBY.sql in the Supabase SQL Editor, then refresh.'
            : raw
        )
        setLoading(false)
        return
      }
      setFetchError(null)
      if (!data) { setLoading(false); return }
      const ids = data.map((r: any) => r.id).filter(Boolean)
      let metaById = new Map<string, Partial<DeliveryRequest>>()
      if (ids.length > 0) {
        const { data: metas } = await supabase
          .from('requests')
          .select('id, status, order_type, is_scheduled, scheduled_date, scheduled_time, scheduled_slot, scheduled_timestamp, request_category, radius_meters, recurring_type')
          .in('id', ids)
        metas?.forEach((m: any) => metaById.set(m.id, m))
      }
      const userIds = [...new Set(data.map((r: any) => r.user_id))]
      let profileMap = new Map<string, Profile>()
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('*').in('id', userIds)
        profiles?.forEach((p: any) => profileMap.set(p.id, p as Profile))
      }
      const next = (data as DeliveryRequest[]).map(r => {
        const meta = metaById.get(r.id) || {}
        return {
          ...r,
          ...meta,
          order_type: (meta as any).order_type || r.order_type || 'instant',
          status: (meta as any).status || r.status,
          user_profile: profileMap.get(r.user_id),
        }
      })
      setRequests(next)
      setLoading(false)
    }
    void fetchRequests(false)
    const channel = supabase.channel('dp-requests')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requests' },
        () => { void fetchRequests(true) })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'requests' },
        () => { void fetchRequests(true) })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'requests' }, () => { void fetchRequests(true) })
      .subscribe()
    const pollInterval = setInterval(() => { void fetchRequests(true) }, 5000)
    return () => {
      supabase.removeChannel(channel)
      clearInterval(pollInterval)
    }
  }, [dp?.is_online, dpLoading, profile, rangeTick])

  useEffect(() => {
    const checkCommission = async () => {
      if (!profile) return
      const br = await fetchDpCommissionBreakdown(profile.id)
      setPendingCommission(br.outstanding)
      setCommissionDueNow(br.dueNow)
      setTotalCommission(br.totalAccrued)
    }
    checkCommission()
  }, [profile, todayOrders])

  const changeRange = async (km: number) => {
    setRangeKm(km)
    await supabase.from('delivery_partners').update({ service_range_meters: km * 1000 }).eq('user_id', profile!.id)
    setRangeTick(t => t + 1)
  }

  const declineRequest = async (req: RequestWithUser) => {
    setRequests(prev => prev.filter(r => r.id !== req.id))
    const { error } = await declineNearbyRequest(profile!.id, req)
    if (error) { console.error('[DpHome] decline RPC failed:', error.message); showToast('Could not decline — check your connection.') }
  }

  const acceptRequest = async (req: RequestWithUser) => {
    if (reservingId) return
    if (!profile?.id) {
      showToast('Not signed in')
      return
    }
    setReservingId(req.id)
    try {
      const result = await acceptNearbyRequest(profile.id, req)
      if (result.success) {
        if (result.chatRoomId) {
          navigate(`/dp/chat/${result.chatRoomId}`, { replace: true })
          return
        }
        showToast('Accepted. Opening orders…')
        navigate('/dp/orders', { replace: true })
        return
      }
      showToast(result.error || 'Failed to accept request')
      window.alert(result.error || 'Failed to accept request')
    } catch (e: any) {
      console.error('[DpHome] acceptRequest exception:', e)
      showToast(e?.message || 'Could not accept request')
      window.alert(`Accept failed: ${e?.message || 'unknown error'}`)
    } finally {
      setReservingId(null)
    }
  }

  const getDistance = (req: DeliveryRequest): number | null => {
    const rpcDist = Number((req as RequestWithUser).distance_meters)
    if (Number.isFinite(rpcDist) && rpcDist >= 0) return rpcDist
    const lat = gps.lat ?? profile?.gps_lat
    const lng = gps.lng ?? profile?.gps_lng
    const r = req as RequestWithUser
    const userLat = req.delivery_lat ?? req.pickup_lat ?? r.user_profile?.gps_lat
    const userLng = req.delivery_lng ?? req.pickup_lng ?? r.user_profile?.gps_lng
    if (!lat || !lng || !userLat || !userLng) return null
    return haversineDistance(lat, lng, userLat, userLng)
  }

  const filtered = requests

  const todayEarnings = todayOrders.reduce((s, o) => s + Number(o.dp_earnings || 0), 0)
  const weekEarnings = weekOrders.reduce((s, o) => s + Number(o.dp_earnings || 0), 0)
  const todayDeliveries = todayOrders.length
  const rating = dp?.rating_avg || 0
  const ratingCount = dp?.rating_count || 0
  const dpFirstName = profile?.full_name?.split(' ')[0] || 'Partner'

  if (dpLoading) {
    return (
      <Screen className="mx-auto max-w-lg">
        <SkeletonList count={3} lines={3} />
      </Screen>
    )
  }

  const greetingHeader = (
    <GreetingHeader
      firstName={dpFirstName}
      aside={
        pendingCommission > 0 ? (
          <button
            type="button"
            onClick={() => navigate('/dp/wallet')}
            className="flex w-full items-center gap-2 rounded-2xl px-2.5 py-2 text-left transition active:scale-[0.99]"
            style={{ background: 'rgba(245,165,36,0.12)', border: '1px solid rgba(245,165,36,0.25)' }}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(245,165,36,0.16)' }}>
              <Wallet size={16} className="text-amber-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-extrabold leading-tight text-amber-200">
                {commissionDueNow > 0 ? `Due now ${formatCurrency(commissionDueNow)}` : `Due ${formatCurrency(pendingCommission)}`}
              </p>
              <p className="text-[10px]" style={{ color: pg.text3 }}>
                {commissionDueNow > 0 ? 'Pay to go online' : 'Pay after 12 AM'}
              </p>
            </div>
            <ChevronRight size={14} style={{ color: pg.text4 }} />
          </button>
        ) : undefined
      }
    />
  )

  if (!dp?.is_online) {
    return (
      <Screen className="mx-auto max-w-lg animate-fade-in-up">
        <ServiceStatusBanner cityName={profile?.city} />
        <GpsBanner gps={gps} />
        {greetingHeader}

        <div className="mb-5">
          <EarningsHero today={todayEarnings} week={weekEarnings} deliveries={todayDeliveries} totalCommission={totalCommission} />
        </div>

        <div className="mb-6">
          <StatsGrid
            rating={rating}
            ratingCount={ratingCount}
            totalOrders={totalOrders}
            statusLabel="Offline"
            statusTone={pg.text3}
          />
        </div>

        <EmptyBlock
          title="You're offline"
          body="Tap Go Online in the header to start receiving delivery requests near you."
          action={
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl" style={{ background: pg.surface2, color: pg.ink, border: `1px solid ${pg.line}` }}>
              <WifiOff size={32} style={{ color: pg.text4 }} />
            </div>
          }
        />
      </Screen>
    )
  }

  return (
    <Screen className="mx-auto max-w-lg animate-fade-in-up">
      <ServiceStatusBanner cityName={profile?.city} />
      <GpsBanner gps={gps} />
      {greetingHeader}

      {toast && (
        <div
          className="mb-4 flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-extrabold"
          style={{ background: pg.limeDim, border: `1px solid rgba(196,214,0,0.28)`, color: pg.lime }}
        >
          <Bell size={15} className="shrink-0" />
          {toast}
        </div>
      )}

      <div className="mb-5">
        <EarningsHero today={todayEarnings} week={weekEarnings} deliveries={todayDeliveries} totalCommission={totalCommission} />
      </div>

      <div className="mb-5">
        <StatsGrid
          rating={rating}
          ratingCount={ratingCount}
          totalOrders={totalOrders}
          statusLabel="Active"
          statusTone={pg.success}
        />
      </div>

      <div className="mb-6">
        <RangeSlider
          label="Service range"
          hint="How far you will travel to accept requests."
          valueKm={rangeKm}
          onChange={setRangeKm}
          onCommit={changeRange}
        />
        {gps.loading && !gps.lat && (
          <div className="mt-2.5 flex items-center gap-1.5 px-1 text-xs" style={{ color: pg.olive }}>
            <Loader2 size={11} className="shrink-0 animate-spin" />
            <span>Getting your location…</span>
          </div>
        )}
        {gps.permissionDenied && (
          <div
            className="mt-2.5 flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs"
            style={{ background: 'rgba(255,77,79,0.1)', border: '1px solid rgba(255,77,79,0.22)' }}
          >
            <span className="flex items-center gap-1.5 text-red-300"><MapPinOff size={11} /> Location denied</span>
            <button type="button" onClick={() => gps.requestPermission()} className="font-extrabold text-red-400">
              Allow
            </button>
          </div>
        )}
      </div>

      {fetchError && (
        <div
          className="mb-4 rounded-2xl px-4 py-3 text-sm font-bold text-red-300"
          style={{ background: 'rgba(255,77,79,0.1)', border: '1px solid rgba(255,77,79,0.22)' }}
        >
          Could not load requests: {fetchError}
        </div>
      )}

      <SectionLabel
        title="Nearby requests"
        action={
          <span className="text-xs font-extrabold" style={{ color: pg.text3 }}>
            {filtered.length} within {rangeKm} km
          </span>
        }
      />

      {loading ? (
        <SkeletonList count={3} lines={3} />
      ) : filtered.length === 0 ? (
        <EmptyBlock
          title="No requests in range"
          body={gps.loading ? 'Waiting for GPS…' : `No pending requests within ${rangeKm} km. Try increasing your range.`}
        />
      ) : (
        <div className="space-y-3 pb-4">
          {filtered.map(req => {
            const dist = getDistance(req)
            const advance = isAdvanceNearbyRequest(req)
            const scheduleLabel = req.scheduled_slot
              || (req.scheduled_date && req.scheduled_time ? `${req.scheduled_date} ${req.scheduled_time}` : null)
              || (req.scheduled_date ? String(req.scheduled_date) : null)
            return (
              <Surface key={req.id} className="p-4">
                <div className="mb-2.5 flex items-start justify-between gap-2">
                  <p className="line-clamp-1 flex-1 text-[15px] font-extrabold">
                    {req.description?.split('\n')[0]?.trim() || 'Delivery Request'}
                  </p>
                  {dist !== null && <Chip tone="lime">{formatDistance(dist)}</Chip>}
                </div>

                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <Chip tone={advance ? 'info' : 'lime'}>
                    {advance ? 'Advance' : 'Instant'}
                  </Chip>
                  {advance && req.status !== 'searching_dp' && req.status !== 'pending' && STATUS_LABELS[req.status] && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${STATUS_COLORS[req.status] || ''}`}>
                      {STATUS_LABELS[req.status]}
                    </span>
                  )}
                  {advance && req.request_category && (
                    <Chip tone="neutral">{req.request_category}</Chip>
                  )}
                  {advance && (req as any).recurring_type && (req as any).recurring_type !== 'none' && (
                    <Chip tone="warn"><span className="inline-flex items-center gap-1"><Repeat size={10} /> Recurring</span></Chip>
                  )}
                  {advance && (req.status === 'searching_dp' || !req.status) && (
                    <Chip tone="lime">Reserve now</Chip>
                  )}
                </div>

                {advance && scheduleLabel && (
                  <p className="mb-2 text-[11px] font-medium" style={{ color: pg.text3 }}>
                    Scheduled: {scheduleLabel}
                  </p>
                )}

                {req.description && (
                  <ul className="mb-2.5 space-y-1">
                    {req.description.split('\n').slice(0, 4).map((line, i) => line.trim() && (
                      <li key={i} className="flex items-start gap-2 text-xs" style={{ color: pg.text2 }}>
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: pg.lime }} />
                        {line.trim()}
                      </li>
                    ))}
                  </ul>
                )}

                {req.photo_urls && req.photo_urls.length > 0 && (
                  <div className="mb-2.5 flex flex-wrap gap-2">
                    {req.photo_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={url}
                          alt={`Photo ${i + 1}`}
                          className="h-16 w-16 rounded-xl object-cover"
                          style={{ border: `1px solid ${pg.line}` }}
                        />
                      </a>
                    ))}
                  </div>
                )}

                <div className="mb-1 flex flex-wrap gap-3 text-xs" style={{ color: pg.text4 }}>
                  <span className="flex items-center gap-1"><Clock size={11} />{formatTime(req.created_at)}</span>
                  {req.preferred_shop && <span className="flex items-center gap-1"><Package size={11} />{req.preferred_shop}</span>}
                </div>
                {req.pickup_address && (
                  <p className="mt-1 flex items-start gap-1.5 text-xs" style={{ color: pg.text3 }}>
                    <MapPin size={11} className="mt-0.5 shrink-0 text-amber-400" />
                    <span>{req.pickup_address}</span>
                  </p>
                )}
                <p className="mt-1 flex items-start gap-1.5 text-xs" style={{ color: pg.text2 }}>
                  <MapPin size={11} className="mt-0.5 shrink-0 text-red-400" />
                  <span>{req.delivery_address}</span>
                </p>

                {req.voice_note_url && <VoicePlayer url={req.voice_note_url} />}

                <div className="mt-4 flex gap-2">
                  <CTA
                    className="flex-1 min-h-[48px] text-sm"
                    onClick={() => acceptRequest(req)}
                    disabled={reservingId === req.id}
                  >
                    {reservingId === req.id ? (
                      <><Loader2 size={16} className="animate-spin" /> Reserving…</>
                    ) : advance ? (
                      <><CalendarClock size={16} /> Accept</>
                    ) : (
                      <><Check size={16} strokeWidth={3} /> Accept</>
                    )}
                  </CTA>
                  <IconButton onClick={() => declineRequest(req)} aria-label="Decline">
                    <X size={18} className="text-red-400" />
                  </IconButton>
                </div>
              </Surface>
            )
          })}
        </div>
      )}
    </Screen>
  )
}
