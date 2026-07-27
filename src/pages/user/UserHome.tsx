import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase, DeliveryRequest } from '../../lib/supabase'
import { EmptyState, StatusBadge, ServiceStatusBanner } from '../../components/ui'
import { formatTime, formatCurrency, haversineDistance, formatDistance } from '../../lib/utils'
import { Package, Plus, Search, Clock, MapPin, TrendingUp, CheckCircle2, Bike, ChevronRight, Radar, Navigation, Loader2, Zap } from 'lucide-react'

export default function UserHome() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [activeOrders, setActiveOrders] = useState<DeliveryRequest[]>([])
  const [recentCompleted, setRecentCompleted] = useState<DeliveryRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, completed: 0, active: 0 })

  // Rapido-style nearby DP scanning
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<{ dpCount: number; avgDistance: number } | null>(null)
  const [scanRadius, setScanRadius] = useState(5) // km

  useEffect(() => {
    const fetchOrders = async () => {
      const { data: active } = await supabase
        .from('requests')
        .select('*')
        .eq('user_id', profile!.id)
        .in('status', ['pending', 'accepted', 'confirmed', 'shopping', 'purchased', 'on_the_way', 'arrived', 'delivered', 'cash_received'])
        .order('created_at', { ascending: false })
      setActiveOrders((active as DeliveryRequest[]) || [])

      const { data: completed } = await supabase
        .from('requests')
        .select('*')
        .eq('user_id', profile!.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(3)
      setRecentCompleted((completed as DeliveryRequest[]) || [])

      const { count: total } = await supabase.from('requests').select('id', { count: 'exact', head: true }).eq('user_id', profile!.id)
      const { count: completedCount } = await supabase.from('requests').select('id', { count: 'exact', head: true }).eq('user_id', profile!.id).eq('status', 'completed')
      const { count: activeCount } = await supabase.from('requests').select('id', { count: 'exact', head: true }).eq('user_id', profile!.id).in('status', ['pending', 'accepted', 'confirmed', 'shopping', 'purchased', 'on_the_way', 'arrived', 'delivered', 'cash_received'])
      setStats({ total: total || 0, completed: completedCount || 0, active: activeCount || 0 })

      setLoading(false)
    }
    fetchOrders()

    const channel = supabase
      .channel('user-home-requests')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'requests',
        filter: `user_id=eq.${profile!.id}`,
      }, () => fetchOrders()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile])

  // Rapido-style nearby DP scanning
  const scanForDps = async () => {
    if (!profile?.gps_lat || !profile?.gps_lng) {
      setScanResult({ dpCount: 0, avgDistance: 0 })
      return
    }
    setScanning(true)
    setScanResult(null)
    try {
      const { data, error } = await supabase.rpc('scan_nearby_dps', {
        p_user_lat: profile.gps_lat,
        p_user_lng: profile.gps_lng,
        p_radius_meters: scanRadius * 1000
      })
      if (error) throw error
      if (data && data.length > 0) {
        setScanResult({ dpCount: data[0].dp_count, avgDistance: data[0].avg_distance_meters })
      } else {
        setScanResult({ dpCount: 0, avgDistance: 0 })
      }
    } catch (e: any) {
      setScanResult({ dpCount: 0, avgDistance: 0 })
    } finally {
      setScanning(false)
    }
  }

  const statusSteps: Record<string, number> = {
    pending: 0, accepted: 1, confirmed: 2, shopping: 3, purchased: 4,
    on_the_way: 5, arrived: 6, delivered: 7, cash_received: 8, completed: 8,
  }

  return (
    <div className="mx-auto max-w-md px-4 py-4">
      <ServiceStatusBanner cityName={profile?.city} />

      {/* Stats Row */}
      <div className="mb-5 grid grid-cols-3 gap-3" style={{ animation: 'fade-in-up 0.4s ease-out both' }}>
        <div className="card p-3 text-center">
          <div className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/30">
            <Package size={18} className="text-primary-600 dark:text-primary-400" />
          </div>
          <p className="text-xl font-bold text-white">{stats.total}</p>
          <p className="text-[10px] text-white/50">Total Orders</p>
        </div>
        <div className="card p-3 text-center">
          <div className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-xl bg-warning-100 dark:bg-warning-900/30">
            <Bike size={18} className="text-warning-600 dark:text-warning-400" />
          </div>
          <p className="text-xl font-bold text-white">{stats.active}</p>
          <p className="text-[10px] text-white/50">Active</p>
        </div>
        <div className="card p-3 text-center">
          <div className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-xl bg-success-100 dark:bg-success-900/30">
            <CheckCircle2 size={18} className="text-success-600 dark:text-success-400" />
          </div>
          <p className="text-xl font-bold text-white">{stats.completed}</p>
          <p className="text-[10px] text-white/50">Completed</p>
        </div>
      </div>

      {/* Hero CTA */}
      <div
        className="mb-6 overflow-hidden rounded-3xl p-5 text-white shadow-lg animate-slide-up relative"
        style={{ background: 'linear-gradient(135deg, #808000 0%, #484800 100%)', boxShadow: '0 8px 24px rgba(128,128,0,0.2)' }}
      >
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-10 blur-2xl" style={{ background: '#808000' }} />
        <div className="relative z-10">
          <p className="text-sm font-medium text-white/70">Need something?</p>
          <h2 className="mt-1 text-xl font-bold leading-tight">Get it delivered by a local partner</h2>
          <p className="mt-1.5 text-sm text-white/60">From groceries to parcels, we've got you covered.</p>
          <button
            onClick={() => navigate('/app/create')}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-primary-700 transition-all active:scale-95 hover:scale-105 shadow-md"
          >
            <Plus size={18} /> New Delivery Request
          </button>
        </div>
      </div>

      {/* Rapido-style Nearby DP Scanner */}
      <div className="mb-6 card p-5 animate-slide-up">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'linear-gradient(135deg, rgba(128,128,0,0.3), rgba(96,96,0,0.3))' }}>
            <Radar size={16} style={{ color: '#808000' }} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Find Nearby Partners</h3>
            <p className="text-xs text-white/50">Scan for available delivery partners around you</p>
          </div>
        </div>

        {/* Radius selector */}
        <div className="mb-3 flex flex-wrap gap-2">
          {[1, 2, 3, 5, 7, 10].map(km => (
            <button
              key={km}
              type="button"
              onClick={() => setScanRadius(km)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 ${scanRadius === km ? 'text-white' : 'text-white/50 hover:text-white/80'}`}
              style={scanRadius === km
                ? { background: 'linear-gradient(135deg, #808000, #606000)' }
                : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              {km} km
            </button>
          ))}
        </div>

        {/* Scan button */}
        <button
          type="button"
          onClick={scanForDps}
          disabled={scanning}
          className="w-full rounded-xl py-3 text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-60"
          style={{ background: scanning ? 'rgba(128,128,0,0.3)' : 'linear-gradient(135deg, #808000, #606000)' }}
        >
          {scanning ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Scanning...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Zap size={16} /> Scan Now
            </span>
          )}
        </button>

        {/* Scan results */}
        {scanResult && !scanning && (
          <div className="mt-3 rounded-xl p-4 animate-fade-in" style={{
            background: scanResult.dpCount > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${scanResult.dpCount > 0 ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.1)'}`
          }}>
            {scanResult.dpCount > 0 ? (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: 'rgba(16,185,129,0.2)' }}>
                  <Bike size={20} className="text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">
                    {scanResult.dpCount} {scanResult.dpCount === 1 ? 'partner' : 'partners'} available!
                  </p>
                  <p className="text-xs text-white/50">
                    {scanResult.avgDistance > 0 ? `Avg distance: ${formatDistance(scanResult.avgDistance)}` : 'Nearby and ready to deliver'}
                  </p>
                </div>
                <button
                  onClick={() => navigate('/app/create')}
                  className="rounded-lg px-3 py-2 text-xs font-bold text-white transition-all active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #808000, #606000)' }}
                >
                  Request Now
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <Navigation size={20} className="text-white/40" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">No partners nearby</p>
                  <p className="text-xs text-white/50">
                    {!profile?.gps_lat ? 'Enable location access to scan accurately' : `No online partners within ${scanRadius} km. Try increasing the radius.`}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* GPS status indicator */}
        <div className="mt-2 flex items-center gap-1.5 text-xs">
          {profile?.gps_lat ? (
            <span className="flex items-center gap-1 text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" /> Location detected
            </span>
          ) : (
            <span className="flex items-center gap-1 text-white/40">
              <span className="h-1.5 w-1.5 rounded-full bg-white/30" /> Waiting for location...
            </span>
          )}
        </div>
      </div>

      {/* Active Orders */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-bold text-white">Active Orders</h3>
        <button onClick={() => navigate('/app/orders')} className="text-sm font-medium text-primary-600 dark:text-primary-400 flex items-center gap-0.5">
          View All <ChevronRight size={14} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-28 animate-pulse rounded-2xl glass" />)}
        </div>
      ) : activeOrders.length === 0 ? (
        <EmptyState
          icon={<Package size={48} />}
          title="No active orders"
          description="Create a request to get items delivered to you."
          action={
            <button onClick={() => navigate('/app/create')} className="btn-primary">
              <Plus size={16} /> Create Request
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {activeOrders.map((req, idx) => {
            const step = statusSteps[req.status] ?? 0
            const totalSteps = 8
            const progress = (step / totalSteps) * 100
            return (
              <button
                key={req.id}
                onClick={() => {
                  if (req.accepted_dp_id) {
                    navigateToChat(navigate, req.id)
                  } else {
                    navigate(`/app/orders`)
                  }
                }}
                className="card w-full p-4 text-left transition-all hover:shadow-md active:scale-[0.98] animate-slide-up overflow-hidden"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white">{req.description?.split('\n')[0]?.trim() || 'Delivery Request'}</p>
                    <p className="mt-0.5 line-clamp-1 text-sm text-white/50">{req.delivery_address}</p>
                  </div>
                  <StatusBadge status={req.status} />
                </div>

                {/* Progress bar */}
                {req.status !== 'pending' && (
                  <div className="mt-3 w-full">
                    <div className="h-1.5 w-full overflow-hidden rounded-full glass">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${progress}%`, backgroundColor: '#808000' }}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-3 flex items-center gap-4 text-xs text-white/40">
                  <span className="flex items-center gap-1"><Clock size={14} /> {formatTime(req.created_at)}</span>
                  {req.max_budget && <span className="flex items-center gap-1">{formatCurrency(req.max_budget)}</span>}
                  <span className="flex items-center gap-1"><MapPin size={14} /> {req.radius_meters}m</span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Recent Completed */}
      {!loading && recentCompleted.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Recent Completed</h3>
            <button onClick={() => navigate('/app/orders')} className="text-sm font-medium text-primary-600 dark:text-primary-400">
              View All
            </button>
          </div>
          <div className="space-y-2">
            {recentCompleted.map((req, idx) => (
              <button
                key={req.id}
                onClick={() => navigate('/app/orders')}
                className="card flex w-full items-center gap-3 p-3 text-left transition-all hover:shadow-md active:scale-[0.98] animate-slide-up"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success-100 dark:bg-success-900/30">
                  <CheckCircle2 size={18} className="text-success-600 dark:text-success-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm truncate">{req.description?.split('\n')[0]?.trim() || 'Delivery Request'}</p>
                  <p className="text-xs text-white/40">{formatTime(req.created_at)}</p>
                </div>
                <ChevronRight size={16} className="text-gray-300 dark:text-gray-600" />
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fade-in-up {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

async function navigateToChat(navigate: any, requestId: string) {
  const { data } = await supabase
    .from('chat_rooms')
    .select('id')
    .eq('request_id', requestId)
    .maybeSingle()
  if (data) navigate(`/app/chat/${data.id}`)
}
