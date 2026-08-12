import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../context'
import { normalizeVehicle, vehicleLabel, formatDistance, formatSpeed, formatBattery } from '../../lib/mapUtils'
import { STATUS_LABELS } from '../../lib/utils'
import { ArrowLeft, Bike, Star, Phone, Battery, Clock, Activity, Package, XCircle, CheckCircle2, MapPin } from 'lucide-react'
import { pg } from '../../design/tokens'

type OnlineDp = {
  user_id: string
  full_name: string
  phone: string | null
  photo_url: string | null
  vehicle_type: string | null
  current_lat: number | null
  current_lng: number | null
  heading: number | null
  speed_kmh: number | null
  battery_level: number | null
  rating_avg: number
  is_online: boolean
  last_location_at: string | null
  active_request_id: string | null
  active_request_status: string | null
}

type AdminRequest = {
  id: string
  status: string
  user_id: string
  accepted_dp_id: string | null
  delivery_address: string | null
  delivery_lat: number | null
  delivery_lng: number | null
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  accepted: '#3b82f6',
  confirmed: '#3b82f6',
  shopping: '#8b5cf6',
  purchased: '#8b5cf6',
  on_the_way: '#0C8A3E',
  arrived: '#0C8A3E',
  delivered: '#22c55e',
  completed: '#22c55e',
  cancelled: '#ef4444',
}

export default function AdminOperationsMap() {
  const navigate = useNavigate()
  const { theme } = useTheme()
  const [onlineDps, setOnlineDps] = useState<OnlineDp[]>([])
  const [requests, setRequests] = useState<AdminRequest[]>([])
  const [selectedDp, setSelectedDp] = useState<OnlineDp | null>(null)
  const [stats, setStats] = useState({ online: 0, pending: 0, active: 0, completed: 0, cancelled: 0 })

  useEffect(() => {
    const fetchData = async () => {
      const { data: dps, error: dpErr } = await supabase.rpc('get_online_dps')
      if (!dpErr && dps) {
        setOnlineDps(dps as OnlineDp[])
      } else {
        const { data: rawDps } = await supabase
          .from('delivery_partners')
          .select('user_id, vehicle_type, rating_avg, is_online, current_lat, current_lng, heading, speed_kmh, battery_level, last_location_at')
          .eq('is_online', true)
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, phone, photo_url')
          .in('id', (rawDps || []).map((d: any) => d.user_id))
        const profMap = new Map((profiles || []).map((p: any) => [p.id, p]))
        setOnlineDps((rawDps || []).map((d: any) => {
          const p = profMap.get(d.user_id)
          return { ...d, full_name: p?.full_name || 'DP', phone: p?.phone || null, photo_url: p?.photo_url || null, active_request_id: null, active_request_status: null }
        }))
      }

      const { data: reqs } = await supabase
        .from('requests')
        .select('id, status, user_id, accepted_dp_id, delivery_address, delivery_lat, delivery_lng, created_at')
        .in('status', ['pending', 'accepted', 'confirmed', 'shopping', 'purchased', 'on_the_way', 'arrived', 'delivered', 'completed', 'cancelled'])
        .order('created_at', { ascending: false })
        .limit(100)
      setRequests((reqs as AdminRequest[]) || [])

      const { count: onlineCount } = await supabase.from('delivery_partners').select('id', { count: 'exact', head: true }).eq('is_online', true)
      const { count: pendingCount } = await supabase.from('requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      const { count: activeCount } = await supabase.from('requests').select('id', { count: 'exact', head: true }).in('status', ['accepted', 'confirmed', 'shopping', 'purchased', 'on_the_way', 'arrived'])
      const { count: completedCount } = await supabase.from('requests').select('id', { count: 'exact', head: true }).eq('status', 'completed')
      const { count: cancelledCount } = await supabase.from('requests').select('id', { count: 'exact', head: true }).eq('status', 'cancelled')
      setStats({ online: onlineCount || 0, pending: pendingCount || 0, active: activeCount || 0, completed: completedCount || 0, cancelled: cancelledCount || 0 })
    }

    fetchData()

    const dpChannel = supabase
      .channel('admin-dp-ops')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_partners' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => fetchData())
      .subscribe()

    return () => { supabase.removeChannel(dpChannel) }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: pg.bg }}>
      <div className="px-4 pt-12 pb-3" style={{ borderBottom: `1px solid ${pg.line}`, background: 'rgba(5,5,5,0.92)', backdropFilter: 'blur(16px)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin')} className="flex h-11 w-11 items-center justify-center rounded-2xl active:scale-90 transition-transform" style={{ background: pg.surface2, color: pg.ink, border: `1px solid ${pg.line}` }}>
            <ArrowLeft size={18} style={{ color: pg.text2 }} />
          </button>
          <div className="flex-1">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em]" style={{ color: pg.lime }}>Live Operations</p>
            <p className="text-sm font-extrabold text-[#0F1A14]">Operations Dashboard</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.25)' }}>
            <Activity size={14} className="text-green-400" />
            <span className="text-xs font-bold text-green-300">Live</span>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-3 grid grid-cols-5 gap-2">
          <div className="rounded-xl p-2 text-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <p className="text-lg font-bold text-[#0F1A14]">{stats.online}</p>
            <p className="text-[9px] text-black/40">Online DPs</p>
          </div>
          <div className="rounded-xl p-2 text-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <p className="text-lg font-bold text-yellow-400">{stats.pending}</p>
            <p className="text-[9px] text-black/40">Pending</p>
          </div>
          <div className="rounded-xl p-2 text-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <p className="text-lg font-bold text-blue-400">{stats.active}</p>
            <p className="text-[9px] text-black/40">Active</p>
          </div>
          <div className="rounded-xl p-2 text-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <p className="text-lg font-bold text-green-400">{stats.completed}</p>
            <p className="text-[9px] text-black/40">Done</p>
          </div>
          <div className="rounded-xl p-2 text-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <p className="text-lg font-bold text-red-400">{stats.cancelled}</p>
            <p className="text-[9px] text-black/40">Cancelled</p>
          </div>
        </div>
      </div>

      {/* List view — no map */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {/* Online DPs list */}
        <div className="mb-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-black/40">Online Delivery Partners ({onlineDps.length})</h3>
          {onlineDps.length === 0 ? (
            <p className="py-4 text-center text-sm text-black/30">No delivery partners online</p>
          ) : (
            <div className="space-y-2">
              {onlineDps.map(dp => (
                <div key={dp.user_id} onClick={() => setSelectedDp(dp)}
                  className="flex items-center gap-3 rounded-xl p-3 transition-all active:scale-[0.98] cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-black/5">
                    {dp.photo_url ? <img src={dp.photo_url} alt={dp.full_name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Bike size={18} className="text-black/40" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0F1A14] truncate">{dp.full_name}</p>
                    <div className="flex items-center gap-2 text-xs text-black/40">
                      <span className="flex items-center gap-0.5"><Star size={10} className="text-yellow-400" />{dp.rating_avg?.toFixed(1) || '0.0'}</span>
                      <span>·</span>
                      <span>{vehicleLabel(normalizeVehicle(dp.vehicle_type))}</span>
                      {dp.active_request_status && (<><span>·</span><span style={{ color: STATUS_COLORS[dp.active_request_status] || '#666' }}>{STATUS_LABELS[dp.active_request_status] || dp.active_request_status}</span></>)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-[10px] text-black/40">Live</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active requests list */}
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-black/40">Active Requests ({requests.length})</h3>
          {requests.length === 0 ? (
            <p className="py-4 text-center text-sm text-black/30">No active requests</p>
          ) : (
            <div className="space-y-2">
              {requests.slice(0, 30).map(req => (
                <div key={req.id} className="flex items-center gap-3 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${STATUS_COLORS[req.status] || '#666'}22` }}>
                    <Package size={14} style={{ color: STATUS_COLORS[req.status] || '#666' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0F1A14]">{STATUS_LABELS[req.status] || req.status}</p>
                    <p className="text-xs text-black/40 truncate flex items-center gap-1">
                      <MapPin size={10} className="shrink-0" />
                      {req.delivery_address?.substring(0, 50) || 'No address'}
                    </p>
                  </div>
                  <span className="text-[10px] text-black/30 shrink-0">
                    {new Date(req.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Selected DP popup card */}
      {selectedDp && (
        <div className="fixed inset-0 z-[1001] flex items-end" onClick={() => setSelectedDp(null)}>
          <div className="absolute inset-0 bg-[#000000]/40" />
          <div className="relative w-full mx-auto max-w-md p-4 pb-6 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="rounded-2xl p-5" style={{ background: 'rgba(20,20,30,0.95)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(20px)' }}>
              <div className="bottom-sheet-handle" />
              <div className="flex items-start gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-2xl bg-black/5">
                  {selectedDp.photo_url ? <img src={selectedDp.photo_url} alt={selectedDp.full_name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-black/40"><Bike size={24} /></div>}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-[#0F1A14]">{selectedDp.full_name}</p>
                  <div className="flex items-center gap-2 text-xs text-black/50">
                    <span className="flex items-center gap-0.5"><Star size={12} className="text-yellow-400" />{selectedDp.rating_avg?.toFixed(1) || '0.0'}</span>
                    <span>·</span>
                    <span>{vehicleLabel(normalizeVehicle(selectedDp.vehicle_type))}</span>
                    {selectedDp.phone && (<><span>·</span><span className="flex items-center gap-0.5"><Phone size={10} />{selectedDp.phone}</span></>)}
                  </div>
                  {selectedDp.active_request_status && (
                    <div className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: `${STATUS_COLORS[selectedDp.active_request_status] || '#666'}33`, color: STATUS_COLORS[selectedDp.active_request_status] || '#666' }}>
                      {STATUS_LABELS[selectedDp.active_request_status] || selectedDp.active_request_status}
                    </div>
                  )}
                </div>
                <button onClick={() => setSelectedDp(null)} className="text-black/40 hover:text-black/75"><XCircle size={18} /></button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-black/10 pt-3">
                <div className="text-center">
                  <p className="text-xs font-bold text-[#0F1A14]">{formatSpeed(selectedDp.speed_kmh || 0)}</p>
                  <p className="text-[9px] text-black/40">Speed</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-[#0F1A14] flex items-center justify-center gap-0.5">
                    <Battery size={12} className="text-green-400" />
                    {formatBattery(selectedDp.battery_level)}
                  </p>
                  <p className="text-[9px] text-black/40">Battery</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-[#0F1A14]">
                    {selectedDp.last_location_at ? new Date(selectedDp.last_location_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--'}
                  </p>
                  <p className="text-[9px] text-black/40">Last Update</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
