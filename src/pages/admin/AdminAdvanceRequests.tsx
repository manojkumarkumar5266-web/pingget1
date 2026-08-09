import { useEffect, useState } from 'react'
import { supabase, type AdvanceSettings } from '../../lib/supabase'
import { formatCurrency, formatTime } from '../../lib/utils'
import { StatusBadge, EmptyState, SkeletonCard } from '../../components/ui'
import RescheduleModal from '../../components/RescheduleModal'
import { CalendarClock, Search, X, MapPin, Tag, Clock, IndianRupee, User, Bike, Package, ChevronRight, CalendarPlus, Repeat } from 'lucide-react'
import { AdminShell, AdminHeader } from './adminChrome'

type FilterType = 'all' | 'today' | 'tomorrow' | 'next7days' | 'pending' | 'assigned' | 'accepted' | 'completed' | 'cancelled' | 'expired' | 'rescheduled'

export default function AdminAdvanceRequests() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [selected, setSelected] = useState<any | null>(null)
  const [advanceSettings, setAdvanceSettings] = useState<AdvanceSettings | null>(null)
  const [rescheduleTarget, setRescheduleTarget] = useState<any | null>(null)

  useEffect(() => {
    fetchRequests()
    supabase.from('advance_settings').select('*').limit(1).maybeSingle().then(({ data }) => { if (data) setAdvanceSettings(data as AdvanceSettings) })
    const channel = supabase.channel('admin-advance-requests-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => fetchRequests())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .eq('order_type', 'advance')
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) { console.error('AdminAdvanceRequests fetch error:', error); setLoading(false); return }
    setRequests(data || [])
    setLoading(false)
  }

  const filtered = requests.filter(r => {
    const schedDate = r.scheduled_date ? new Date(r.scheduled_date) : null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const next7 = new Date(today)
    next7.setDate(next7.getDate() + 7)

    if (filter === 'today' && schedDate) {
      const d = new Date(schedDate); d.setHours(0,0,0,0)
      return d.getTime() === today.getTime()
    }
    if (filter === 'tomorrow' && schedDate) {
      const d = new Date(schedDate); d.setHours(0,0,0,0)
      return d.getTime() === tomorrow.getTime()
    }
    if (filter === 'next7days' && schedDate) {
      const d = new Date(schedDate); d.setHours(0,0,0,0)
      return d >= today && d <= next7
    }
    if (filter === 'pending') return ['scheduled','pending','searching_dp'].includes(r.status)
    if (filter === 'assigned') return ['accepted','confirmed','dp_reserved','waiting_payment','payment_verified','booking_confirmed'].includes(r.status)
    if (filter === 'accepted') return ['accepted','dp_reserved','waiting_payment','payment_verified','booking_confirmed'].includes(r.status)
    if (filter === 'completed') return ['completed','task_completed'].includes(r.status)
    if (filter === 'cancelled') return r.status === 'cancelled'
    if (filter === 'expired') return ['expired','no_dp_found'].includes(r.status)
    if (filter === 'rescheduled') return r.status === 'rescheduled'
    return true
  }).filter(r =>
    !search ||
    (r.description || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.request_category || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.delivery_address || '').toLowerCase().includes(search.toLowerCase()) ||
    r.id.toLowerCase().includes(search.toLowerCase())
  )

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'today', label: 'Today' },
    { key: 'tomorrow', label: 'Tomorrow' },
    { key: 'next7days', label: 'Next 7 Days' },
    { key: 'pending', label: 'Pending' },
    { key: 'assigned', label: 'Assigned' },
    { key: 'accepted', label: 'Accepted' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
    { key: 'expired', label: 'Expired' },
    { key: 'rescheduled', label: 'Rescheduled' },
  ]

  if (loading) return (
    <AdminShell>
      <div className="mb-6 h-8 w-64 skeleton rounded-xl" />
      <div className="space-y-3">{[1, 2, 3].map(i => <SkeletonCard key={i} lines={3} />)}</div>
    </AdminShell>
  )

  return (
    <AdminShell>
      <AdminHeader title="Advance Requests" />

      <div className="mb-4 relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by category, description, address, or ID..."
          className="input pl-10" />
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {filters.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className="whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition-all"
            style={filter === f.key
              ? { background: '#F5C542', color: '#0B0B0B' }
              : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<CalendarClock size={48} />} title="No advance requests found" />
      ) : (
        <div className="space-y-3">
          {filtered.map((r, i) => (
            <div key={r.id} className="card card-hover p-4 animate-slide-up cursor-pointer"
              style={{ animationDelay: `${i * 30}ms` }}
              onClick={() => setSelected(r)}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(245,197,66,0.15)', color: '#F5C542' }}>
                      {r.request_category || 'Advance'}
                    </span>
                    {r.is_scheduled && (
                      <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {r.scheduled_date} · {r.scheduled_slot || r.scheduled_time}
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-white truncate">
                    {r.description?.split('\n')[0]?.trim() || 'Scheduled Task'}
                  </p>
                  <p className="mt-0.5 text-xs text-white/40">ID: {r.id.slice(0, 12)}...</p>
                </div>
                <StatusBadge status={r.status} />
              </div>
              {r.estimated_total_charge != null && (
                <div className="mt-2 text-xs">
                  <span className="text-white/40">Est. Charge: </span>
                  <span className="font-semibold" style={{ color: '#F5C542' }}>{formatCurrency(r.estimated_total_charge)}</span>
                </div>
              )}
              <p className="mt-2 text-xs text-white/40">{formatTime(r.created_at)}</p>
            </div>
          ))}
        </div>
      )}

      {selected && <DetailDrawer request={selected} onClose={() => setSelected(null)} onReschedule={(r) => { setRescheduleTarget(r); setSelected(null) }} settings={advanceSettings} />}
      {rescheduleTarget && advanceSettings && (
        <RescheduleModal
          open={!!rescheduleTarget}
          onClose={() => setRescheduleTarget(null)}
          request={rescheduleTarget}
          settings={advanceSettings}
          actorType="admin"
          timeSlots={generateTimeSlots(advanceSettings.business_hours_start, advanceSettings.business_hours_end, advanceSettings.slot_duration_minutes)}
          onConfirm={async (newDate, newSlot, newDescription, newShopName, reason) => {
            const oldHistory = rescheduleTarget.reschedule_history || []
            const newHistory = [...oldHistory, {
              actor: 'admin',
              old_date: rescheduleTarget.scheduled_date,
              old_slot: rescheduleTarget.scheduled_slot,
              new_date: newDate.toISOString().slice(0, 10),
              new_slot: newSlot,
              old_description: rescheduleTarget.description,
              new_description: newDescription,
              old_shop: rescheduleTarget.shop_name,
              new_shop: newShopName,
              reason,
              timestamp: new Date().toISOString(),
            }]
            const slotStart = newSlot.split('-')[0]
            const [sh, sm] = slotStart.split(':').map(Number)
            const scheduledTimestamp = new Date(newDate)
            scheduledTimestamp.setHours(sh, sm, 0, 0)
            await supabase.from('requests').update({
              status: 'rescheduled',
              scheduled_date: newDate.toISOString().slice(0, 10),
              scheduled_time: slotStart,
              scheduled_slot: newSlot,
              scheduled_timestamp: scheduledTimestamp.toISOString(),
              description: newDescription || rescheduleTarget.description,
              shop_name: newShopName || null,
              preferred_shop: newShopName || rescheduleTarget.preferred_shop,
              reschedule_count: (rescheduleTarget.reschedule_count || 0) + 1,
              reschedule_history: newHistory,
            }).eq('id', rescheduleTarget.id)
            await supabase.from('reschedule_logs').insert({
              request_id: rescheduleTarget.id,
              actor_id: rescheduleTarget.user_id,
              actor_type: 'admin',
              old_date: rescheduleTarget.scheduled_date,
              old_slot: rescheduleTarget.scheduled_slot,
              new_date: newDate.toISOString().slice(0, 10),
              new_slot: newSlot,
              old_description: rescheduleTarget.description,
              new_description: newDescription,
              old_shop_name: rescheduleTarget.shop_name,
              new_shop_name: newShopName,
              reason,
            })
            fetchRequests()
            setRescheduleTarget(null)
          }}
        />
      )}
    </AdminShell>
  )
}

function DetailDrawer({ request, onClose, onReschedule, settings }: { request: any; onClose: () => void; onReschedule: (r: any) => void; settings: AdvanceSettings | null }) {
  const [userProfile, setUserProfile] = useState<any>(null)
  const [dpProfile, setDpProfile] = useState<any>(null)

  useEffect(() => {
    if (request.user_id) {
      supabase.from('profiles').select('full_name, phone, photo_url').eq('id', request.user_id).maybeSingle()
        .then(({ data }) => setUserProfile(data))
    }
    const dpId = request.accepted_dp_id
    if (dpId) {
      supabase.from('profiles').select('full_name, phone, photo_url').eq('id', dpId).maybeSingle()
        .then(({ data }) => setDpProfile(data))
    }
  }, [request])

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="absolute bottom-0 left-0 right-0 max-h-[90vh] overflow-y-auto rounded-t-3xl glass bottom-sheet"
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1.5 w-12 rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="px-5 pb-10 pt-4 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/40">Request ID</p>
              <p className="font-mono text-sm text-white/80">{request.id}</p>
            </div>
            <StatusBadge status={request.status} />
          </div>

          {/* Category + Schedule */}
          <div className="rounded-2xl border border-white/10 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Tag size={14} style={{ color: '#F5C542' }} />
              <span className="text-sm font-semibold text-white">{request.request_category || 'Advance Request'}</span>
            </div>
            {request.scheduled_date && (
              <div className="flex items-center gap-2 text-sm">
                <CalendarClock size={14} style={{ color: '#F5C542' }} />
                <span className="text-white/60">Scheduled: </span>
                <span className="font-medium text-white">{request.scheduled_date} at {request.scheduled_slot || request.scheduled_time}</span>
              </div>
            )}
            {request.estimated_task_duration && (
              <div className="flex items-center gap-2 text-sm">
                <Clock size={14} style={{ color: '#F5C542' }} />
                <span className="text-white/60">Est. Duration: </span>
                <span className="font-medium text-white">
                  {request.estimated_task_duration < 60 ? `${request.estimated_task_duration} min` : `${request.estimated_task_duration / 60} hr`}
                </span>
              </div>
            )}
          </div>

          {/* Description */}
          {request.description && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-white/40">Description</p>
              <div className="rounded-2xl border border-white/10 p-3 text-sm text-white/80 whitespace-pre-wrap">
                {request.description}
              </div>
            </div>
          )}

          {/* Shop Details */}
          {(request.shop_name || request.shop_address || request.shop_phone) && (
            <div className="rounded-2xl border border-white/10 p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/40 flex items-center gap-1.5">
                <Package size={12} /> Shop Details
              </p>
              {request.shop_name && <p className="text-sm text-white/80">Name: {request.shop_name}</p>}
              {request.shop_phone && <p className="text-sm text-white/80">Phone: {request.shop_phone}</p>}
              {request.shop_address && <p className="text-sm text-white/80">Address: {request.shop_address}</p>}
            </div>
          )}

          {/* Addresses */}
          <div className="rounded-2xl border border-white/10 p-4 space-y-2">
            {request.preferred_shop && (
              <div className="flex items-start gap-2 text-sm">
                <Package size={14} className="mt-0.5 shrink-0 text-accent-500" />
                <span className="text-white/60">Shop: <span className="font-medium text-white">{request.preferred_shop}</span></span>
              </div>
            )}
            {request.pickup_address && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin size={14} className="mt-0.5 shrink-0 text-warning-500" />
                <span className="text-white/60">Pickup: <span className="font-medium text-white">{request.pickup_address}</span></span>
              </div>
            )}
            <div className="flex items-start gap-2 text-sm">
              <MapPin size={14} className="mt-0.5 shrink-0 text-error-500" />
              <span className="text-white/60">Deliver to: <span className="font-medium text-white">{request.delivery_address}</span></span>
            </div>
          </div>

          {/* Charge Breakdown */}
          {request.charge_breakdown && (
            <div className="rounded-2xl border border-white/10 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/40">Estimated Charges</p>
              <div className="space-y-1.5 text-sm">
                {Object.entries(request.charge_breakdown as Record<string, number>).map(([key, val]) => (
                  val !== 0 && (
                    <div key={key} className="flex justify-between">
                      <span className="text-white/50">{key}</span>
                      <span className="font-semibold text-white">{formatCurrency(val)}</span>
                    </div>
                  )
                ))}
                {request.estimated_total_charge != null && (
                  <div className="flex justify-between border-t border-white/10 pt-2 mt-2">
                    <span className="font-bold text-white">Total</span>
                    <span className="font-bold" style={{ color: '#F5C542' }}>{formatCurrency(request.estimated_total_charge)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Photos */}
          {request.photo_urls && request.photo_urls.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">Photos</p>
              <div className="flex flex-wrap gap-2">
                {(request.photo_urls as string[]).map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt={`Photo ${i + 1}`} className="h-24 w-24 rounded-xl object-cover border border-white/10" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* People */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
              <div className="flex items-center gap-1.5 mb-2 text-xs text-white/40"><User size={12} /> Customer</div>
              <p className="text-sm font-semibold text-white">{userProfile?.full_name || '...'}</p>
              <p className="text-xs text-gray-500">{userProfile?.phone || ''}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
              <div className="flex items-center gap-1.5 mb-2 text-xs text-white/40"><Bike size={12} /> Delivery Partner</div>
              {dpProfile ? (
                <>
                  <p className="text-sm font-semibold text-white">{dpProfile?.full_name || '...'}</p>
                  <p className="text-xs text-gray-500">{dpProfile?.phone || ''}</p>
                </>
              ) : (
                <p className="text-sm text-white/40">Not assigned</p>
              )}
            </div>
          </div>

          {/* Reschedule & Cancel buttons for admin */}
          <div className="flex gap-2">
            {['scheduled', 'rescheduled', 'pending', 'accepted', 'confirmed', 'searching_dp', 'dp_reserved', 'waiting_payment', 'payment_verified', 'booking_confirmed'].includes(request.status) && (
              <button onClick={() => onReschedule(request)}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition-all active:scale-95"
                style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8' }}>
                <CalendarPlus size={16} /> Reschedule
              </button>
            )}
            {['scheduled', 'rescheduled', 'pending', 'accepted', 'confirmed', 'searching_dp', 'dp_reserved', 'waiting_payment', 'payment_verified', 'booking_confirmed'].includes(request.status) && (
              <button onClick={async () => {
                if (!window.confirm('Cancel this request? Admin override will waive any fees.')) return
                await supabase.from('requests').update({
                  status: 'cancelled',
                  cancellation_reason: 'Cancelled by admin',
                  cancelled_by: 'admin',
                  cancellation_fee: 0,
                }).eq('id', request.id)
                onClose()
              }}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition-all active:scale-95"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                <X size={16} /> Cancel (Admin Override)
              </button>
            )}
          </div>

          {/* Reschedule History */}
          {request.reschedule_history && request.reschedule_history.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40 flex items-center gap-1.5">
                <Repeat size={12} /> Reschedule History ({request.reschedule_history.length})
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-2xl border border-white/10 p-3 dark:border-gray-800">
                {(request.reschedule_history as any[]).map((h, i) => (
                  <div key={i} className="text-xs flex items-start gap-1.5">
                    <span className="font-semibold shrink-0" style={{ color: h.actor === 'admin' ? '#fbbf24' : '#818cf8' }}>
                      {h.actor}:
                    </span>
                    <span className="text-white/70 flex-1">
                      {h.old_date} {h.old_slot} → {h.new_date} {h.new_slot}
                      {h.reason && ` (${h.reason})`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-center text-xs text-white/40">Created {formatTime(request.created_at)}</p>
        </div>
      </div>
    </div>
  )
}

function generateTimeSlots(start: string, end: string, durationMin: number): { key: string; label: string; start: string; end: string }[] {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const startMin = sh * 60 + sm
  const endMin = eh * 60 + em
  const slots: { key: string; label: string; start: string; end: string }[] = []
  for (let t = startMin; t + durationMin <= endMin; t += durationMin) {
    const s = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
    const e = `${String(Math.floor((t + durationMin) / 60) % 24).padStart(2, '0')}:${String((t + durationMin) % 60).padStart(2, '0')}`
    slots.push({ key: `${s}-${e}`, label: `${s} - ${e}`, start: s, end: e })
  }
  return slots
}