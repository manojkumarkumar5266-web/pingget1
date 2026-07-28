import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useLeafletMap } from '../../hooks/useLeafletMap'
import { useTheme } from '../../context'
import { createVehicleIcon, createUserLocationIcon, vehicleLabel, normalizeVehicle, formatDistance, formatSpeed, formatBattery, type VehicleType, type LatLng } from '../../lib/mapUtils'
import { STATUS_LABELS } from '../../lib/utils'
import L from 'leaflet'
import { ArrowLeft, Bike, Star, Phone, Battery, MapPin, Clock, Activity, Package, XCircle, CheckCircle2 } from 'lucide-react'

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
  delivery_address: string
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
  on_the_way: '#808000',
  arrived: '#808000',
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

  const { map, ready } = useLeafletMap('admin-ops-map', [17.385, 78.4867], 12)
  const dpMarkerRefs = useRef<Map<string, L.Marker>>(new Map())
  const requestMarkerRefs = useRef<Map<string, L.Marker>>(new Map())
  const prevPositions = useRef<Map<string, LatLng>>(new Map())

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      // Online DPs
      const { data: dps, error: dpErr } = await supabase.rpc('get_online_dps')
      if (!dpErr && dps) {
        setOnlineDps(dps as OnlineDp[])
      } else {
        // Fallback
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

      // Requests
      const { data: reqs } = await supabase
        .from('requests')
        .select('id, status, user_id, accepted_dp_id, delivery_address, delivery_lat, delivery_lng, created_at')
        .in('status', ['pending', 'accepted', 'confirmed', 'shopping', 'purchased', 'on_the_way', 'arrived', 'delivered', 'completed', 'cancelled'])
        .order('created_at', { ascending: false })
        .limit(100)
      setRequests((reqs as AdminRequest[]) || [])

      // Stats
      const { count: onlineCount } = await supabase.from('delivery_partners').select('id', { count: 'exact', head: true }).eq('is_online', true)
      const { count: pendingCount } = await supabase.from('requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      const { count: activeCount } = await supabase.from('requests').select('id', { count: 'exact', head: true }).in('status', ['accepted', 'confirmed', 'shopping', 'purchased', 'on_the_way', 'arrived'])
      const { count: completedCount } = await supabase.from('requests').select('id', { count: 'exact', head: true }).eq('status', 'completed')
      const { count: cancelledCount } = await supabase.from('requests').select('id', { count: 'exact', head: true }).eq('status', 'cancelled')
      setStats({ online: onlineCount || 0, pending: pendingCount || 0, active: activeCount || 0, completed: completedCount || 0, cancelled: cancelledCount || 0 })
    }

    fetchData()

    // Realtime subscriptions
    const dpChannel = supabase
      .channel('admin-dp-ops')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_partners' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => fetchData())
      .subscribe()

    return () => { supabase.removeChannel(dpChannel) }
  }, [])

  // DP markers with smooth animation
  useEffect(() => {
    if (!map) return
    const refs = dpMarkerRefs.current
    const prevMap = prevPositions.current
    const currentIds = new Set(onlineDps.map(d => d.user_id))

    // Remove stale markers
    refs.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        map.removeLayer(marker)
        refs.delete(id)
        prevMap.delete(id)
      }
    })

    onlineDps.forEach(dp => {
      if (!dp.current_lat || !dp.current_lng) return
      const vehicle = normalizeVehicle(dp.vehicle_type)
      const pos: LatLng = { lat: dp.current_lat, lng: dp.current_lng }
      const existing = refs.get(dp.user_id)
      const prev = prevMap.get(dp.user_id)

      if (!existing) {
        const marker = L.marker([pos.lat, pos.lng], {
          icon: createVehicleIcon(vehicle, dp.heading || 0, dp.is_online),
        }).addTo(map)
        marker.on('click', () => setSelectedDp(dp))
        marker.bindPopup(`
          <div style="min-width:160px">
            <div style="font-weight:700;font-size:14px">${dp.full_name}</div>
            <div style="font-size:12px;color:#666;margin-top:2px">${vehicleLabel(vehicle)} · ⭐${dp.rating_avg?.toFixed(1) || '0.0'}</div>
            ${dp.active_request_status ? `<div style="font-size:11px;margin-top:4px;color:${STATUS_COLORS[dp.active_request_status] || '#666'}">${STATUS_LABELS[dp.active_request_status] || dp.active_request_status}</div>` : ''}
          </div>
        `)
        refs.set(dp.user_id, marker)
        prevMap.set(dp.user_id, pos)
      } else if (prev) {
        const from = prev
        const to = pos
        const duration = 2000
        const startTime = performance.now()
        const animate = (now: number) => {
          const elapsed = now - startTime
          const fraction = Math.min(elapsed / duration, 1)
          const lat = from.lat + (to.lat - from.lat) * fraction
          const lng = from.lng + (to.lng - from.lng) * fraction
          existing.setLatLng([lat, lng])
          if (fraction < 1) {
            requestAnimationFrame(animate)
          } else {
            prevMap.set(dp.user_id, to)
          }
        }
        requestAnimationFrame(animate)
      }
    })
  }, [map, onlineDps])

  // Request markers
  useEffect(() => {
    if (!map) return
    const refs = requestMarkerRefs.current
    const currentIds = new Set(requests.map(r => r.id))

    refs.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        map.removeLayer(marker)
        refs.delete(id)
      }
    })

    requests.forEach(req => {
      if (!req.delivery_lat || !req.delivery_lng) return
      const existing = refs.get(req.id)
      const color = STATUS_COLORS[req.status] || '#666'
      if (!existing) {
        const icon = L.divIcon({
          html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
          className: 'admin-request-marker',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        })
        const marker = L.marker([req.delivery_lat, req.delivery_lng], { icon }).addTo(map)
        marker.bindPopup(`
          <div style="min-width:140px">
            <div style="font-weight:600;font-size:13px">${STATUS_LABELS[req.status] || req.status}</div>
            <div style="font-size:11px;color:#666;margin-top:2px">${req.delivery_address?.substring(0, 50) || ''}</div>
          </div>
        `)
        refs.set(req.id, marker)
      }
    })
  }, [map, requests])

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: theme === 'dark' ? '#0f1a0d' : '#f5f5f5' }}>
      <div id="admin-ops-map" className="absolute inset-0" />

      {/* Top bar */}
      <div className="absolute left-0 right-0 top-0 z-[1000] px-4 pt-12">
        <div className="map-glass-panel p-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/admin')} className="map-control-btn map-control-dark">
              <ArrowLeft size={18} />
            </button>
            <div className="flex-1">
              <p className="text-xs text-white/50">Live Operations</p>
              <p className="text-sm font-bold text-white">Operations Dashboard</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Activity size={14} className="text-green-400" />
              <span className="text-xs text-white/50">Live</span>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-3 grid grid-cols-5 gap-2">
            <div className="text-center">
              <p className="text-lg font-bold text-white">{stats.online}</p>
              <p className="text-[9px] text-white/40">Online DPs</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-yellow-400">{stats.pending}</p>
              <p className="text-[9px] text-white/40">Pending</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-blue-400">{stats.active}</p>
              <p className="text-[9px] text-white/40">Active</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-green-400">{stats.completed}</p>
              <p className="text-[9px] text-white/40">Done</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-red-400">{stats.cancelled}</p>
              <p className="text-[9px] text-white/40">Cancelled</p>
            </div>
          </div>
        </div>
      </div>

      {/* Selected DP popup card */}
      {selectedDp && (
        <div className="absolute bottom-0 left-0 right-0 z-[1001]">
          <div className="map-glass-panel mx-3 mb-4 max-w-md mx-auto p-5">
            <div className="bottom-sheet-handle" />
            <div className="flex items-start gap-3">
              <div className="h-14 w-14 overflow-hidden rounded-2xl bg-white/10">
                {selectedDp.photo_url ? (
                  <img src={selectedDp.photo_url} alt={selectedDp.full_name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-white/40"><Bike size={24} /></div>
                )}
              </div>
              <div className="flex-1">
                <p className="font-bold text-white">{selectedDp.full_name}</p>
                <div className="flex items-center gap-2 text-xs text-white/50">
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
              <button onClick={() => setSelectedDp(null)} className="text-white/40 hover:text-white/80">
                <XCircle size={18} />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
              <div className="text-center">
                <p className="text-xs font-bold text-white">{formatSpeed(selectedDp.speed_kmh || 0)}</p>
                <p className="text-[9px] text-white/40">Speed</p>
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-white flex items-center justify-center gap-0.5">
                  <Battery size={12} className="text-green-400" />
                  {formatBattery(selectedDp.battery_level)}
                </p>
                <p className="text-[9px] text-white/40">Battery</p>
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-white">
                  {selectedDp.last_location_at ? new Date(selectedDp.last_location_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--'}
                </p>
                <p className="text-[9px] text-white/40">Last Update</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
