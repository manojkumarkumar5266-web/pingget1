import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase, DeliveryRequest, Profile, DeliveryPartner } from '../../lib/supabase'
import { EmptyState, ServiceStatusBanner } from '../../components/ui'
import { formatTime, formatCurrency, formatDistance, haversineDistance } from '../../lib/utils'
import { Package, Clock, MapPin, Check, X, WifiOff, Sliders, Bell } from 'lucide-react'

type RequestWithUser = DeliveryRequest & { user_profile?: Profile }

const RANGE_OPTIONS = [500, 1000, 2000, 5000, 10000]

export default function DpHome() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [requests, setRequests] = useState<RequestWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [dp, setDp] = useState<DeliveryPartner | null>(null)
  const [dpLoading, setDpLoading] = useState(true)
  const [savingRange, setSavingRange] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const rangeInitialised = useRef(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [radiusFilter, setRadiusFilter] = useState(5000)

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    const fetchDp = async () => {
      const { data } = await supabase
        .from('delivery_partners')
        .select('*')
        .eq('user_id', profile!.id)
        .maybeSingle()
      setDp(data as DeliveryPartner)
      setDpLoading(false)
    }
    fetchDp()

    const dpChannel = supabase
      .channel('dp-self-status')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'delivery_partners', filter: `user_id=eq.${profile!.id}` },
        (payload) => setDp(payload.new as DeliveryPartner))
      .subscribe()

    return () => { supabase.removeChannel(dpChannel) }
  }, [profile])

  // Seed range from DB on first dp load
  useEffect(() => {
    if (dp && !rangeInitialised.current) {
      rangeInitialised.current = true
      setRadiusFilter(dp.service_range_meters ?? 5000)
    }
  }, [dp])

  useEffect(() => {
    if (dpLoading) return
    if (!dp?.is_online) { setLoading(false); setRequests([]); return }

    setLoading(true)

    const fetchRequests = async () => {
      const { data } = await supabase
        .from('requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      if (!data) { setLoading(false); return }

      const userIds = [...new Set(data.map(r => r.user_id))]
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', userIds)
      const profileMap = new Map<string, Profile>()
      profiles?.forEach(p => profileMap.set(p.id, p as Profile))

      setRequests((data as DeliveryRequest[]).map(r => ({ ...r, user_profile: profileMap.get(r.user_id) })))
      setLoading(false)
    }
    fetchRequests()

    const channel = supabase
      .channel('dp-requests')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requests', filter: 'status=eq.pending' },
        () => fetchRequests())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'requests' },
        (payload: any) => {
          const updated = payload.new
          // Notify if a request the DP could see was accepted by someone else
          if (updated.status === 'accepted' && updated.accepted_dp_id !== profile!.id) {
            setRequests(prev => {
              if (prev.some(r => r.id === updated.id)) {
                showToast('A nearby request was just accepted by another delivery partner')
              }
              return prev
            })
          }
          fetchRequests()
        })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [dp?.is_online, dpLoading])

  const changeRange = async (meters: number) => {
    setRadiusFilter(meters)
    setSavingRange(true)
    await supabase.from('delivery_partners').update({ service_range_meters: meters }).eq('user_id', profile!.id)
    setSavingRange(false)
  }

  const acceptRequest = async (req: RequestWithUser) => {
    const { error } = await supabase
      .from('requests')
      .update({ status: 'accepted', accepted_dp_id: profile!.id })
      .eq('id', req.id)
      .eq('status', 'pending')
    if (error) { showToast('This request was already accepted by another delivery partner'); return }

    const { data: existing } = await supabase.from('chat_rooms').select('id').eq('request_id', req.id).limit(1)
    let roomId: string | undefined = existing?.[0]?.id
    if (!roomId) {
      const { data: room, error: roomError } = await supabase
        .from('chat_rooms')
        .insert({ request_id: req.id, user_id: req.user_id, dp_id: profile!.id })
        .select().single()
      if (roomError || !room) { showToast('Failed to create chat room'); return }
      roomId = room.id
    }

    // User's order summary — shown as sent by the user so it appears on the left
    await supabase.from('messages').insert({
      chat_room_id: roomId,
      sender_id: req.user_id,
      message_type: 'order_summary',
      quotation_data: {
        title: req.title,
        description: req.description,
        preferred_shop: req.preferred_shop,
        max_budget: req.max_budget,
        special_instructions: req.special_instructions,
        photo_url: req.photo_url,
        delivery_address: req.delivery_address,
        radius_meters: req.radius_meters,
      },
    })

    // Auto-greeting from DP
    const userName = req.user_profile?.full_name ? `Hi ${req.user_profile.full_name}! ` : 'Hello! '
    await supabase.from('messages').insert({
      chat_room_id: roomId,
      sender_id: profile!.id,
      content: `${userName}I'm ${profile!.full_name} and I've accepted your delivery request. I can see your order details above — let me know if anything needs clarification and we'll get started!`,
      message_type: 'text',
    })

    // Share user's delivery GPS location in chat
    if (req.delivery_lat && req.delivery_lng) {
      await supabase.from('messages').insert({
        chat_room_id: roomId,
        sender_id: profile!.id,
        content: req.delivery_address || 'Delivery location',
        message_type: 'location',
        location_lat: req.delivery_lat,
        location_lng: req.delivery_lng,
      })
    }

    await supabase.from('notifications').insert({
      user_id: req.user_id,
      title: 'Request Accepted!',
      body: `${profile!.full_name} accepted your request. Tap to open chat now.`,
      type: 'request_accepted',
      related_id: req.id,
    })

    navigate(`/dp/chat/${roomId}`)
  }

  const getDistance = (req: DeliveryRequest): number => {
    if (!profile?.gps_lat || !profile?.gps_lng || !req.delivery_lat || !req.delivery_lng) return 0
    return haversineDistance(profile.gps_lat, profile.gps_lng, req.delivery_lat, req.delivery_lng)
  }

  // Show request if DP's service range is >= the user's requested radius.
  // A 1km DP won't see 5km requests; a 5km DP sees 1km and 5km requests.
  const filtered = requests.filter(r => radiusFilter >= r.radius_meters)

  if (dpLoading) {
    return <div className="p-4 space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-32 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />)}</div>
  }

  if (!dp?.is_online) {
    return (
      <div className="mx-auto max-w-md px-4 py-4">
        <ServiceStatusBanner cityName={profile?.city} />
        <div className="mt-16 flex flex-col items-center justify-center gap-4 text-center px-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
            <WifiOff size={36} className="text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">You are Offline</h2>
          <p className="max-w-xs text-sm text-gray-500 dark:text-gray-400">
            Tap the <span className="font-semibold text-gray-700 dark:text-gray-300">Offline</span> button at the top to go online and start receiving delivery requests.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-4">
      <ServiceStatusBanner cityName={profile?.city} />

      {/* Toast notification */}
      {toast && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-accent-50 px-3 py-2 text-xs font-medium text-accent-800 dark:bg-accent-900/40 dark:text-accent-200 animate-slide-up">
          <Bell size={14} className="shrink-0" />
          {toast}
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Nearby Requests</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Requests within your service range</p>
        </div>
        {savingRange && <span className="text-xs text-gray-400 animate-pulse">Saving…</span>}
      </div>

      {/* Range selector — saved to DB */}
      <div className="mb-4">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
          <Sliders size={13} /> My service range
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {RANGE_OPTIONS.map(r => (
            <button
              key={r}
              onClick={() => changeRange(r)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${radiusFilter === r ? 'bg-primary-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}
            >
              {r < 1000 ? `${r}m` : `${r / 1000}km`}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-400">
          Only requests where users set a radius ≤ <span className="font-semibold text-gray-600 dark:text-gray-300">{radiusFilter < 1000 ? `${radiusFilter}m` : `${radiusFilter / 1000}km`}</span> are shown.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-32 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Package size={48} />}
          title="No requests in your range"
          description={`No pending requests with radius ≤ ${radiusFilter < 1000 ? `${radiusFilter}m` : `${radiusFilter / 1000}km`}. Increase your range to see more.`}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(req => {
            const dist = getDistance(req)
            return (
              <div key={req.id} className="card p-4 animate-slide-up">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white">{req.title}</p>
                    {req.description && <p className="mt-0.5 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{req.description}</p>}
                  </div>
                  {req.max_budget && (
                    <span className="ml-2 shrink-0 rounded-lg bg-primary-50 px-2 py-1 text-xs font-bold text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                      {formatCurrency(req.max_budget)}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                  {dist > 0 && <span className="flex items-center gap-1"><MapPin size={14} /> {formatDistance(dist)} away</span>}
                  <span className="flex items-center gap-1"><Clock size={14} /> {formatTime(req.created_at)}</span>
                  {req.preferred_shop && <span className="flex items-center gap-1"><Package size={14} /> {req.preferred_shop}</span>}
                  <span className="flex items-center gap-1 font-medium text-primary-500">
                    User radius: {req.radius_meters < 1000 ? `${req.radius_meters}m` : `${req.radius_meters / 1000}km`}
                  </span>
                </div>

                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-medium">Deliver to:</span> {req.delivery_address}
                </p>

                <div className="mt-3 flex gap-2">
                  <button onClick={() => acceptRequest(req)} className="btn-primary flex-1">
                    <Check size={18} /> Accept
                  </button>
                  <button className="btn-secondary px-4"><X size={18} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
