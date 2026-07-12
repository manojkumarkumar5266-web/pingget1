import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase, Message, ChatRoom, Order, Profile, DeliveryPartner } from '../../lib/supabase'
import { Avatar, StatusBadge, ErrorBanner } from '../../components/ui'
import { formatCurrency, timeOfDay, STATUS_LABELS } from '../../lib/utils'
import { ArrowLeft, Send, MapPin, FileText, Check, CheckCheck, Star, IndianRupee, Camera, Mic, MicOff, X, Play, Pause, Paperclip, PackageCheck, Clock, CircleCheck as CheckCircle, ShoppingBag, Store, Wallet, CircleAlert as AlertCircle } from 'lucide-react'

const ORDER_FLOW = ['confirmed', 'shopping', 'purchased', 'on_the_way', 'arrived', 'delivered', 'completed']
const DP_ACTION_STATUSES = ['confirmed', 'shopping', 'purchased', 'on_the_way', 'arrived']

const DP_STATUS_NOTIFICATIONS: Record<string, { title: string; body: string }> = {
  shopping: { title: 'Shopping Started', body: 'Your delivery partner is now shopping for your items.' },
  purchased: { title: 'Items Purchased', body: 'Items have been purchased and delivery is on the way soon.' },
  on_the_way: { title: 'On The Way!', body: 'Your delivery partner is heading to your location.' },
  arrived: { title: 'Partner Arrived', body: 'Your delivery partner has arrived at your location. Please be ready.' },
  delivered: { title: 'Order Delivered', body: 'Your order has been delivered. Please confirm receipt in the app.' },
}

export default function ChatScreen() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [room, setRoom] = useState<ChatRoom | null>(null)
  const [otherUser, setOtherUser] = useState<Profile | null>(null)
  const [dpInfo, setDpInfo] = useState<DeliveryPartner | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showQuotation, setShowQuotation] = useState(false)
  const [requestDescription, setRequestDescription] = useState('')
  const [showRating, setShowRating] = useState(false)
  const [hasRated, setHasRated] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [recording, setRecording] = useState(false)
  const [voiceDuration, setVoiceDuration] = useState(0)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isUser = profile?.role === 'user'

  const uploadToStorage = async (file: File | Blob, path: string): Promise<string | null> => {
    const { error } = await supabase.storage.from('media').upload(path, file, { upsert: true })
    if (error) return null
    return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
  }

  const sendImage = async (file: File) => {
    const path = `chat/${roomId}/${Date.now()}-${file.name}`
    const url = await uploadToStorage(file, path)
    if (url) await sendMessage(url, 'image', { attachment_url: url })
  }

  const startVoiceRecord = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone not supported on this device or browser.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/ogg') ? 'audio/ogg' : 'audio/mp4'
      const mr = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mr
      audioChunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        stream.getTracks().forEach(t => t.stop())
        const path = `chat/${roomId}/${Date.now()}-voice.webm`
        const url = await uploadToStorage(blob, path)
        if (url) await sendMessage('Voice note', 'voice', { attachment_url: url })
      }
      mr.start()
      setRecording(true)
      setVoiceDuration(0)
      durationTimerRef.current = setInterval(() => setVoiceDuration(d => d + 1), 1000)
      setShowAttachMenu(false)
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Microphone permission denied. Please allow access and try again.')
      } else {
        setError('Could not start recording.')
      }
    }
  }

  const stopVoiceRecord = () => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
    if (durationTimerRef.current) { clearInterval(durationTimerRef.current); durationTimerRef.current = null }
  }

  const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  useEffect(() => {
    if (!roomId) return
    const init = async () => {
      const { data: roomData, error: roomError } = await supabase
        .from('chat_rooms').select('*').eq('id', roomId).maybeSingle()
      if (roomError || !roomData) { setError('Chat not found'); setLoading(false); return }
      setRoom(roomData as ChatRoom)

      const otherUserId = isUser ? roomData.dp_id : roomData.user_id
      const { data: otherProfile } = await supabase
        .from('profiles').select('*').eq('id', otherUserId).maybeSingle()
      setOtherUser(otherProfile as Profile)

      if (isUser) {
        const { data: dp } = await supabase
          .from('delivery_partners').select('*').eq('user_id', otherUserId).maybeSingle()
        setDpInfo(dp as DeliveryPartner)
      }

      const { data: msgs } = await supabase
        .from('messages').select('*').eq('chat_room_id', roomId).order('created_at', { ascending: true })
      setMessages((msgs as Message[]) || [])

      if (otherUserId) {
        supabase.from('messages')
          .update({ read_at: new Date().toISOString(), is_read: true })
          .eq('chat_room_id', roomId).eq('sender_id', otherUserId).is('read_at', null)
          .then(() => {})
      }

      const { data: reqData } = await supabase
        .from('requests').select('description').eq('id', roomData.request_id).maybeSingle()
      setRequestDescription((reqData as any)?.description || '')

      const { data: orderData } = await supabase
        .from('orders').select('*').eq('request_id', roomData.request_id).maybeSingle()
      setOrder(orderData as Order | null)

      if (orderData?.status === 'completed') {
        const { data: existingRating } = await supabase
          .from('ratings').select('id')
          .eq('order_id', orderData.id).eq('rater_id', profile!.id).maybeSingle()
        setHasRated(!!existingRating)
      }
      setLoading(false)
    }
    init()
  }, [roomId, isUser, profile])

  useEffect(() => {
    const onFocus = () => {
      if (!roomId) return
      supabase.from('messages').select('*').eq('chat_room_id', roomId)
        .order('created_at', { ascending: true })
        .then(({ data }) => { if (data) setMessages(data as Message[]) })
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', () => { if (!document.hidden) onFocus() })
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [roomId])

  useEffect(() => {
    if (!roomId) return
    const channelName = `chat-${roomId}-${Date.now()}`
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_room_id=eq.${roomId}` },
        (payload) => {
          const newMsg = payload.new as Message
          setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg])
          if (newMsg.sender_id !== profile?.id) {
            supabase.from('messages')
              .update({ read_at: new Date().toISOString(), is_read: true })
              .eq('id', newMsg.id).then(() => {})
          }
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_room_id=eq.${roomId}` },
        (payload) => {
          setMessages(prev => prev.map(m =>
            m.id === (payload.new as Message).id
              ? { ...m, is_read: (payload.new as any).is_read, read_at: (payload.new as any).read_at }
              : m
          ))
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => { setOrder(payload.new as Order) })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          supabase.from('messages').select('*').eq('chat_room_id', roomId)
            .order('created_at', { ascending: true })
            .then(({ data }) => { if (data) setMessages(data as Message[]) })
        }
      })
    return () => { supabase.removeChannel(channel) }
  }, [roomId])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendMessage = async (content: string, type: string = 'text', extra?: any) => {
    if (!content.trim() && type === 'text') return
    const { data, error } = await supabase.from('messages').insert({
      chat_room_id: roomId, sender_id: profile!.id,
      content: type === 'text' ? content : null,
      message_type: type, ...extra,
    }).select().single()
    if (!error && data) setMessages(prev => [...prev, data as Message])
    setInput('')
  }

  const sendQuotation = async (itemCost: number, deliveryCharge: number, itemsSummary: string) => {
    const quotation = { item_cost: itemCost, delivery_charge: deliveryCharge, items_summary: itemsSummary }
    const { data, error } = await supabase.from('messages').insert({
      chat_room_id: roomId, sender_id: profile!.id,
      message_type: 'quotation', quotation_data: quotation,
    }).select().single()
    if (!error && data) setMessages(prev => [...prev, data as Message])
    setShowQuotation(false)
  }

  const acceptQuotation = async (msg: Message) => {
    if (!msg.quotation_data || !room) return
    const q = msg.quotation_data
    const commissionPct = 10
    const commissionAmount = Math.round(q.delivery_charge * commissionPct / 100)
    const dpEarnings = q.delivery_charge - commissionAmount
    const { data: orderData, error } = await supabase.from('orders').insert({
      request_id: room.request_id, user_id: room.user_id, dp_id: room.dp_id,
      items_summary: q.items_summary, item_cost: q.item_cost,
      delivery_charge: q.delivery_charge, commission_pct: commissionPct,
      commission_amount: commissionAmount, dp_earnings: dpEarnings, status: 'confirmed',
    }).select().single()
    if (!error && orderData) {
      setOrder(orderData as Order)
      await supabase.from('requests').update({ status: 'confirmed' }).eq('id', room.request_id)
      await supabase.from('notifications').insert({
        user_id: room.dp_id, title: 'Order Confirmed!',
        body: 'The user accepted your quotation. Start shopping now.',
        type: 'order_confirmed', related_id: room.request_id,
      })
    }
  }

  const rejectQuotation = async () => {
    if (!room) return
    await supabase.from('requests').update({ status: 'cancelled' }).eq('id', room.request_id)
    await supabase.from('notifications').insert({
      user_id: room.dp_id, title: 'Quotation Rejected',
      body: 'The customer rejected your quotation. The order has been cancelled.',
      type: 'order_cancelled', related_id: room.request_id,
    })
    navigate(isUser ? '/app/orders' : '/dp/orders')
  }

  const updateOrderStatus = async (newStatus: string) => {
    if (!order) return
    const updates: any = { status: newStatus }
    if (newStatus === 'completed') updates.completed_at = new Date().toISOString()
    const { data, error } = await supabase.from('orders').update(updates).eq('id', order.id).select().single()
    if (!error && data) {
      setOrder(data as Order)
      await supabase.from('requests').update({ status: newStatus }).eq('id', room!.request_id)
      const notifyUserId = isUser ? room!.dp_id : room!.user_id
      if (isUser && newStatus === 'completed') {
        await supabase.from('notifications').insert({
          user_id: notifyUserId, title: 'Delivery Confirmed',
          body: 'Customer confirmed receipt. The order is now complete.',
          type: 'order_completed', related_id: room!.request_id,
        })
        setShowRating(true)
      } else if (!isUser && DP_STATUS_NOTIFICATIONS[newStatus]) {
        const notif = DP_STATUS_NOTIFICATIONS[newStatus]
        await supabase.from('notifications').insert({
          user_id: notifyUserId, title: notif.title, body: notif.body,
          type: 'order_status', related_id: room!.request_id,
        })
      }
    }
  }

  const submitRating = async (stars: number, review: string) => {
    if (!order) return
    const otherUserId = isUser ? room!.dp_id : room!.user_id
    const { error } = await supabase.from('ratings').insert({
      order_id: order.id, rater_id: profile!.id, rated_id: otherUserId,
      stars, review: review || null,
    })
    if (!error) { setHasRated(true); setShowRating(false) }
  }

  if (loading) return <div className="flex h-screen items-center justify-center text-sm text-gray-400">Loading chat...</div>
  if (error) return <div className="p-4"><ErrorBanner message={error} /></div>

  const effectiveStatus = order?.status === 'cash_received' ? 'delivered' : order?.status
  const currentStatusIdx = effectiveStatus ? ORDER_FLOW.indexOf(effectiveStatus) : -1
  const isDpTurn = !isUser && order != null && DP_ACTION_STATUSES.includes(order.status)
  const nextDpStatus = isDpTurn ? ORDER_FLOW[ORDER_FLOW.indexOf(order!.status) + 1] : null
  const isUserDeliveryConfirm = isUser && (order?.status === 'delivered' || order?.status === 'cash_received')
  const chatLocked = order?.status === 'completed' || order?.status === 'delivered' || order?.status === 'cash_received'

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-950">
      <header className="flex items-center gap-3 border-b border-gray-100 bg-white/80 px-4 py-3 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/80">
        <button onClick={() => navigate(isUser ? '/app/orders' : '/dp/orders')} className="btn-ghost p-2">
          <ArrowLeft size={20} />
        </button>
        <Avatar url={otherUser?.photo_url} name={otherUser?.full_name || 'User'} size={40} />
        <div className="flex-1">
          <p className="font-semibold text-gray-900 dark:text-white">{otherUser?.full_name}</p>
          {dpInfo && (
            <p className="text-xs text-gray-400">
              {dpInfo.vehicle_type} • {dpInfo.rating_avg > 0 ? `${dpInfo.rating_avg.toFixed(1)}★` : 'New'} • {dpInfo.is_online ? 'Online' : 'Offline'}
            </p>
          )}
        </div>
        {order && <StatusBadge status={order.status} />}
      </header>

      {order && (
        <div className="border-b border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            {ORDER_FLOW.map((s, i) => (
              <div key={s} className="flex flex-1 flex-col items-center">
                <div className={`h-2.5 w-2.5 rounded-full transition-all ${i <= currentStatusIdx ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                <span className={`mt-1 text-[10px] font-medium ${i <= currentStatusIdx ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`}>
                  {STATUS_LABELS[s]?.split(' ')[0]}
                </span>
              </div>
            ))}
          </div>
          {order.delivery_charge > 0 && (
            <div className="mt-2 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
              <span className="text-xs text-gray-500">Delivery Charge</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(order.delivery_charge)}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-md space-y-2">
          {!order && isUser && (
            <div className="mb-4 rounded-xl bg-accent-50 p-3 text-center text-sm text-accent-700 dark:bg-accent-950/40 dark:text-accent-300">
              Discuss items and delivery charge with your delivery partner. They will send a quotation for you to accept or reject.
            </div>
          )}
          {!order && !isUser && (
            <div className="mb-4">
              <button onClick={() => setShowQuotation(true)} className="btn-accent w-full">
                <FileText size={18} /> Send Quotation
              </button>
            </div>
          )}
          {messages.map(msg => {
            const isOwn = msg.sender_id === profile!.id
            return (
              <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} animate-slide-up`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isOwn ? 'bg-primary-600 text-white' : 'bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100'}`}>
                  {msg.message_type === 'text' && <p className="text-sm">{msg.content}</p>}
                  {msg.message_type === 'image' && msg.attachment_url && (
                    <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer">
                      <img src={msg.attachment_url} alt="Shared image" className="max-w-[200px] rounded-xl object-cover" />
                    </a>
                  )}
                  {msg.message_type === 'voice' && msg.attachment_url && (
                    <VoiceMessagePlayer url={msg.attachment_url} isOwn={isOwn} />
                  )}
                  {msg.message_type === 'location' && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2"><MapPin size={14} /><p className="text-sm font-medium">Delivery Location</p></div>
                      {msg.content && <p className="text-xs opacity-80 leading-snug">{msg.content}</p>}
                      {msg.location_lat && msg.location_lng && (
                        <a href={`https://maps.google.com/?q=${msg.location_lat},${msg.location_lng}`} target="_blank" rel="noopener noreferrer" className="inline-block text-xs underline opacity-90 mt-0.5">
                          Open in Google Maps
                        </a>
                      )}
                    </div>
                  )}
                  {msg.message_type === 'quotation' && msg.quotation_data && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Quotation</p>
                      <ul className="space-y-0.5">
                        {String(msg.quotation_data.items_summary || '').split('\n').map((line: string, i: number) =>
                          line.trim() ? (
                            <li key={i} className="flex items-start gap-1.5 text-sm">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/60" />
                              {line.trim()}
                            </li>
                          ) : null
                        )}
                      </ul>
                      <div className="space-y-1 border-t border-white/20 pt-2 text-xs">
                        <div className="flex justify-between"><span>Item Cost</span><span>{formatCurrency(msg.quotation_data.item_cost)}</span></div>
                        <div className="flex justify-between font-bold"><span>Delivery Charge</span><span>{formatCurrency(msg.quotation_data.delivery_charge)}</span></div>
                      </div>
                      {!order && isUser && (
                        <div className="flex gap-2">
                          <button onClick={rejectQuotation} className="flex-1 rounded-lg bg-black/20 py-2 text-xs font-bold text-white">
                            Reject
                          </button>
                          <button onClick={() => acceptQuotation(msg)} className="flex-1 rounded-lg bg-white py-2 text-xs font-bold text-primary-600">
                            Accept
                          </button>
                        </div>
                      )}
                      {order && <p className="text-xs font-semibold text-green-300">Accepted</p>}
                    </div>
                  )}
                  {msg.message_type === 'order_summary' && msg.quotation_data && (
                    <OrderSummaryMessage data={msg.quotation_data} isOwn={isOwn} />
                  )}
                  <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${isOwn ? 'text-primary-200' : 'text-gray-400'}`}>
                    {timeOfDay(msg.created_at)}
                    {isOwn && (msg.is_read ? <CheckCheck size={12} /> : <Check size={12} />)}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {isDpTurn && nextDpStatus && (
        <div className="border-t border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
          <button onClick={() => updateOrderStatus(nextDpStatus)} className="btn-primary w-full">
            Mark as {STATUS_LABELS[nextDpStatus]}
          </button>
        </div>
      )}

      {!isUser && (order?.status === 'delivered' || order?.status === 'cash_received') && (
        <div className="border-t border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-center gap-2 rounded-xl bg-warning-50 px-4 py-3 dark:bg-warning-950/30">
            <Clock size={16} className="shrink-0 text-warning-600 dark:text-warning-400" />
            <p className="text-sm font-medium text-warning-700 dark:text-warning-300">Waiting for customer to confirm delivery...</p>
          </div>
        </div>
      )}

      {isUser && order && DP_ACTION_STATUSES.includes(order.status) && (
        <div className="border-t border-gray-100 bg-white px-4 py-2 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-center text-xs text-gray-400">Tracking your order in real-time...</p>
        </div>
      )}

      {isUserDeliveryConfirm && (
        <div className="border-t border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
          <div className="rounded-xl bg-success-50 p-4 dark:bg-success-950/30">
            <div className="mb-3 flex items-center justify-center gap-2">
              <PackageCheck size={20} className="text-success-600 dark:text-success-400" />
              <p className="text-sm font-semibold text-success-700 dark:text-success-300">Your order has been delivered!</p>
            </div>
            <button onClick={() => updateOrderStatus('completed')} className="w-full rounded-xl bg-success-600 py-3 text-sm font-bold text-white transition-all active:scale-[0.98] hover:bg-success-700">
              Confirm &amp; Accept Delivery
            </button>
          </div>
        </div>
      )}

      {order?.status === 'completed' && isUser && !hasRated && (
        <div className="border-t border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
          <button onClick={() => setShowRating(true)} className="btn-accent w-full"><Star size={18} /> Rate Delivery Partner</button>
        </div>
      )}
      {order?.status === 'completed' && hasRated && (
        <div className="border-t border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-center text-xs text-success-600 dark:text-success-400">Order completed and rated</p>
        </div>
      )}

      {chatLocked ? (
        <div className="border-t border-gray-100 bg-white px-4 py-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-center gap-2 rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-800">
            <CheckCircle size={16} className="text-gray-400 shrink-0" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {order?.status === 'completed' ? 'This conversation has ended.' : 'Waiting for delivery confirmation — chat is locked.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="border-t border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
          <input ref={imageInputRef} type="file" className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) sendImage(f); e.target.value = '' }} />
          {showAttachMenu && (
            <div className="mb-2 flex gap-2">
              <button onClick={() => { imageInputRef.current?.click(); setShowAttachMenu(false) }} className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                <Camera size={14} /> Image
              </button>
              {recording ? (
                <button onClick={stopVoiceRecord} className="flex items-center gap-1.5 rounded-xl bg-error-500 px-3 py-2 text-xs font-medium text-white">
                  <MicOff size={14} /> Stop ({fmtDur(voiceDuration)})
                </button>
              ) : (
                <button onClick={startVoiceRecord} className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  <Mic size={14} /> Voice Note
                </button>
              )}
              <button onClick={() => setShowAttachMenu(false)} className="ml-auto text-gray-400"><X size={16} /></button>
            </div>
          )}
          <div className="mx-auto flex max-w-md items-center gap-2">
            <button type="button" onClick={() => setShowAttachMenu(!showAttachMenu)}
              className={`shrink-0 rounded-xl p-2.5 transition-colors ${showAttachMenu ? 'text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}
              style={showAttachMenu ? { backgroundColor: '#556d34' } : {}}>
              <Paperclip size={18} />
            </button>
            {recording ? (
              <div className="flex flex-1 items-center gap-2 rounded-xl bg-error-50 px-3 py-2.5 dark:bg-error-950/30">
                <div className="h-2 w-2 animate-pulse rounded-full bg-error-500" />
                <span className="flex-1 text-sm font-medium text-error-700 dark:text-error-300">Recording {fmtDur(voiceDuration)}</span>
                <button onClick={stopVoiceRecord} className="text-xs font-bold text-error-700 dark:text-error-300">Send</button>
              </div>
            ) : (
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
                placeholder="Type a message..."
                className="input flex-1"
              />
            )}
            {!recording && (
              <button onClick={() => sendMessage(input)} className="btn-primary shrink-0 p-3">
                <Send size={18} />
              </button>
            )}
          </div>
        </div>
      )}

      {showQuotation && <QuotationModal onClose={() => setShowQuotation(false)} onSend={sendQuotation} initialItems={requestDescription} />}
      {showRating && <RatingModal onClose={() => setShowRating(false)} onSubmit={submitRating} targetName={otherUser?.full_name || 'Delivery Partner'} />}
    </div>
  )
}

function OrderSummaryMessage({ data, isOwn }: { data: any; isOwn: boolean }) {
  const textColor = isOwn ? 'text-white' : 'text-gray-900 dark:text-gray-100'
  const mutedColor = isOwn ? 'text-primary-100' : 'text-gray-500 dark:text-gray-400'
  const borderColor = isOwn ? 'border-primary-400/40' : 'border-gray-200 dark:border-gray-700'
  const tagBg = isOwn ? 'bg-primary-500/40' : 'bg-gray-100 dark:bg-gray-700'
  return (
    <div className="space-y-2.5 min-w-[200px]">
      <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${mutedColor}`}><ShoppingBag size={11} /> Order Request</div>
      <p className={`text-sm font-semibold leading-snug ${textColor}`}>{data.title}</p>
      {data.description && (
        <ul className="space-y-0.5">
          {String(data.description).split('\n').map((line: string, i: number) => line.trim() ? (
            <li key={i} className={`flex items-start gap-1.5 text-xs ${mutedColor}`}>
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />
              {line.trim()}
            </li>
          ) : null)}
        </ul>
      )}
      {data.photo_url && (
        <a href={data.photo_url} target="_blank" rel="noopener noreferrer">
          <img src={data.photo_url} alt="Order" className="w-full max-w-[200px] rounded-xl object-cover" />
        </a>
      )}
      {data.voice_note_url && <VoiceMessagePlayer url={data.voice_note_url} isOwn={isOwn} />}
      <div className={`space-y-1.5 border-t pt-2 ${borderColor}`}>
        {data.preferred_shop && <div className={`flex items-center gap-1.5 text-xs ${mutedColor}`}><Store size={12} className="shrink-0" /><span>Shop: <span className={`font-medium ${textColor}`}>{data.preferred_shop}</span></span></div>}
        {data.max_budget && <div className={`flex items-center gap-1.5 text-xs ${mutedColor}`}><Wallet size={12} className="shrink-0" /><span>Budget: <span className={`font-medium ${textColor}`}>{formatCurrency(data.max_budget)}</span></span></div>}
        {data.delivery_address && <div className={`flex items-start gap-1.5 text-xs ${mutedColor}`}><MapPin size={12} className="mt-0.5 shrink-0" /><span className="line-clamp-2">{data.delivery_address}</span></div>}
        {data.radius_meters && <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tagBg} ${mutedColor}`}>{data.radius_meters < 1000 ? `${data.radius_meters}m` : `${data.radius_meters / 1000}km`} radius</div>}
      </div>
      {data.special_instructions && <div className={`flex items-start gap-1.5 rounded-lg border px-2.5 py-2 text-xs ${borderColor} ${mutedColor}`}><AlertCircle size={12} className="mt-0.5 shrink-0" /><span className="italic">{data.special_instructions}</span></div>}
    </div>
  )
}

function VoiceMessagePlayer({ url, isOwn }: { url: string; isOwn: boolean }) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const toggle = () => {
    try {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; setPlaying(false); return }
      const audio = new Audio()
      audio.src = url
      audioRef.current = audio
      audio.onended = () => { setPlaying(false); audioRef.current = null }
      audio.onerror = () => { setPlaying(false); audioRef.current = null }
      audio.play().then(() => setPlaying(true)).catch(() => { setPlaying(false); audioRef.current = null })
    } catch { setPlaying(false); audioRef.current = null }
  }
  return (
    <div className="flex items-center gap-2">
      <button onClick={toggle} className={`flex h-8 w-8 items-center justify-center rounded-full ${isOwn ? 'bg-white/20' : 'bg-primary-100 dark:bg-primary-900/40'}`}>
        {playing ? <Pause size={14} className={isOwn ? 'text-white' : 'text-primary-600'} /> : <Play size={14} className={isOwn ? 'text-white' : 'text-primary-600'} />}
      </button>
      <div className={`h-1 flex-1 rounded-full ${isOwn ? 'bg-white/30' : 'bg-gray-200 dark:bg-gray-700'}`}>
        <div className={`h-full w-1/3 rounded-full ${isOwn ? 'bg-white/60' : 'bg-primary-400'} ${playing ? 'animate-pulse' : ''}`} />
      </div>
      <span className={`text-[10px] ${isOwn ? 'text-primary-200' : 'text-gray-400'}`}>Voice</span>
    </div>
  )
}

function QuotationModal({ onClose, onSend, initialItems }: { onClose: () => void; onSend: (itemCost: number, deliveryCharge: number, itemsSummary: string) => void; initialItems?: string }) {
  const [items, setItems] = useState(() => initialItems || '')
  const [itemCost, setItemCost] = useState('')
  const [deliveryCharge, setDeliveryCharge] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 animate-fade-in" onClick={onClose}>
      <div className="card w-full max-w-md p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">Send Quotation</h3>
        <div className="space-y-3">
          <div>
            <label className="label">Items Summary</label>
            <p className="mb-1 text-xs text-gray-400">Items from customer request — edit as needed.</p>
            <textarea className="input min-h-24 resize-none" value={items} onChange={e => setItems(e.target.value)} placeholder={"Each item on its own line\ne.g. 2kg Rice\n1L Milk"} />
          </div>
          <div>
            <label className="label flex items-center gap-1"><IndianRupee size={14} /> Item Cost</label>
            <input type="number" className="input" value={itemCost} onChange={e => setItemCost(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="label flex items-center gap-1"><IndianRupee size={14} /> Delivery Charge</label>
            <input type="number" className="input" value={deliveryCharge} onChange={e => setDeliveryCharge(e.target.value)} placeholder="0" />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => onSend(parseFloat(itemCost) || 0, parseFloat(deliveryCharge) || 0, items)} disabled={!items || !deliveryCharge} className="btn-primary flex-1">
            Send Quotation
          </button>
        </div>
      </div>
    </div>
  )
}

function RatingModal({ onClose, onSubmit, targetName }: { onClose: () => void; onSubmit: (stars: number, review: string) => void; targetName: string }) {
  const [stars, setStars] = useState(5)
  const [review, setReview] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 animate-fade-in" onClick={onClose}>
      <div className="card w-full max-w-md p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
        <h3 className="mb-1 text-lg font-bold text-gray-900 dark:text-white">Rate {targetName}</h3>
        <p className="mb-4 text-sm text-gray-500">How was your experience?</p>
        <div className="mb-4 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map(i => (
            <button key={i} onClick={() => setStars(i)} className="transition-transform active:scale-90">
              <svg width={36} height={36} viewBox="0 0 24 24" fill={i <= stars ? '#fcb84a' : 'none'} stroke="#fcb84a">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>
          ))}
        </div>
        <textarea className="input min-h-20 resize-none" value={review} onChange={e => setReview(e.target.value)} placeholder="Leave a review (optional)" />
        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => onSubmit(stars, review)} className="btn-primary flex-1">Submit</button>
        </div>
      </div>
    </div>
  )
}
