import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase, DeliveryRequest, Profile, type AdvanceSettings } from '../../lib/supabase'
import { StatusBadge, Avatar, SkeletonList } from '../../components/ui'
import { formatTime } from '../../lib/utils'
import CancellationModal from '../../components/CancellationModal'
import RescheduleModal from '../../components/RescheduleModal'
import { Clock, MapPin, MessageCircle, Bike, CheckCircle2, Package, ShoppingBag, Truck, ChevronRight, CalendarClock, CalendarPlus, CreditCard } from 'lucide-react'
import { Screen, PageTitle, Surface, Chip, CTA, EmptyBlock } from '../../design/primitives'
import { pg } from '../../design/tokens'
import { Images } from '../../lib/customImages'

type Tab = 'active' | 'completed' | 'cancelled'
type RequestWithDp = DeliveryRequest & { _dp?: Profile }

const STEPS = [
  { key: 'accepted', label: 'Accepted', icon: CheckCircle2 },
  { key: 'shopping', label: 'Shopping', icon: ShoppingBag },
  { key: 'on_the_way', label: 'On The Way', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: Package },
]

const STATUS_ORDER: Record<string, number> = {
  pending: 0, accepted: 1, confirmed: 1, shopping: 2, purchased: 2, on_the_way: 3, arrived: 3, delivered: 4, cash_received: 4, completed: 5,
}

function OrderTimeline({ status }: { status: string }) {
  const step = STATUS_ORDER[status] ?? 0
  return (
    <div className="my-3 flex items-center gap-0">
      {STEPS.map((s, i) => {
        const done = step > i + 1
        const active = step === i + 1
        const Icon = s.icon
        return (
          <div key={s.key} className="flex flex-1 items-center">
            <div className="flex shrink-0 flex-col items-center gap-1">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full transition-all"
                style={
                  done || active
                    ? {
                        background: pg.lime,
                        border: `2px solid ${pg.lime}`,
                        boxShadow: active ? '0 0 0 4px rgba(212,240,0,0.2)' : 'none',
                      }
                    : { background: 'transparent', border: '2px solid rgba(255,255,255,0.12)' }
                }
              >
                <Icon size={12} style={{ color: done || active ? pg.limeText : pg.text4 }} />
              </div>
              <p
                className="w-14 text-center text-[9px] font-bold leading-tight"
                style={{ color: done || active ? pg.lime : pg.text4 }}
              >
                {s.label}
              </p>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="mx-0.5 h-0.5 flex-1 rounded-full transition-all duration-500"
                style={{ background: step > i + 1 ? pg.lime : 'rgba(255,255,255,0.08)' }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function UserOrders() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('active')
  const [orders, setOrders] = useState<RequestWithDp[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [cancelTarget, setCancelTarget] = useState<RequestWithDp | null>(null)
  const [rescheduleTarget, setRescheduleTarget] = useState<RequestWithDp | null>(null)
  const [advanceSettings, setAdvanceSettings] = useState<AdvanceSettings | null>(null)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('requests').select('*').eq('user_id', profile!.id)
    if (tab === 'active')
      query = query.in('status', [
        'pending', 'accepted', 'confirmed', 'shopping', 'purchased', 'on_the_way', 'arrived', 'delivered',
        'cash_received', 'scheduled', 'rescheduled', 'dp_reserved', 'waiting_payment', 'payment_verified',
        'booking_confirmed', 'task_started', 'task_completed', 'no_dp_found',
      ])
    else if (tab === 'completed') query = query.eq('status', 'completed')
    else query = query.in('status', ['cancelled', 'expired'])
    const { data } = await query.order('created_at', { ascending: false })
    const requests = (data as DeliveryRequest[]) || []
    const dpIds = [...new Set(requests.map(r => r.accepted_dp_id).filter(Boolean))] as string[]
    let dpMap = new Map<string, Profile>()
    if (dpIds.length > 0) {
      const { data: dps } = await supabase.from('profiles').select('id, full_name, photo_url, phone').in('id', dpIds)
      dps?.forEach((p: any) => dpMap.set(p.id, p as Profile))
    }
    setOrders(requests.map(r => ({ ...r, _dp: r.accepted_dp_id ? dpMap.get(r.accepted_dp_id) : undefined })))
    setLoading(false)
  }, [profile, tab])

  useEffect(() => { fetchOrders() }, [fetchOrders])
  useEffect(() => {
    supabase.from('advance_settings').select('*').limit(1).maybeSingle().then(({ data }) => { if (data) setAdvanceSettings(data as AdvanceSettings) })
  }, [])
  useEffect(() => {
    const channel = supabase.channel('user-orders-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests', filter: `user_id=eq.${profile!.id}` }, fetchOrders)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile, fetchOrders])

  const confirmDelivery = async (req: RequestWithDp) => {
    setUpdating(req.id)
    const now = new Date().toISOString()
    const { error: reqError } = await supabase.from('requests').update({ status: 'completed', delivery_accepted_at: now }).eq('id', req.id)
    if (reqError) {
      const { error: fallback } = await supabase.from('requests').update({ status: 'completed' }).eq('id', req.id)
      if (fallback) { setUpdating(null); alert('Could not confirm delivery. Please try again.'); return }
    }
    const { error: orderError } = await supabase.from('orders').update({ status: 'completed', completed_at: now, delivery_accepted_at: now }).eq('request_id', req.id)
    if (orderError) {
      await supabase.from('orders').update({ status: 'completed', completed_at: now }).eq('request_id', req.id)
    }
    await supabase.from('notifications').insert({
      user_id: req.accepted_dp_id,
      title: 'Delivery Confirmed',
      body: 'Customer confirmed receipt. The order is now complete.',
      type: 'order_completed',
      related_id: req.id,
    })
    await fetchOrders()
    setUpdating(null)
  }

  const openChat = async (req: RequestWithDp) => {
    const { data } = await supabase.from('chat_rooms').select('id').eq('request_id', req.id).maybeSingle()
    if (data) navigate(`/app/chat/${data.id}`)
  }

  const openTracking = (req: RequestWithDp) => {
    navigate(`/app/track/${req.id}`)
  }

  const tabs = [
    { key: 'active' as Tab, label: 'Active' },
    { key: 'completed' as Tab, label: 'Completed' },
    { key: 'cancelled' as Tab, label: 'Cancelled' },
  ]

  return (
    <Screen className="mx-auto max-w-lg animate-fade-in-up">
      <PageTitle eyebrow="Customer" title="My Orders" />

      <div className="mb-5 flex gap-2">
        {tabs.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className="flex-1 rounded-2xl py-3 text-sm font-extrabold transition-all active:scale-[0.98]"
            style={
              tab === t.key
                ? { background: pg.limeDim, border: `1px solid rgba(212,240,0,0.35)`, color: pg.lime }
                : { background: pg.surface, border: `1px solid ${pg.line}`, color: pg.text3 }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonList count={3} lines={4} />
      ) : orders.length === 0 ? (
        <EmptyBlock
          image={Images.emptyState}
          title={`No ${tab} orders`}
          body={tab === 'active' ? 'Your active deliveries will appear here.' : `No ${tab} orders yet.`}
        />
      ) : (
        <div className="space-y-3 pb-4">
          {orders.map((req, i) => (
            <Surface
              key={req.id}
              onClick={tab === 'active' ? () => openTracking(req) : undefined}
              className={`overflow-hidden animate-slide-up ${tab === 'active' ? 'active:scale-[0.99]' : ''}`}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="line-clamp-1 flex-1 text-[15px] font-extrabold leading-snug">
                    {req.description?.split('\n')[0]?.trim() || 'Delivery Request'}
                  </p>
                  <StatusBadge status={req.status} />
                </div>

                {tab === 'active' && !['pending', 'cancelled', 'scheduled', 'rescheduled'].includes(req.status) && (
                  <OrderTimeline status={req.status} />
                )}

                {req.status === 'pending' && (
                  <div className="my-2 flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: pg.surface2 }}>
                    <div className="h-2 w-2 animate-pulse rounded-full" style={{ background: pg.text3 }} />
                    <p className="text-xs" style={{ color: pg.text3 }}>Waiting for a partner to accept...</p>
                  </div>
                )}

                {(req.status === 'scheduled' || req.status === 'rescheduled' || req.status === 'searching_dp' || req.status === 'dp_reserved' || req.status === 'waiting_payment' || req.status === 'payment_verified' || req.status === 'booking_confirmed') && req.is_scheduled && (
                  <div className="my-2 flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <CalendarClock size={14} className="text-indigo-400" />
                    <p className="text-xs font-bold" style={{ color: '#A5B4FC' }}>
                      {req.request_category} · {req.scheduled_date} at {req.scheduled_slot || req.scheduled_time}
                    </p>
                  </div>
                )}
                {req.status === 'searching_dp' && (
                  <div className="my-2 flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: pg.limeDim, border: '1px solid rgba(212,240,0,0.2)' }}>
                    <div className="h-2 w-2 animate-pulse rounded-full" style={{ background: pg.lime }} />
                    <p className="text-xs" style={{ color: pg.text2 }}>Searching for a delivery partner...</p>
                  </div>
                )}
                {req.status === 'dp_reserved' && (
                  <div className="my-2 flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: pg.limeDim, border: '1px solid rgba(212,240,0,0.25)' }}>
                    <CheckCircle2 size={14} style={{ color: pg.lime }} />
                    <p className="text-xs font-bold" style={{ color: pg.lime }}>Delivery partner reserved! Waiting for payment confirmation.</p>
                  </div>
                )}
                {req.status === 'waiting_payment' && (
                  <div className="my-2 flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <CreditCard size={14} style={{ color: pg.warning }} />
                    <p className="text-xs font-bold" style={{ color: pg.warning }}>Please complete the advance payment in chat.</p>
                  </div>
                )}
                {req.status === 'booking_confirmed' && (
                  <div className="my-2 flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <CheckCircle2 size={14} className="text-green-400" />
                    <p className="text-xs font-bold text-green-400">Booking confirmed! See you on the scheduled date.</p>
                  </div>
                )}

                {req._dp && (
                  <div className="mb-2 flex items-center gap-2.5 rounded-2xl px-3 py-2.5" style={{ background: pg.surface2, border: `1px solid ${pg.line}` }}>
                    <Avatar url={req._dp.photo_url} name={req._dp.full_name || 'Partner'} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-extrabold">{req._dp.full_name}</p>
                      <div className="mt-0.5 flex items-center gap-1">
                        <Bike size={10} style={{ color: pg.lime }} />
                        <p className="text-[10px]" style={{ color: pg.text4 }}>Delivery Partner</p>
                      </div>
                    </div>
                    {req._dp.phone && (
                      <a
                        href={`tel:${req._dp.phone}`}
                        className="flex h-9 w-9 items-center justify-center rounded-xl"
                        style={{ background: 'rgba(34,197,94,0.14)', color: '#86EFAC' }}
                      >
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 7V5z" />
                        </svg>
                      </a>
                    )}
                  </div>
                )}

                {req.delivery_address && (
                  <div className="mb-2 flex items-center gap-1.5 text-xs" style={{ color: pg.text3 }}>
                    <MapPin size={11} className="shrink-0" />
                    <span className="line-clamp-1">{req.delivery_address}</span>
                  </div>
                )}

                <div className="flex items-center gap-3 text-xs" style={{ color: pg.text4 }}>
                  <span className="flex items-center gap-1"><Clock size={11} />{formatTime(req.created_at)}</span>
                  {req.max_budget && <Chip tone="neutral">₹{req.max_budget}</Chip>}
                </div>
              </div>

              {tab === 'active' && (
                <div className="flex flex-wrap gap-2 border-t px-4 py-3" style={{ borderColor: pg.line }} onClick={e => e.stopPropagation()}>
                  {req.accepted_dp_id && (
                    <CTA
                      variant="secondary"
                      className="min-h-0 rounded-xl px-3 py-2 text-xs"
                      onClick={() => openChat(req)}
                    >
                      <MessageCircle size={13} /> Chat
                    </CTA>
                  )}
                  {(req.status === 'delivered' || req.status === 'cash_received') && (
                    <CTA
                      className="min-h-0 flex-1 rounded-xl py-2 text-xs"
                      onClick={() => confirmDelivery(req)}
                      disabled={updating === req.id}
                    >
                      <CheckCircle2 size={13} />
                      {updating === req.id ? 'Confirming...' : 'Accept Delivery'}
                    </CTA>
                  )}
                  {['pending', 'accepted', 'confirmed', 'shopping', 'scheduled', 'rescheduled', 'searching_dp', 'dp_reserved', 'waiting_payment', 'booking_confirmed'].includes(req.status) && (
                    <CTA
                      variant="danger"
                      className="ml-auto min-h-0 rounded-xl px-3 py-2 text-xs"
                      onClick={() => setCancelTarget(req)}
                      disabled={updating === req.id}
                    >
                      {req.status === 'scheduled' || req.status === 'rescheduled' ? 'Cancel Request' : 'Cancel Order'}
                    </CTA>
                  )}
                  {(req.status === 'scheduled' || req.status === 'rescheduled') && !req.accepted_dp_id && !req.reserved_dp_id && (
                    <CTA
                      variant="secondary"
                      className="min-h-0 rounded-xl px-3 py-2 text-xs"
                      onClick={() => setRescheduleTarget(req)}
                    >
                      <CalendarPlus size={13} /> Reschedule
                    </CTA>
                  )}
                  <CTA
                    variant="secondary"
                    className="min-h-0 rounded-xl px-3 py-2 text-xs"
                    onClick={() => openTracking(req)}
                  >
                    Track <ChevronRight size={13} />
                  </CTA>
                </div>
              )}
            </Surface>
          ))}
        </div>
      )}

      {cancelTarget && (
        <CancellationModal
          open={!!cancelTarget}
          onClose={() => setCancelTarget(null)}
          status={cancelTarget.status}
          fee={advanceSettings?.cancellation_fee_after_accept ?? 0}
          freeBeforeAccept={true}
          adminOverride={advanceSettings?.admin_override_cancellation ?? true}
          cutoffMinutes={advanceSettings?.cancellation_cutoff_minutes ?? 120}
          onConfirm={async (reason) => {
            setUpdating(cancelTarget.id)
            const hasFee = !!cancelTarget.accepted_dp_id
            await supabase.from('requests').update({
              status: 'cancelled',
              cancellation_reason: reason,
              cancelled_by: 'customer',
              cancellation_fee: hasFee ? (advanceSettings?.cancellation_fee_after_accept ?? 0) : 0,
            }).eq('id', cancelTarget.id)
            await fetchOrders()
            setUpdating(null)
            setCancelTarget(null)
          }}
        />
      )}

      {rescheduleTarget && advanceSettings && (
        <RescheduleModal
          open={!!rescheduleTarget}
          onClose={() => setRescheduleTarget(null)}
          request={rescheduleTarget}
          settings={advanceSettings}
          actorType="customer"
          timeSlots={generateTimeSlots(advanceSettings.business_hours_start, advanceSettings.business_hours_end, advanceSettings.slot_duration_minutes)}
          onConfirm={async (newDate, newSlot, newDescription, newShopName, rescheduleReason) => {
            setUpdating(rescheduleTarget.id)
            const oldHistory = rescheduleTarget.reschedule_history || []
            const newHistory = [...oldHistory, {
              actor: 'customer',
              old_date: rescheduleTarget.scheduled_date,
              old_slot: rescheduleTarget.scheduled_slot,
              new_date: newDate.toISOString().slice(0, 10),
              new_slot: newSlot,
              old_description: rescheduleTarget.description,
              new_description: newDescription,
              old_shop: rescheduleTarget.shop_name,
              new_shop: newShopName,
              reason: rescheduleReason,
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
              actor_id: profile!.id,
              actor_type: 'customer',
              old_date: rescheduleTarget.scheduled_date,
              old_slot: rescheduleTarget.scheduled_slot,
              new_date: newDate.toISOString().slice(0, 10),
              new_slot: newSlot,
              old_description: rescheduleTarget.description,
              new_description: newDescription,
              old_shop_name: rescheduleTarget.shop_name,
              new_shop_name: newShopName,
              reason: rescheduleReason,
            })
            await fetchOrders()
            setUpdating(null)
            setRescheduleTarget(null)
          }}
        />
      )}
    </Screen>
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
