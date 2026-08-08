import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase, DeliveryRequest } from '../../lib/supabase'
import { EmptyState, StatusBadge, ServiceStatusBanner, SkeletonList, SectionHeader } from '../../components/ui'
import { formatTime } from '../../lib/utils'
import { Package, Clock, MapPin, CheckCircle2, Bike, ChevronRight, Zap, CalendarClock } from 'lucide-react'
import { Images } from '../../lib/customImages'
import FeatureCarousel from '../../components/FeatureCarousel'
import AddressPicker from '../../components/AddressPicker'

const STATUS_STEPS: Record<string, number> = {
  pending: 0, accepted: 1, confirmed: 2, shopping: 3, purchased: 4,
  on_the_way: 5, arrived: 6, delivered: 7, cash_received: 8, completed: 8,
}

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
    <div className="mx-auto max-w-lg px-4 pt-4 pb-6">
      <ServiceStatusBanner cityName={profile?.city} />

      <div className="mb-5 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">Good {getGreeting()}</p>
          <h1 className="text-[28px] font-extrabold text-white leading-tight truncate tracking-tight">Hai {firstName}</h1>
        </div>
        <img src={Images.haiHand} alt="" className="h-16 w-16 object-contain shrink-0" draggable={false} />
      </div>

      <AddressPicker />

      <div className="mb-6 grid grid-cols-3 gap-2.5">
        {[
          { label: 'Total', value: stats.total, icon: <Package size={18} />, color: 'rgba(166,179,0,0.18)', tColor: '#C0D900' },
          { label: 'Active', value: stats.active, icon: <Bike size={18} />, color: 'rgba(251,191,36,0.16)', tColor: '#fbbf24' },
          { label: 'Done', value: stats.completed, icon: <CheckCircle2 size={18} />, color: 'rgba(16,185,129,0.16)', tColor: '#34d399' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-3.5 text-center" style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: s.color }}>
              <span style={{ color: s.tColor }}>{s.icon}</span>
            </div>
            <p className="text-2xl font-extrabold text-white tracking-tight">{s.value}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">{s.label}</p>
          </div>
        ))}
      </div>

      <FeatureCarousel />

      {/* Large Instant / Advance — Blinkit-style promo tiles */}
      <div className="mb-7">
        <h2 className="mb-3 text-lg font-extrabold text-white tracking-tight">Get Things Done</h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => navigate('/app/create')}
            className="overflow-hidden rounded-[24px] text-left active:scale-[0.98] transition-transform"
            style={{ background: '#141414', border: '1px solid rgba(166,179,0,0.25)' }}
          >
            <img src={Images.feature.instantBooking} alt="Instant" className="h-40 w-full object-cover" draggable={false} />
            <div className="flex items-center gap-2 px-3 py-3" style={{ background: 'rgba(166,179,0,0.12)' }}>
              <Zap size={16} style={{ color: '#C0D900' }} />
              <div>
                <p className="text-sm font-extrabold" style={{ color: '#C0D900' }}>Instant</p>
                <p className="text-[10px] text-white/45">~10 min delivery</p>
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => navigate('/app/create-advance')}
            className="overflow-hidden rounded-[24px] text-left active:scale-[0.98] transition-transform"
            style={{ background: '#141414', border: '1px solid rgba(96,165,250,0.25)' }}
          >
            <img src={Images.feature.advanceBooking} alt="Advance" className="h-40 w-full object-cover" draggable={false} />
            <div className="flex items-center gap-2 px-3 py-3" style={{ background: 'rgba(59,130,246,0.12)' }}>
              <CalendarClock size={16} style={{ color: '#60A5FA' }} />
              <div>
                <p className="text-sm font-extrabold" style={{ color: '#60A5FA' }}>Advance</p>
                <p className="text-[10px] text-white/45">Schedule ahead</p>
              </div>
            </div>
          </button>
        </div>
        <p className="mt-2.5 text-center text-[11px] text-white/40">Or tap + below to book</p>
      </div>

      <SectionHeader
        title="Active Orders"
        action={
          <button type="button" onClick={() => navigate('/app/orders')} className="flex items-center gap-0.5 text-sm font-bold" style={{ color: '#C0D900' }}>
            See All <ChevronRight size={14} />
          </button>
        }
      />

      {loading ? (
        <SkeletonList count={2} lines={3} />
      ) : activeOrders.length === 0 ? (
        <EmptyState
          illustration={<img src={Images.emptyState} alt="" className="w-36 h-36 object-contain" />}
          title="No active orders"
          description="Tap Instant or Advance to get started."
        />
      ) : (
        <div className="space-y-3">
          {activeOrders.map(req => {
            const step = STATUS_STEPS[req.status] ?? 0
            const progress = (step / 8) * 100
            return (
              <button key={req.id} type="button" onClick={() => navigateToOrder(navigate, req)}
                className="w-full overflow-hidden rounded-[22px] p-4 text-left active:scale-[0.98] transition-transform"
                style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-white text-[15px] line-clamp-1 flex-1">
                    {req.description?.split('\n')[0]?.trim() || 'Delivery Request'}
                  </p>
                  <StatusBadge status={req.status} />
                </div>
                {(req as any).order_type === 'advance' && (
                  <span className="mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(59,130,246,0.15)', color: '#60A5FA' }}>
                    Advance
                  </span>
                )}
                {req.delivery_address && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-white/45">
                    <MapPin size={12} /> <span className="line-clamp-1">{req.delivery_address}</span>
                  </div>
                )}
                {req.status !== 'pending' && req.status !== 'searching_dp' && (
                  <div className="mt-3 w-full h-2 rounded-full overflow-hidden bg-white/8">
                    <div className="h-full rounded-full" style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#A6B300,#C0D900)' }} />
                  </div>
                )}
                <div className="mt-2.5 flex items-center gap-3 text-xs text-white/35">
                  <span className="flex items-center gap-1"><Clock size={12} /> {formatTime(req.created_at)}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {!loading && recentCompleted.length > 0 && (
        <div className="mt-8">
          <SectionHeader title="Recently Completed" action={
            <button type="button" onClick={() => navigate('/app/orders')} className="text-sm font-bold" style={{ color: '#C0D900' }}>View All</button>
          } />
          <div className="space-y-2">
            {recentCompleted.map(req => (
              <button key={req.id} type="button" onClick={() => navigate('/app/orders')}
                className="flex w-full items-center gap-3 rounded-[20px] p-3.5 text-left active:scale-[0.98]"
                style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: 'rgba(16,185,129,0.15)' }}>
                  <CheckCircle2 size={20} className="text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm truncate">{req.description?.split('\n')[0]?.trim() || 'Delivery'}</p>
                  <p className="text-xs mt-0.5 text-white/35">{formatTime(req.created_at)}</p>
                </div>
                <ChevronRight size={16} className="text-white/25" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
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
