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
  pending: 0, accepted: 1, confirmed: 2, shopping: 3, purchased: 4,
  on_the_way: 5, arrived: 6, delivered: 7, cash_received: 8, completed: 8,
}

/** Rebuilt Customer Home — commerce hero hierarchy */
export default function UserHome() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [activeOrders, setActiveOrders] = useState<DeliveryRequest[]>([])
  const [recentCompleted, setRecentCompleted] = useState<DeliveryRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, completed: 0, active: 0 })

  useEffect(() => {
    if (!profile?.id) return
    let cancelled = false
    const fetchOrders = async () => {
      const [activeRes, completedRes] = await Promise.all([
        supabase.from('requests').select('*').eq('user_id', profile.id)
          .in('status', ['pending','accepted','confirmed','shopping','purchased','on_the_way','arrived','delivered','cash_received','scheduled','rescheduled','dp_reserved','waiting_payment','searching_dp'])
          .order('created_at', { ascending: false }),
        supabase.from('requests').select('*').eq('user_id', profile.id)
          .eq('status','completed').order('created_at', { ascending: false }).limit(3),
      ])
      if (cancelled) return
      setActiveOrders((activeRes.data as DeliveryRequest[]) || [])
      setRecentCompleted((completedRes.data as DeliveryRequest[]) || [])
      const [total, completedCount, activeCount] = await Promise.all([
        supabase.from('requests').select('id', { count: 'exact', head: true }).eq('user_id', profile.id),
        supabase.from('requests').select('id', { count: 'exact', head: true }).eq('user_id', profile.id).eq('status','completed'),
        supabase.from('requests').select('id', { count: 'exact', head: true }).eq('user_id', profile.id)
          .in('status',['pending','accepted','confirmed','shopping','purchased','on_the_way','arrived','delivered','cash_received','scheduled','dp_reserved','waiting_payment']),
      ])
      if (cancelled) return
      setStats({ total: total.count || 0, completed: completedCount.count || 0, active: activeCount.count || 0 })
      setLoading(false)
    }
    fetchOrders()
    const channel = supabase.channel('user-home-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests', filter: `user_id=eq.${profile.id}` }, () => { fetchOrders() })
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
          { label: 'Live', value: stats.active, icon: <Bike size={18} />, tone: '#F5A524' },
          { label: 'Done', value: stats.completed, icon: <CheckCircle2 size={18} />, tone: '#22C55E' },
        ].map(s => (
          <div key={s.label} className="rounded-[20px] px-2 py-3.5 text-center" style={{ background: pg.surface, border: `1px solid ${pg.line}` }}>
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${s.tone}22`, color: s.tone }}>
              {s.icon}
            </div>
            <p className="text-2xl font-extrabold tracking-tight">{s.value}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: pg.text4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      <FeatureCarousel />

      <section className="mb-8">
        <SectionLabel title="Book now" />
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => navigate('/app/create')}
            className="text-left transition active:scale-[0.98]"
          >
            <img
              src={Images.feature.instantBooking}
              alt="Instant Booking"
              className="w-full object-contain"
              style={{ background: 'transparent', display: 'block' }}
              loading="eager"
              decoding="async"
              draggable={false}
            />
            <p className="mt-2 flex items-center gap-1.5 text-sm font-extrabold" style={{ color: pg.lime }}>
              <Zap size={16} /> Instant
            </p>
            <p className="text-[10px]" style={{ color: pg.text3 }}>~10 min</p>
          </button>
          <button
            type="button"
            onClick={() => navigate('/app/create-advance')}
            className="text-left transition active:scale-[0.98]"
          >
            <img
              src={Images.feature.advanceBooking}
              alt="Advance Booking"
              className="w-full object-contain"
              style={{ background: 'transparent', display: 'block' }}
              loading="eager"
              decoding="async"
              draggable={false}
            />
            <p className="mt-2 flex items-center gap-1.5 text-sm font-extrabold text-sky-400">
              <CalendarClock size={16} /> Advance
            </p>
            <p className="text-[10px]" style={{ color: pg.text3 }}>Schedule</p>
          </button>
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
          image={Images.emptyState}
          title="Nothing live yet"
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
                  <div className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: pg.text3 }}>
                    <MapPin size={12} /> <span className="line-clamp-1">{req.delivery_address}</span>
                  </div>
                )}
                {req.status !== 'pending' && req.status !== 'searching_dp' && (
                  <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-full rounded-full" style={{ width: `${progress}%`, background: `linear-gradient(90deg,#8fa300,${pg.lime})` }} />
                  </div>
                )}
                <div className="mt-2.5 flex items-center gap-2 text-xs" style={{ color: pg.text4 }}>
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
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: 'rgba(34,197,94,0.14)' }}>
                  <CheckCircle2 size={20} className="text-green-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold">{req.description?.split('\n')[0]?.trim() || 'Delivery'}</p>
                  <p className="mt-0.5 text-xs" style={{ color: pg.text4 }}>{formatTime(req.created_at)}</p>
                </div>
                <ChevronRight size={16} style={{ color: pg.text4 }} />
              </Surface>
            ))}
          </div>
        </div>
      )}
    </Screen>
  )
}

async function navigateToOrder(navigate: (path: string) => void, req: DeliveryRequest) {
  if (['on_the_way', 'arrived', 'shopping', 'purchased', 'confirmed', 'delivered', 'cash_received', 'accepted'].includes(req.status)) {
    navigate(`/app/track/${req.id}`)
    return
  }
  if (req.accepted_dp_id || (req as any).reserved_dp_id) {
    navigate(`/app/track/${req.id}`)
    return
  }
  if (['pending', 'searching_dp'].includes(req.status)) {
    navigate(`/app/scanning/${req.id}`)
    return
  }
  navigate('/app/orders')
}
