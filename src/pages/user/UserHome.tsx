import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase, DeliveryRequest } from '../../lib/supabase'
import { EmptyState, StatusBadge, ServiceStatusBanner, SkeletonList, SectionHeader } from '../../components/ui'
import { formatTime } from '../../lib/utils'
import { Package, Plus, Clock, MapPin, CheckCircle2, Bike, ChevronRight, ShoppingBag, ChevronLeft } from 'lucide-react'

const STATUS_STEPS: Record<string, number> = {
  pending: 0, accepted: 1, confirmed: 2, shopping: 3, purchased: 4,
  on_the_way: 5, arrived: 6, delivered: 7, cash_received: 8, completed: 8,
}

type InfoCard = {
  id: string
  title: string
  description: string
  image_url: string | null
  icon: string
  bg_color: string
  sort_order: number
}

export default function UserHome() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [activeOrders, setActiveOrders] = useState<DeliveryRequest[]>([])
  const [recentCompleted, setRecentCompleted] = useState<DeliveryRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, completed: 0, active: 0 })
  const [infoCards, setInfoCards] = useState<InfoCard[]>([])
  const [currentCardIdx, setCurrentCardIdx] = useState(0)
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef<number | null>(null)
  const currentOffsetRef = useRef(0)

  useEffect(() => {
    const fetchOrders = async () => {
      const [activeRes, completedRes] = await Promise.all([
        supabase.from('requests').select('*').eq('user_id', profile!.id)
          .in('status', ['pending','accepted','confirmed','shopping','purchased','on_the_way','arrived','delivered','cash_received'])
          .order('created_at', { ascending: false }),
        supabase.from('requests').select('*').eq('user_id', profile!.id)
          .eq('status','completed').order('created_at', { ascending: false }).limit(3),
      ])
      setActiveOrders((activeRes.data as DeliveryRequest[]) || [])
      setRecentCompleted((completedRes.data as DeliveryRequest[]) || [])

      const [total, completedCount, activeCount] = await Promise.all([
        supabase.from('requests').select('id', { count: 'exact', head: true }).eq('user_id', profile!.id),
        supabase.from('requests').select('id', { count: 'exact', head: true }).eq('user_id', profile!.id).eq('status','completed'),
        supabase.from('requests').select('id', { count: 'exact', head: true }).eq('user_id', profile!.id)
          .in('status',['pending','accepted','confirmed','shopping','purchased','on_the_way','arrived','delivered','cash_received']),
      ])
      setStats({ total: total.count || 0, completed: completedCount.count || 0, active: activeCount.count || 0 })
      setLoading(false)
    }
    fetchOrders()
    const channel = supabase.channel('user-home-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests', filter: `user_id=eq.${profile!.id}` }, fetchOrders)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile])

  useEffect(() => {
    const fetchInfoCards = async () => {
      const { data } = await supabase.from('info_cards')
        .select('id, title, description, image_url, icon, bg_color, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .limit(10)
      setInfoCards((data as InfoCard[]) || [])
    }
    fetchInfoCards()
    const channel = supabase.channel('info-cards-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'info_cards' }, fetchInfoCards)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleSwipe = (direction: 'left' | 'right') => {
    setSwipeDirection(direction)
    setTimeout(() => {
      setCurrentCardIdx(prev => Math.min(prev + 1, infoCards.length))
      setSwipeDirection(null)
      if (cardRef.current) cardRef.current.style.transform = ''
      currentOffsetRef.current = 0
    }, 300)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startXRef.current === null || !cardRef.current) return
    const diff = e.touches[0].clientX - startXRef.current
    currentOffsetRef.current = diff
    cardRef.current.style.transform = `translateX(${diff}px) rotate(${diff * 0.05}deg)`
    cardRef.current.style.opacity = String(Math.max(0.5, 1 - Math.abs(diff) / 400))
  }

  const handleTouchEnd = () => {
    if (Math.abs(currentOffsetRef.current) > 100) {
      handleSwipe(currentOffsetRef.current > 0 ? 'right' : 'left')
    } else if (cardRef.current) {
      cardRef.current.style.transform = ''
      cardRef.current.style.opacity = '1'
      currentOffsetRef.current = 0
    }
    startXRef.current = null
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const currentCard = infoCards[currentCardIdx]
  const allCardsSeen = currentCardIdx >= infoCards.length

  return (
    <div className="mx-auto max-w-md px-4 pt-5 pb-4">
      <ServiceStatusBanner cityName={profile?.city} />

      {/* Greeting */}
      <div className="mb-5 animate-fade-in-up">
        <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Good {getGreeting()},</p>
        <h1 className="text-2xl font-bold text-white leading-tight">{firstName} 👋</h1>
      </div>

      {/* Stats Row */}
      <div className="mb-5 grid grid-cols-3 gap-2.5 animate-slide-up">
        {[
          { label: 'Total', value: stats.total, icon: <Package size={16} />, color: 'rgba(166,179,0,0.2)', tColor: '#A6B300' },
          { label: 'Active', value: stats.active, icon: <Bike size={16} />, color: 'rgba(251,191,36,0.2)', tColor: '#fbbf24' },
          { label: 'Done', value: stats.completed, icon: <CheckCircle2 size={16} />, color: 'rgba(16,185,129,0.2)', tColor: '#10b981' },
        ].map((s, i) => (
          <div key={s.label} className="card p-3 text-center animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: s.color }}>
              <span style={{ color: s.tColor }}>{s.icon}</span>
            </div>
            <p className="text-xl font-bold text-white">{s.value}</p>
            <p className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Swipeable Info Cards */}
      <div className="mb-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
        {infoCards.length > 0 && !allCardsSeen ? (
          <div className="relative" style={{ height: '280px' }}>
            {/* Stack effect: show next card behind */}
            {currentCardIdx + 1 < infoCards.length && (
              <div className="absolute inset-0 rounded-3xl scale-95 opacity-50"
                style={{ background: infoCards[currentCardIdx + 1].bg_color, border: '1px solid rgba(255,255,255,0.08)' }} />
            )}
            <div
              ref={cardRef}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="absolute inset-0 rounded-3xl p-6 flex flex-col justify-between transition-all"
              style={{
                background: currentCard.bg_color || 'rgba(166,179,0,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                transform: swipeDirection === 'left' ? 'translateX(-120%) rotate(-15deg)' : swipeDirection === 'right' ? 'translateX(120%) rotate(15deg)' : '',
                opacity: swipeDirection ? '0' : '1',
                transition: swipeDirection ? 'all 0.3s ease-out' : 'none',
              }}
            >
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-4xl">{currentCard.icon}</span>
                  <span className="rounded-full px-2.5 py-1 text-[10px] font-bold"
                    style={{ background: 'rgba(166,179,0,0.2)', color: '#A6B300' }}>
                    {currentCardIdx + 1} / {infoCards.length}
                  </span>
                </div>
                {currentCard.image_url && (
                  <img src={currentCard.image_url} alt={currentCard.title} className="mb-3 h-24 w-full rounded-2xl object-cover" />
                )}
                <h2 className="text-xl font-extrabold text-white leading-tight mb-2">{currentCard.title}</h2>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>{currentCard.description}</p>
              </div>
              <div className="flex items-center justify-between mt-4">
                <button onClick={() => handleSwipe('left')}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl transition-all active:scale-90"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <ChevronLeft size={20} style={{ color: 'rgba(255,255,255,0.5)' }} />
                </button>
                <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>Swipe to explore</p>
                <button onClick={() => handleSwipe('right')}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl transition-all active:scale-90"
                  style={{ background: 'rgba(166,179,0,0.2)', border: '1px solid rgba(166,179,0,0.3)' }}>
                  <ChevronRight size={20} style={{ color: '#A6B300' }} />
                </button>
              </div>
            </div>
          </div>
        ) : infoCards.length > 0 && allCardsSeen ? (
          <div className="rounded-3xl p-6 text-center" style={{ background: 'rgba(166,179,0,0.08)', border: '1px solid rgba(166,179,0,0.18)' }}>
            <p className="text-3xl mb-2">✨</p>
            <p className="text-sm font-semibold text-white mb-1">You've seen all tips!</p>
            <button onClick={() => setCurrentCardIdx(0)} className="text-xs font-medium" style={{ color: '#A6B300' }}>View again</button>
          </div>
        ) : null}
      </div>

      {/* Active Orders */}
      <SectionHeader
        title="Active Orders"
        action={
          <button onClick={() => navigate('/app/orders')} className="flex items-center gap-0.5 text-sm font-medium" style={{ color: '#A6B300' }}>
            See All <ChevronRight size={14} />
          </button>
        }
      />

      {loading ? (
        <SkeletonList count={2} lines={3} />
      ) : activeOrders.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag size={40} />}
          title="No active orders"
          description="Tap the + button below to create a new request."
        />
      ) : (
        <div className="space-y-3">
          {activeOrders.map((req, idx) => {
            const step = STATUS_STEPS[req.status] ?? 0
            const progress = (step / 8) * 100
            return (
              <button key={req.id} onClick={() => navigateToOrder(navigate, req)}
                className="card w-full overflow-hidden p-4 text-left transition-all active:scale-[0.98] animate-slide-up"
                style={{ animationDelay: `${idx * 50}ms` }}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-white text-sm line-clamp-1 flex-1">
                    {req.description?.split('\n')[0]?.trim() || 'Delivery Request'}
                  </p>
                  <StatusBadge status={req.status} />
                </div>
                {req.delivery_address && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    <MapPin size={12} /> <span className="line-clamp-1">{req.delivery_address}</span>
                  </div>
                )}
                {req.status !== 'pending' && (
                  <div className="mt-3 w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#A6B300,#BFD400)' }} />
                  </div>
                )}
                <div className="mt-2.5 flex items-center gap-3 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  <span className="flex items-center gap-1"><Clock size={12} /> {formatTime(req.created_at)}</span>
                  {req.max_budget && <span>₹{req.max_budget}</span>}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Recent Completed */}
      {!loading && recentCompleted.length > 0 && (
        <div className="mt-8">
          <SectionHeader title="Recently Completed" action={
            <button onClick={() => navigate('/app/orders')} className="text-sm font-medium" style={{ color: '#A6B300' }}>View All</button>
          } />
          <div className="space-y-2">
            {recentCompleted.map((req, idx) => (
              <button key={req.id} onClick={() => navigate(`/app/track/${req.id}`)}
                className="card flex w-full items-center gap-3 p-3 text-left active:scale-[0.98] animate-slide-up"
                style={{ animationDelay: `${idx * 40}ms` }}>
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
  if (req.accepted_dp_id) {
    navigate(`/app/track/${req.id}`)
  } else {
    navigate('/app/orders')
  }
}
