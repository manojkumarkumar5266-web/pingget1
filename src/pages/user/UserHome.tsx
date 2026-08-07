import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase, DeliveryRequest } from '../../lib/supabase'
import { EmptyState, StatusBadge, ServiceStatusBanner, SkeletonList, SectionHeader } from '../../components/ui'
import { formatTime } from '../../lib/utils'
import { Package, Clock, MapPin, CheckCircle2, Bike, ChevronRight } from 'lucide-react'
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
    <div className="mx-auto max-w-md px-4 pt-5 pb-4">
      <ServiceStatusBanner cityName={profile?.city} />

      {/* Greeting + Hai hand */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Good {getGreeting()},</p>
          <h1 className="text-2xl font-bold text-white leading-tight truncate">Hai {firstName}</h1>
        </div>
        <img src={Images.haiHand} alt="" className="h-14 w-14 object-contain shrink-0" draggable={false} />
      </div>

      {/* Address — moved from New Request */}
      <AddressPicker />

      {/* Stats */}
      <div className="mb-5 grid grid-cols-3 gap-2.5">
        {[
          { label: 'Total', value: stats.total, icon: <Package size={16} />, color: 'rgba(166,179,0,0.2)', tColor: '#A6B300' },
          { label: 'Active', value: stats.active, icon: <Bike size={16} />, color: 'rgba(251,191,36,0.2)', tColor: '#fbbf24' },
          { label: 'Done', value: stats.completed, icon: <CheckCircle2 size={16} />, color: 'rgba(16,185,129,0.2)', tColor: '#10b981' },
        ].map(s => (
          <div key={s.label} className="card p-3 text-center">
            <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: s.color }}>
              <span style={{ color: s.tColor }}>{s.icon}</span>
            </div>
            <p className="text-xl font-bold text-white">{s.value}</p>
            <p className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      <FeatureCarousel />

      {/* Get Things Done — images only; booking via FAB + */}
      <div
        className="mb-6 overflow-hidden rounded-3xl relative"
        style={{ border: '1px solid rgba(166,179,0,0.18)' }}
      >
        <img src={Images.homeHero} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" draggable={false} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(26,29,0,0.88) 0%, rgba(11,11,11,0.75) 100%)' }} />
        <div className="relative z-10 p-5">
          <h2 className="text-2xl font-extrabold text-white leading-tight">Get Things Done</h2>
          <p className="mt-1.5 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Groceries, parcels, medicines — local partners deliver in minutes.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div className="overflow-hidden rounded-2xl" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              <img src={Images.feature.instantBooking} alt="Instant Booking" className="h-24 w-full object-cover" draggable={false} />
              <p className="px-2 py-1.5 text-center text-[11px] font-bold" style={{ color: '#A6B300', background: 'rgba(0,0,0,0.45)' }}>Instant Booking</p>
            </div>
            <div className="overflow-hidden rounded-2xl" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              <img src={Images.feature.advanceBooking} alt="Advance Booking" className="h-24 w-full object-cover" draggable={false} />
              <p className="px-2 py-1.5 text-center text-[11px] font-bold" style={{ color: '#A6B300', background: 'rgba(0,0,0,0.45)' }}>Advance Booking</p>
            </div>
          </div>
          <p className="mt-3 text-center text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Tap + below to book Instant or Advance
          </p>
        </div>
      </div>

      <SectionHeader
        title="Active Orders"
        action={
          <button type="button" onClick={() => navigate('/app/orders')} className="flex items-center gap-0.5 text-sm font-medium" style={{ color: '#A6B300' }}>
            See All <ChevronRight size={14} />
          </button>
        }
      />

      {loading ? (
        <SkeletonList count={2} lines={3} />
      ) : activeOrders.length === 0 ? (
        <EmptyState
          illustration={<img src={Images.emptyState} alt="" className="w-28 h-28 object-contain" />}
          title="No active orders"
          description="Tap + to start Instant or Advance booking."
        />
      ) : (
        <div className="space-y-3">
          {activeOrders.map(req => {
            const step = STATUS_STEPS[req.status] ?? 0
            const progress = (step / 8) * 100
            return (
              <button key={req.id} type="button" onClick={() => navigateToOrder(navigate, req)}
                className="card w-full overflow-hidden p-4 text-left active:scale-[0.98]">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-white text-sm line-clamp-1 flex-1">
                    {req.description?.split('\n')[0]?.trim() || 'Delivery Request'}
                  </p>
                  <StatusBadge status={req.status} />
                </div>
                {(req as any).order_type === 'advance' && (
                  <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(59,130,246,0.15)', color: '#60A5FA' }}>
                    Advance
                  </span>
                )}
                {req.delivery_address && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    <MapPin size={12} /> <span className="line-clamp-1">{req.delivery_address}</span>
                  </div>
                )}
                {req.status !== 'pending' && req.status !== 'searching_dp' && (
                  <div className="mt-3 w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div className="h-full rounded-full" style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#A6B300,#BFD400)' }} />
                  </div>
                )}
                <div className="mt-2.5 flex items-center gap-3 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
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
            <button type="button" onClick={() => navigate('/app/orders')} className="text-sm font-medium" style={{ color: '#A6B300' }}>View All</button>
          } />
          <div className="space-y-2">
            {recentCompleted.map(req => (
              <button key={req.id} type="button" onClick={() => navigate('/app/orders')}
                className="card flex w-full items-center gap-3 p-3 text-left active:scale-[0.98]">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl" style={{ background: 'rgba(16,185,129,0.15)' }}>
                  <CheckCircle2 size={18} className="text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm truncate">{req.description?.split('\n')[0]?.trim() || 'Delivery'}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{formatTime(req.created_at)}</p>
                </div>
                <ChevronRight size={16} style={{ color: 'rgba(255,255,255,0.25)' }} />
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
  if (['on_the_way', 'arrived', 'shopping', 'purchased', 'confirmed', 'delivered', 'cash_received'].includes(req.status)) {
    navigate(`/app/track/${req.id}`)
    return
  }
  if (req.accepted_dp_id || (req as any).reserved_dp_id) {
    const { data } = await supabase.from('chat_rooms').select('id').eq('request_id', req.id).maybeSingle()
    if (data) { navigate(`/app/chat/${data.id}`); return }
  }
  if (['pending', 'searching_dp'].includes(req.status)) {
    navigate(`/app/scanning/${req.id}`)
    return
  }
  navigate('/app/orders')
}
