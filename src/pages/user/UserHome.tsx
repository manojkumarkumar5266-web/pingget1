import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase, DeliveryRequest } from '../../lib/supabase'
import { StatusBadge, ServiceStatusBanner, SkeletonList } from '../../components/ui'
import { formatTime } from '../../lib/utils'
import { Clock, MapPin, CheckCircle2, ChevronRight, Zap, CalendarClock, Package, Bike } from 'lucide-react'
import { Images } from '../../lib/customImages'
import FeatureCarousel from '../../components/FeatureCarousel'
import AddressPicker from '../../components/AddressPicker'
import GreetingHeader from '../../components/GreetingHeader'
import { Screen, SectionLabel, Surface, EmptyBlock, Chip } from '../../design/primitives'
import { pg } from '../../design/tokens'

const STATUS_STEPS: Record<string, number> = {
  pending: 0, searching_dp: 0, dp_reserved: 1, waiting_payment: 1, payment_verified: 1,
  booking_confirmed: 1, task_started: 2, accepted: 1, confirmed: 2, shopping: 3, purchased: 4,
  on_the_way: 5, arrived: 6, delivered: 7, cash_received: 8, completed: 8,
}

/** Short-lived cache so back-navigation does not flash / refetch cold */
type HomeCache = {
  userId: string
  activeOrders: DeliveryRequest[]
  recentCompleted: DeliveryRequest[]
  stats: { total: number; completed: number; active: number }
  at: number
}
let homeCache: HomeCache | null = null
const HOME_CACHE_MS = 45_000

/** Rebuilt Customer Home — commerce hero hierarchy */
export default function UserHome() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const cached =
    homeCache && homeCache.userId === profile?.id && Date.now() - homeCache.at < HOME_CACHE_MS
      ? homeCache
      : null
  const [activeOrders, setActiveOrders] = useState<DeliveryRequest[]>(cached?.activeOrders ?? [])
  const [recentCompleted, setRecentCompleted] = useState<DeliveryRequest[]>(cached?.recentCompleted ?? [])
  const [loading, setLoading] = useState(!cached)
  const [stats, setStats] = useState(cached?.stats ?? { total: 0, completed: 0, active: 0 })

  useEffect(() => {
    if (!profile?.id) return
    let cancelled = false
    const fetchOrders = async (silent = false) => {
      if (!silent && !homeCache) setLoading(true)
      const [activeRes, completedRes] = await Promise.all([
        supabase.from('requests').select('*').eq('user_id', profile.id)
          .in('status', ['pending','accepted','confirmed','shopping','purchased','on_the_way','arrived','delivered','cash_received','scheduled','rescheduled','dp_reserved','waiting_payment','searching_dp','payment_verified','booking_confirmed','task_started'])
          .order('created_at', { ascending: false }),
        supabase.from('requests').select('*').eq('user_id', profile.id)
          .eq('status','completed').order('created_at', { ascending: false }).limit(3),
      ])
      if (cancelled) return
      const nextActive = (activeRes.data as DeliveryRequest[]) || []
      const nextCompleted = (completedRes.data as DeliveryRequest[]) || []
      setActiveOrders(nextActive)
      setRecentCompleted(nextCompleted)
      const [total, completedCount, activeCount] = await Promise.all([
        supabase.from('requests').select('id', { count: 'exact', head: true }).eq('user_id', profile.id),
        supabase.from('requests').select('id', { count: 'exact', head: true }).eq('user_id', profile.id).eq('status','completed'),
        supabase.from('requests').select('id', { count: 'exact', head: true }).eq('user_id', profile.id)
          .in('status',['pending','accepted','confirmed','shopping','purchased','on_the_way','arrived','delivered','cash_received','scheduled','dp_reserved','waiting_payment','searching_dp','payment_verified','booking_confirmed','task_started']),
      ])
      if (cancelled) return
      const nextStats = { total: total.count || 0, completed: completedCount.count || 0, active: activeCount.count || 0 }
      setStats(nextStats)
      homeCache = {
        userId: profile.id,
        activeOrders: nextActive,
        recentCompleted: nextCompleted,
        stats: nextStats,
        at: Date.now(),
      }
      setLoading(false)
    }
    fetchOrders(!!cached)
    const channel = supabase.channel('user-home-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests', filter: `user_id=eq.${profile.id}` }, () => { fetchOrders(true) })
      .subscribe()
    return () => { cancelled = true; supabase.removeChannel(channel) }
  }, [profile?.id])

  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  return (
    <Screen className="mx-auto max-w-lg animate-fade-in-up">
      <ServiceStatusBanner cityName={profile?.city} />

      <GreetingHeader firstName={firstName} />

      <div className="mb-5">
        <AddressPicker />
      </div>

      <div className="mb-7 grid grid-cols-3 gap-2.5">
        {[
          { label: 'Orders', value: stats.total, icon: <Package size={18} />, tone: pg.lime },
          { label: 'Live', value: stats.active, icon: <Bike size={18} />, tone: '#FF9F43' },
          { label: 'Done', value: stats.completed, icon: <CheckCircle2 size={18} />, tone: '#3DDC97' },
        ].map(s => (
          <div key={s.label} className="rounded-[20px] px-2 py-3.5 text-center" style={{ background: pg.surface, color: pg.ink, border: `1px solid ${pg.line}` }}>
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${s.tone}22`, color: s.tone }}>
              {s.icon}
            </div>
            <p className="text-2xl font-extrabold tracking-tight">{s.value}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: pg.ink3 }}>{s.label}</p>
          </div>
        ))}
      </div>

      <FeatureCarousel />

      <section className="mb-8">
        <SectionLabel title="Book now" />
        <p className="mb-3 text-xs" style={{ color: pg.text3 }}>
          Tap + below to start Instant or Advance booking
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-left" aria-hidden="true">
            <img
              src={Images.feature.instantBooking}
              alt="Instant Booking"
              className="pointer-events-none w-full object-contain"
              style={{ background: 'transparent', display: 'block' }}
              loading="lazy"
              decoding="async"
              draggable={false}
              width={720}
              height={720}
            />
            <p className="mt-2 flex items-center gap-1.5 text-sm font-extrabold" style={{ color: pg.lime }}>
              <Zap size={16} /> Instant
            </p>
            <p className="text-[10px]" style={{ color: pg.text3 }}>Book for now</p>
          </div>
          <div className="text-left" aria-hidden="true">
            <img
              src={Images.feature.advanceBooking}
              alt="Advance Booking"
              className="pointer-events-none w-full object-contain"
              style={{ background: 'transparent', display: 'block' }}
              loading="lazy"
              decoding="async"
              draggable={false}
              width={720}
              height={720}
            />
            <p className="mt-2 flex items-center gap-1.5 text-sm font-extrabold" style={{ color: pg.info }}>
              <CalendarClock size={16} /> Advance
            </p>
            <p className="text-[10px]" style={{ color: pg.text3 }}>Schedule</p>
          </div>
        </div>
      </section>

      <SectionLabel
        title="Active orders"
        action={
          <button type="button" onClick={() => navigate('/app/orders')} className="flex items-center gap-0.5 text-sm font-extrabold" style={{ color: pg.lime }}>
            All <ChevronRight size={14} />
          </button>
        }
      />

      {loading ? (
        <SkeletonList count={2} lines={3} />
      ) : activeOrders.length === 0 ? (
        <EmptyBlock
          title="No active orders yet"
          body="Book Instant or Advance to get your first delivery moving."
        />
      ) : (
        <div className="space-y-3">
          {activeOrders.map(req => {
            const step = STATUS_STEPS[req.status] ?? 0
            const progress = (step / 8) * 100
            return (
              <Surface key={req.id} onClick={() => navigateToOrder(navigate, req)} className="p-4 active:scale-[0.99]">
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-1 flex-1 text-[15px] font-extrabold">
                    {req.description?.split('\n')[0]?.trim() || 'Delivery Request'}
                  </p>
                  <StatusBadge status={req.status} />
                </div>
                {(req as any).order_type === 'advance' && (
                  <div className="mt-2"><Chip tone="info">Advance</Chip></div>
                )}
                {req.delivery_address && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: pg.ink3 }}>
                    <MapPin size={12} /> <span className="line-clamp-1">{req.delivery_address}</span>
                  </div>
                )}
                {req.status !== 'pending' && req.status !== 'searching_dp' && (
                  <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-full rounded-full" style={{ width: `${progress}%`, background: `linear-gradient(90deg,#E8B84A,${pg.lime})` }} />
                  </div>
                )}
                <div className="mt-2.5 flex items-center gap-2 text-xs" style={{ color: pg.ink3 }}>
                  <Clock size={12} /> {formatTime(req.created_at)}
                </div>
              </Surface>
            )
          })}
        </div>
      )}

      {!loading && recentCompleted.length > 0 && (
        <div className="mt-9">
          <SectionLabel
            title="Recently completed"
            action={<button type="button" onClick={() => navigate('/app/orders')} className="text-sm font-extrabold" style={{ color: pg.lime }}>View</button>}
          />
          <div className="space-y-2">
            {recentCompleted.map(req => (
              <Surface key={req.id} onClick={() => navigate('/app/orders')} className="flex items-center gap-3 p-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: 'rgba(61,220,151,0.14)' }}>
                  <CheckCircle2 size={20} style={{ color: '#3DDC97' }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold">{req.description?.split('\n')[0]?.trim() || 'Delivery'}</p>
                  <p className="mt-0.5 text-xs" style={{ color: pg.ink3 }}>{formatTime(req.created_at)}</p>
                </div>
                <ChevronRight size={16} style={{ color: pg.ink3 }} />
              </Surface>
            ))}
          </div>
        </div>
      )}
    </Screen>
  )
}

async function navigateToOrder(navigate: (path: string) => void, req: DeliveryRequest) {
  // Live task / delivery → tracking (includes advance task day)
  if (['on_the_way', 'arrived', 'shopping', 'purchased', 'confirmed', 'task_started', 'delivered', 'cash_received'].includes(req.status)) {
    navigate(`/app/track/${req.id}`)
    return
  }
  // Confirmed advance booking waiting for task day → orders list
  if (['booking_confirmed', 'payment_verified'].includes(req.status)) {
    navigate('/app/orders')
    return
  }
  // Accepted / reserved → chat for quotation / advance payment
  if (['accepted', 'dp_reserved', 'waiting_payment'].includes(req.status)) {
    const { data: room } = await supabase.from('chat_rooms').select('id').eq('request_id', req.id).maybeSingle()
    if (room?.id) {
      navigate(`/app/chat/${room.id}`)
      return
    }
    navigate(`/app/track/${req.id}`)
    return
  }
  if (['pending', 'searching_dp'].includes(req.status)) {
    navigate(`/app/scanning/${req.id}`)
    return
  }
  navigate('/app/orders')
}
