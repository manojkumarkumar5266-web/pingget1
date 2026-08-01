import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase, Message, ChatRoom, Order, Profile, DeliveryPartner } from '../../lib/supabase'
import { Avatar, StatusBadge, ErrorBanner, FullScreenLoader } from '../../components/ui'
import { formatCurrency, timeOfDay, STATUS_LABELS } from '../../lib/utils'
import { ArrowLeft, Send, MapPin, FileText, Check, CheckCheck, Star, IndianRupee, Camera, Mic, MicOff, X, Play, Pause, Paperclip, PackageCheck, Clock, CheckCircle, Wallet, AlertCircle, Navigation, ClipboardList } from 'lucide-react'

const ORDER_FLOW = ['confirmed', 'shopping', 'purchased', 'on_the_way', 'arrived', 'delivered', 'completed']

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
  const [fullOrderData, setFullOrderData] = useState<any>(null)
  const [greetingSent, setGreetingSent] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [sendingLocation, setSendingLocation] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [showPickupPhoto, setShowPickupPhoto] = useState(false)
  const [recording, setRecording] = useState(false)
  const [voiceDuration, setVoiceDuration] = useState(0)
  const [otherTyping, setOtherTyping] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const typingChannelRef = useRef<any>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTypingRef = useRef(false)
  const isUser = profile?.role === 'user'

  const uploadToStorage = async (file: File | Blob, path: string): Promise<string | null> => {
    const { error } = await supabase.storage.from('media').upload(path, file, { upsert: true })
    if (error) return null
    return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
  }

  const sendImage = async (file: File) => {
    const path = `chat/${roomId}/${Date.now()}-${file.name}`
    const url = await uploadToStorage(file, path)
    if (url) await sendMessage('Image', 'image', { attachment_url: url })
  }

  const sendLocation = async () => {
    if (!navigator.geolocation) { setError('Location not supported'); return }
    setSendingLocation(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        await sendMessage('My current location', 'location', { location_lat: lat, location_lng: lng })
        setSendingLocation(false)
      },
      () => { setError('Could not get location'); setSendingLocation(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const startVoiceRecord = async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setError('Microphone not supported.'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/ogg') ? 'audio/ogg' : 'audio/mp4'
      const mr = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mr; audioChunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        stream.getTracks().forEach(t => t.stop())
        const path = `chat/${roomId}/${Date.now()}-voice.webm`
        const url = await uploadToStorage(blob, path)
        if (url) await sendMessage('Voice note', 'voice', { attachment_url: url })
      }
      mr.start(); setRecording(true); setVoiceDuration(0)
      durationTimerRef.current = setInterval(() => setVoiceDuration(d => d + 1), 1000)
      setShowAttachMenu(false)
    } catch (err: any) {
      setError(err.name === 'NotAllowedError' ? 'Microphone permission denied.' : 'Could not start recording.')
    }
  }

  const stopVoiceRecord = () => {
    mediaRecorderRef.current?.stop(); setRecording(false)
    if (durationTimerRef.current) { clearInterval(durationTimerRef.current); durationTimerRef.current = null }
  }

  const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  useEffect(() => {
    if (!roomId) return
    const init = async () => {
      const { data: roomData, error: roomError } = await supabase.from('chat_rooms').select('*').eq('id', roomId).maybeSingle()
      if (roomError || !roomData) { setError('Chat not found'); setLoading(false); return }
      setRoom(roomData as ChatRoom)
      const otherUserId = isUser ? roomData.dp_id : roomData.user_id
      const { data: otherProfile } = await supabase.from('profiles').select('id, full_name, photo_url, role, city, address, pincode').eq('id', otherUserId).maybeSingle()
      setOtherUser(otherProfile as unknown as Profile)
      if (isUser) {
        const { data: dp } = await supabase.from('delivery_partners').select('*').eq('user_id', otherUserId).maybeSingle()
        setDpInfo(dp as DeliveryPartner)
      }
      const { data: msgs } = await supabase.from('messages').select('*').eq('chat_room_id', roomId).order('created_at', { ascending: true })
      setMessages((msgs as Message[]) || [])
      if (otherUserId) {
        supabase.from('messages').update({ read_at: new Date().toISOString(), is_read: true })
          .eq('chat_room_id', roomId).eq('sender_id', otherUserId).is('read_at', null).then(() => {})
      }
      const { data: reqData } = await supabase.from('requests').select('*').eq('id', roomData.request_id).maybeSingle()
      setRequestDescription((reqData as any)?.description || '')
      setFullOrderData(reqData as any)
      const { data: orderData } = await supabase.from('orders').select('*').eq('request_id', roomData.request_id).maybeSingle()
      setOrder(orderData as Order | null)
      if (orderData?.status === 'completed') {
        const { data: existingRating } = await supabase.from('ratings').select('id').eq('order_id', orderData.id).eq('rater_id', profile!.id).maybeSingle()
        setHasRated(!!existingRating)
      }
      setLoading(false)
    }
    init()
  }, [roomId, isUser, profile])

  // Send greeting message when chat first opens
  useEffect(() => {
    if (!room || !profile || greetingSent || messages.length > 0) return
    setGreetingSent(true)
    const otherName = otherUser?.full_name?.split(' ')[0] || 'there'
    const myName = profile.full_name?.split(' ')[0] || 'there'
    if (isUser) {
      sendMessage(`Hi ${otherName}. Thank you for accepting my request.`)
    } else {
      sendMessage(`Hi ${otherName}, I'm ${myName}. I'll be delivering your order today.`)
    }
  }, [room, profile, greetingSent, messages.length, isUser, otherUser])

  useEffect(() => {
    if (!roomId) return
    const onFocus = () => {
      supabase.from('messages').select('*').eq('chat_room_id', roomId).order('created_at', { ascending: true })
        .then(({ data }) => {
          if (data) {
            setMessages(data as Message[])
            const otherUserId = isUser ? room?.dp_id : room?.user_id
            if (otherUserId) {
              supabase.from('messages').update({ read_at: new Date().toISOString(), is_read: true })
                .eq('chat_room_id', roomId).eq('sender_id', otherUserId).is('read_at', null).then(() => {})
            }
          }
        })
    }
    onFocus()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', () => { if (!document.hidden) onFocus() })
    const pollInterval = setInterval(onFocus, 5000)
    return () => { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); clearInterval(pollInterval) }
  }, [roomId, isUser, room])

  useEffect(() => {
    if (!roomId || !profile?.id) return
    const channel = supabase.channel(`chat-room-${roomId}-${profile.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_room_id=eq.${roomId}` },
        (payload) => {
          const newMsg = payload.new as Message
          setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg])
          if (newMsg.sender_id !== profile?.id) {
            supabase.from('messages').update({ read_at: new Date().toISOString(), is_read: true }).eq('id', newMsg.id).then(() => {})
          }
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_room_id=eq.${roomId}` },
        (payload) => { setMessages(prev => prev.map(m => m.id === (payload.new as Message).id ? { ...m, is_read: (payload.new as any).is_read, read_at: (payload.new as any).read_at } : m)) })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `dp_id=eq.${profile?.id}` }, (payload) => { setOrder(payload.new as Order) })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `dp_id=eq.${profile?.id}` }, (payload) => { setOrder(payload.new as Order) })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          supabase.from('messages').select('*').eq('chat_room_id', roomId).order('created_at', { ascending: true })
            .then(({ data }) => { if (data) setMessages(data as Message[]) })
        }
      })
    return () => { supabase.removeChannel(channel) }
  }, [roomId, profile?.id])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    if (!isUser && order?.status === 'confirmed' && room?.request_id) {
      navigate(`/dp/navigate/${room.request_id}`)
    }
  }, [order?.status, isUser, room?.request_id, navigate])

  useEffect(() => {
    if (!room?.request_id) return
    const channel = supabase.channel(`chat-cancel-${room.request_id}-${profile?.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'requests', filter: `id=eq.${room.request_id}` },
        (payload: any) => { if ((payload.new as any)?.status === 'cancelled') navigate(isUser ? '/app' : '/dp') })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [room?.request_id, isUser, profile?.id, navigate])

  useEffect(() => {
    if (!roomId || !profile?.id) return
    const channel = supabase.channel(`typing-${roomId}`, { config: { broadcast: { self: false } } })
    typingChannelRef.current = channel
    channel.on('broadcast', { event: 'typing' }, (payload: any) => {
      if (payload.payload?.userId !== profile.id && payload.payload?.isTyping) {
        setOtherTyping(true)
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = setTimeout(() => setOtherTyping(false), 4000)
      } else if (payload.payload?.userId !== profile.id && !payload.payload?.isTyping) {
        setOtherTyping(false)
      }
    }).subscribe()
    return () => { if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); supabase.removeChannel(channel); typingChannelRef.current = null }
  }, [roomId, profile?.id])

  const sendTyping = (isTyping: boolean) => {
    if (isTypingRef.current === isTyping) return
    isTypingRef.current = isTyping
    typingChannelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { userId: profile?.id, isTyping } })
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
    if (e.target.value.trim()) {
      sendTyping(true)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => sendTyping(false), 2000)
    } else { sendTyping(false) }
  }

  const handleSend = () => { sendTyping(false); sendMessage(input) }

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

  const sendQuotation = async (itemCost: number, deliveryCharge: number, itemsSummary: string, photoUrl?: string | null) => {
    const quotation = { item_cost: itemCost, delivery_charge: deliveryCharge, items_summary: itemsSummary, photo_url: photoUrl || null }
    const { data, error } = await supabase.from('messages').insert({
      chat_room_id: roomId, sender_id: profile!.id,
      message_type: 'quotation', quotation_data: quotation,
      ...(photoUrl ? { attachment_url: photoUrl } : {}),
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
      navigate(`/app/track/${room.request_id}`)
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
    navigate(isUser ? '/app' : '/dp')
  }

  const submitRating = async (stars: number, review: string) => {
    if (!order) return
    const otherUserId = isUser ? room!.dp_id : room!.user_id
    const { error } = await supabase.from('ratings').insert({
      order_id: order.id, rater_id: profile!.id, rated_id: otherUserId, stars, review: review || null,
    })
    if (!error) { setHasRated(true); setShowRating(false) }
  }

  if (loading) return <FullScreenLoader />
  if (error) return <div className="p-4"><ErrorBanner message={error} /></div>

  const chatLocked = order?.status === 'completed'
  const lastOwnMsg = [...messages].reverse().find(m => m.sender_id === profile?.id)

  return (
    <div className="flex h-screen flex-col bg-[#0B0B0B]">
      {/* Premium Header */}
      <header className="flex shrink-0 items-center gap-3 px-4 py-3 z-10"
        style={{ background: 'rgba(11,11,11,0.96)', borderBottom: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)' }}>
        <button onClick={() => navigate(isUser ? '/app' : '/dp')} className="btn-icon shrink-0">
          <ArrowLeft size={18} style={{ color: 'rgba(255,255,255,0.7)' }} />
        </button>
        <Avatar url={otherUser?.photo_url} name={otherUser?.full_name || 'User'} size={40} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white leading-snug">{otherUser?.full_name || 'User'}</p>
          {otherTyping ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium" style={{ color: '#A6B300' }}>typing</span>
              <div className="flex gap-0.5 items-center">
                {[0, 150, 300].map(delay => (
                  <span key={delay} className="h-1 w-1 rounded-full animate-bounce" style={{ background: '#A6B300', animationDelay: `${delay}ms` }} />
                ))}
              </div>
            </div>
          ) : dpInfo ? (
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {dpInfo.vehicle_type} {dpInfo.rating_avg > 0 ? `· ${dpInfo.rating_avg.toFixed(1)}★` : ''} · {dpInfo.is_online ? 'Online' : 'Offline'}
            </p>
          ) : (
            <p className="flex items-center gap-1 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {lastOwnMsg?.read_at ? <><CheckCheck size={11} className="text-yellow-400" /> Seen</> : lastOwnMsg ? <><Check size={11} /> Delivered</> : 'Chat'}
            </p>
          )}
        </div>
        {order && <StatusBadge status={order.status} />}
        <button
          onClick={async () => {
            if (!room) return
            if (confirm('Cancel this request? Chat will close.')) {
              await supabase.from('requests').update({ status: 'cancelled' }).eq('id', room.request_id)
              navigate(isUser ? '/app' : '/dp')
            }
          }}
          className="shrink-0 rounded-2xl px-3 py-1.5 text-xs font-bold transition-all active:scale-95"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
          Cancel
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-md space-y-2.5">
          {/* Context banners */}
          {!order && isUser && (
            <div className="mb-4 rounded-2xl px-4 py-3 text-center text-xs font-medium animate-fade-in"
              style={{ background: 'rgba(166,179,0,0.08)', border: '1px solid rgba(166,179,0,0.15)', color: 'rgba(255,255,255,0.55)' }}>
              Discuss items and delivery charge. Your partner will send a quotation.
            </div>
          )}
          {!order && !isUser && (
            <div className="mb-4">
              <button onClick={() => setShowQuotation(true)}
                className="btn-primary w-full gap-2"
                style={{ background: '#A6B300', color: '#0B0B0B' }}>
                <FileText size={16} /> Send Quotation
              </button>
            </div>
          )}

          {messages.map((msg, index) => {
            const isOwn = msg.sender_id === profile!.id
            const showAvatar = !isOwn && (index === 0 || messages[index - 1].sender_id !== msg.sender_id)
            return (
              <div key={msg.id} className={`flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'} animate-slide-up`}>
                {!isOwn && (
                  <div style={{ width: 28 }}>
                    {showAvatar && <Avatar url={otherUser?.photo_url} name={otherUser?.full_name || 'User'} size={28} />}
                  </div>
                )}
                <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 ${isOwn ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
                  style={isOwn
                    ? { background: msg.read_at ? 'rgba(166,179,0,0.85)' : 'rgba(130,140,0,0.75)' }
                    : { background: '#1E1E1E', border: '1px solid rgba(255,255,255,0.08)' }}>

                  {msg.message_type === 'text' && (
                    <p className="text-sm leading-relaxed" style={{ color: isOwn ? '#0B0B0B' : '#fff' }}>{msg.content}</p>
                  )}

                  {msg.message_type === 'image' && msg.attachment_url && (
                    <button type="button" onClick={() => setLightboxImage(msg.attachment_url)}>
                      <img src={msg.attachment_url} alt="Shared" className="max-w-[200px] rounded-xl object-cover" />
                    </button>
                  )}

                  {msg.message_type === 'voice' && msg.attachment_url && (
                    <VoiceMessagePlayer url={msg.attachment_url} isOwn={isOwn} />
                  )}

                  {msg.message_type === 'location' && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <MapPin size={14} style={{ color: isOwn ? '#0B0B0B' : '#A6B300' }} />
                        <p className="text-sm font-semibold" style={{ color: isOwn ? '#0B0B0B' : '#fff' }}>Delivery Location</p>
                      </div>
                      {msg.content && <p className="text-xs" style={{ color: isOwn ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.55)' }}>{msg.content}</p>}
                      {msg.location_lat && msg.location_lng && (
                        <a href={`https://maps.google.com/?q=${msg.location_lat},${msg.location_lng}`} target="_blank" rel="noopener noreferrer"
                          className="inline-block text-xs underline font-medium" style={{ color: isOwn ? '#0B0B0B' : '#A6B300' }}>
                          Open in Maps
                        </a>
                      )}
                    </div>
                  )}

                  {msg.message_type === 'quotation' && msg.quotation_data && (
                    <div className="min-w-[220px] space-y-3">
                      <div className="flex items-center gap-2">
                        <FileText size={14} style={{ color: isOwn ? '#0B0B0B' : '#A6B300' }} />
                        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: isOwn ? '#0B0B0B' : '#A6B300' }}>Quotation</p>
                      </div>
                      {msg.quotation_data.photo_url && (
                        <button type="button" onClick={() => setLightboxImage(msg.quotation_data.photo_url)}>
                          <img src={msg.quotation_data.photo_url} alt="Proof" className="h-28 w-full rounded-xl object-cover" />
                        </button>
                      )}
                      <ul className="space-y-1">
                        {String(msg.quotation_data.items_summary || '').split('\n').map((line: string, i: number) =>
                          line.trim() ? (
                            <li key={i} className="flex items-start gap-1.5 text-xs" style={{ color: isOwn ? '#0B0B0B' : 'rgba(255,255,255,0.8)' }}>
                              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full flex-shrink-0" style={{ background: isOwn ? '#0B0B0B' : '#A6B300' }} />
                              {line.trim()}
                            </li>
                          ) : null
                        )}
                      </ul>
                      <div className="space-y-1 border-t pt-2 text-xs" style={{ borderColor: isOwn ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.1)' }}>
                        <div className="flex justify-between" style={{ color: isOwn ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.55)' }}>
                          <span>Item Cost</span><span>{formatCurrency(msg.quotation_data.item_cost)}</span>
                        </div>
                        <div className="flex justify-between font-bold" style={{ color: isOwn ? '#0B0B0B' : '#fff' }}>
                          <span>Delivery Charge</span><span>{formatCurrency(msg.quotation_data.delivery_charge)}</span>
                        </div>
                      </div>
                      {!order && isUser && (
                        <div className="flex gap-2">
                          <button onClick={rejectQuotation} className="flex-1 rounded-xl py-2 text-xs font-bold text-white"
                            style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)' }}>
                            Decline
                          </button>
                          <button onClick={() => acceptQuotation(msg)} className="flex-1 rounded-xl py-2 text-xs font-bold"
                            style={{ background: '#fff', color: '#0B0B0B' }}>
                            Accept
                          </button>
                        </div>
                      )}
                      {order && <p className="text-xs font-bold" style={{ color: isOwn ? '#0B0B0B' : '#34d399' }}>✓ Accepted</p>}
                    </div>
                  )}

                  {/* Timestamp + ticks */}
                  <div className={`mt-1 flex items-center justify-end gap-1 text-[10px]`}
                    style={{ color: isOwn ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.3)' }}>
                    {timeOfDay(msg.created_at)}
                    {isOwn && (
                      <span style={{ color: msg.read_at ? '#fbbf24' : 'rgba(0,0,0,0.4)' }}>
                        {msg.read_at ? <CheckCheck size={12} /> : <Check size={12} />}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Typing indicator */}
          {otherTyping && (
            <div className="flex items-end gap-2 justify-start animate-fade-in">
              <div style={{ width: 28 }}><Avatar url={otherUser?.photo_url} name={otherUser?.full_name || 'User'} size={28} /></div>
              <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm px-4 py-3" style={{ background: '#1E1E1E', border: '1px solid rgba(255,255,255,0.08)' }}>
                {[0, 150, 300].map(delay => (
                  <span key={delay} className="h-2 w-2 rounded-full animate-bounce" style={{ background: '#A6B300', animationDelay: `${delay}ms` }} />
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Rating bar */}
      {order?.status === 'completed' && isUser && !hasRated && (
        <div className="shrink-0 px-4 py-3" style={{ background: '#181818', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <button onClick={() => setShowRating(true)} className="btn-primary w-full gap-2" style={{ background: '#A6B300', color: '#0B0B0B' }}>
            <Star size={16} /> Rate Your Partner
          </button>
        </div>
      )}
      {order?.status === 'completed' && hasRated && (
        <div className="shrink-0 flex items-center justify-center gap-2 px-4 py-3" style={{ background: '#181818', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <CheckCircle size={15} className="text-green-400" />
          <p className="text-sm font-medium text-green-400">Order completed & rated</p>
        </div>
      )}

      {/* Input area */}
      {chatLocked ? (
        <div className="shrink-0 flex items-center justify-center gap-2 px-4 py-4" style={{ background: '#181818', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {order?.status === 'completed' ? 'Conversation ended.' : 'Waiting for delivery — chat is locked.'}
          </p>
        </div>
      ) : (
        <div className="shrink-0 px-4 py-3" style={{ background: '#181818', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <input ref={imageInputRef} type="file" className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) sendImage(f); e.target.value = '' }} />

          {showAttachMenu && (
            <div className="mb-3 flex flex-wrap gap-2 animate-slide-up">
              <button onClick={() => { imageInputRef.current?.click(); setShowAttachMenu(false) }}
                className="flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-medium"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
                <Camera size={14} /> Photo
              </button>
              <button onClick={sendLocation} disabled={sendingLocation}
                className="flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-medium disabled:opacity-50"
                style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa' }}>
                <Navigation size={14} /> {sendingLocation ? 'Locating...' : 'Location'}
              </button>
              {recording ? (
                <button onClick={stopVoiceRecord} className="flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-medium"
                  style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
                  <MicOff size={14} /> Stop ({fmtDur(voiceDuration)})
                </button>
              ) : (
                <button onClick={startVoiceRecord} className="flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-medium"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
                  <Mic size={14} /> Voice
                </button>
              )}
              {!isUser && order && ['confirmed','shopping','purchased','on_the_way','arrived'].includes(order.status) && (
                <button onClick={() => { setShowPickupPhoto(true); setShowAttachMenu(false) }}
                  className="flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-medium"
                  style={{ background: 'rgba(166,179,0,0.12)', border: '1px solid rgba(166,179,0,0.25)', color: '#A6B300' }}>
                  <PackageCheck size={14} /> Pickup Proof
                </button>
              )}
              <button onClick={() => setShowAttachMenu(false)} style={{ color: 'rgba(255,255,255,0.35)', marginLeft: 'auto' }}><X size={16} /></button>
            </div>
          )}

          <div className="mx-auto flex max-w-md items-center gap-2">
            <button onClick={() => setShowAttachMenu(!showAttachMenu)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-all active:scale-90"
              style={showAttachMenu
                ? { background: '#A6B300' }
                : { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Paperclip size={18} style={{ color: showAttachMenu ? '#0B0B0B' : 'rgba(255,255,255,0.5)' }} />
            </button>

            {recording ? (
              <div className="flex flex-1 items-center gap-2.5 rounded-2xl px-3.5 py-2.5" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                <span className="flex-1 text-sm font-medium text-red-400">Recording {fmtDur(voiceDuration)}</span>
                <button onClick={stopVoiceRecord} className="text-xs font-bold text-red-400">Send</button>
              </div>
            ) : (
              <input value={input} onChange={handleInputChange}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Message..."
                className="input flex-1 py-3"
              />
            )}

            {!recording && (
              <button onClick={handleSend}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-all active:scale-90"
                style={input.trim()
                  ? { background: '#A6B300', boxShadow: '0 4px 16px rgba(166,179,0,0.4)' }
                  : { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Send size={18} style={{ color: input.trim() ? '#0B0B0B' : 'rgba(255,255,255,0.35)' }} />
              </button>
            )}
          </div>
        </div>
      )}

      {showQuotation && room && <QuotationModal onClose={() => setShowQuotation(false)} onSend={sendQuotation} initialItems={requestDescription} roomId={room.id} senderId={profile!.id} />}
      {showPickupPhoto && (
        <PickupPhotoModal onClose={() => setShowPickupPhoto(false)} onSubmit={async (file) => {
          const path = `chat/${profile!.id}/pickup-${Date.now()}`
          const { error } = await supabase.storage.from('media').upload(path, file, { upsert: true })
          if (error) { alert('Upload failed: ' + error.message); return }
          const url = supabase.storage.from('media').getPublicUrl(path).data.publicUrl
          await supabase.from('messages').insert({ chat_room_id: room!.id, sender_id: profile!.id, message_type: 'image', attachment_url: url, content: 'Pickup proof photo' })
          setShowPickupPhoto(false)
        }} />
      )}
      {showRating && <RatingModal onClose={() => setShowRating(false)} onSubmit={submitRating} targetName={otherUser?.full_name || 'Delivery Partner'} />}

      {/* View Full Order button — opens full-screen page */}
      {fullOrderData && (
        <button onClick={() => navigate(isUser ? `/app/chat/${roomId}/order` : `/dp/chat/${roomId}/order`)}
          className="fixed bottom-20 right-4 z-20 flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold shadow-lg transition-all active:scale-95"
          style={{ background: '#A6B300', color: '#0B0B0B', boxShadow: '0 4px 16px rgba(166,179,0,0.4)' }}>
          <ClipboardList size={14} /> View Full Order
        </button>
      )}

      {/* Image lightbox */}
      {lightboxImage && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 animate-fade-in" onClick={() => setLightboxImage(null)}>
          <button className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10" onClick={() => setLightboxImage(null)}>
            <X size={20} className="text-white" />
          </button>
          <img src={lightboxImage} alt="Full size" className="max-h-full max-w-full object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}

function VoiceMessagePlayer({ url, isOwn }: { url: string; isOwn: boolean }) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const toggle = () => {
    try {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; setPlaying(false); return }
      const audio = new Audio(); audio.src = url; audioRef.current = audio
      audio.onended = () => { setPlaying(false); audioRef.current = null }
      audio.onerror = () => { setPlaying(false); audioRef.current = null }
      audio.play().then(() => setPlaying(true)).catch(() => { setPlaying(false); audioRef.current = null })
    } catch { setPlaying(false); audioRef.current = null }
  }
  return (
    <div className="flex items-center gap-2.5 min-w-[140px]">
      <button onClick={toggle} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all active:scale-90"
        style={{ background: isOwn ? 'rgba(0,0,0,0.2)' : 'rgba(166,179,0,0.2)' }}>
        {playing
          ? <Pause size={14} style={{ color: isOwn ? '#0B0B0B' : '#A6B300' }} />
          : <Play size={14} style={{ color: isOwn ? '#0B0B0B' : '#A6B300' }} />}
      </button>
      <div className="flex flex-1 items-center gap-0.5 h-8">
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} className={`flex-1 rounded-full ${playing ? 'animate-pulse' : ''}`}
            style={{
              height: `${20 + Math.sin(i) * 14 + Math.random() * 10}%`,
              background: isOwn ? 'rgba(0,0,0,0.35)' : 'rgba(166,179,0,0.5)',
              animationDelay: `${i * 50}ms`,
            }} />
        ))}
      </div>
    </div>
  )
}

function PickupPhotoModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (file: File) => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setFile(f); setPreview(URL.createObjectURL(f))
  }
  const handleSubmit = async () => { if (!file) return; setUploading(true); await onSubmit(file); setUploading(false) }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl p-6 animate-slide-in-bottom" style={{ background: '#1E1E1E', border: '1px solid rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
        <div className="bottom-sheet-handle" />
        <h3 className="mb-1 text-lg font-bold text-white">Pickup Proof</h3>
        <p className="mb-4 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Photo of items as pickup confirmation.</p>
        <input ref={fileRef} type="file" className="hidden" accept="image/*" onChange={handleSelect} />
        {preview ? (
          <div className="relative mb-4">
            <img src={preview} alt="Proof" className="h-40 w-full rounded-2xl object-cover" />
            <button onClick={() => { setFile(null); setPreview(null) }} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full" style={{ background: 'rgba(0,0,0,0.7)' }}>
              <X size={14} className="text-white" />
            </button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} className="mb-4 flex w-full flex-col items-center justify-center gap-2 rounded-2xl py-8 transition-all active:scale-98"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1.5px dashed rgba(255,255,255,0.15)' }}>
            <Camera size={28} style={{ color: 'rgba(255,255,255,0.3)' }} />
            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Take Photo or Upload</span>
          </button>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={!file || uploading} className="flex-1 btn font-bold disabled:opacity-40" style={{ background: '#A6B300', color: '#0B0B0B' }}>
            {uploading ? 'Sending...' : 'Send Proof'}
          </button>
        </div>
      </div>
    </div>
  )
}

function QuotationModal({ onClose, onSend, initialItems, roomId, senderId }: { onClose: () => void; onSend: (itemCost: number, deliveryCharge: number, itemsSummary: string, photoUrl?: string | null) => void; initialItems?: string; roomId: string; senderId: string }) {
  const [items, setItems] = useState(() => initialItems || '')
  const [itemCost, setItemCost] = useState('')
  const [deliveryCharge, setDeliveryCharge] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setPhotoFile(file); setPhotoPreview(URL.createObjectURL(file))
  }
  const handleSend = async () => {
    setUploading(true)
    let photoUrl: string | null = null
    if (photoFile) {
      const path = `quotations/${senderId}/${Date.now()}-quote`
      const { error } = await supabase.storage.from('media').upload(path, photoFile, { upsert: true })
      if (!error) photoUrl = supabase.storage.from('media').getPublicUrl(path).data.publicUrl
    }
    setUploading(false)
    onSend(parseFloat(itemCost) || 0, parseFloat(deliveryCharge) || 0, items, photoUrl)
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-t-3xl animate-slide-in-bottom" style={{ background: '#1E1E1E', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-4 pb-2">
          <div className="bottom-sheet-handle" />
          <h3 className="text-lg font-bold text-white mb-4">Send Quotation</h3>
        </div>
        <div className="overflow-y-auto px-5 pb-8 space-y-4" style={{ maxHeight: 'calc(90vh - 80px)' }}>
          <div>
            <label className="label">Items Summary</label>
            <p className="mb-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Edit the customer's request — each item on its own line.</p>
            <textarea className="input min-h-24 resize-none" value={items} onChange={e => setItems(e.target.value)} placeholder="2kg Rice&#10;1L Milk" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label flex items-center gap-1"><IndianRupee size={12} /> Item Cost</label>
              <input type="number" className="input" value={itemCost} onChange={e => setItemCost(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="label flex items-center gap-1"><IndianRupee size={12} /> Delivery Fee</label>
              <input type="number" className="input" value={deliveryCharge} onChange={e => setDeliveryCharge(e.target.value)} placeholder="0" />
            </div>
          </div>
          <div>
            <label className="label">Proof Photo <span style={{ color: 'rgba(255,255,255,0.3)', textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
            <input ref={photoInputRef} type="file" className="hidden" accept="image/*" onChange={handlePhotoSelect} />
            {photoPreview ? (
              <div className="relative">
                <img src={photoPreview} alt="Proof" className="h-28 w-full rounded-2xl object-cover" />
                <button onClick={() => { setPhotoFile(null); setPhotoPreview(null) }} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full" style={{ background: 'rgba(0,0,0,0.7)' }}>
                  <X size={12} className="text-white" />
                </button>
              </div>
            ) : (
              <button onClick={() => photoInputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm transition-all active:scale-95"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1.5px dashed rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)' }}>
                <Camera size={15} /> Upload Receipt Photo
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleSend} disabled={!items || !deliveryCharge || uploading} className="flex-1 btn font-bold disabled:opacity-40" style={{ background: '#A6B300', color: '#0B0B0B' }}>
              {uploading ? 'Uploading...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function RatingModal({ onClose, onSubmit, targetName }: { onClose: () => void; onSubmit: (stars: number, review: string) => void; targetName: string }) {
  const [stars, setStars] = useState(5)
  const [review, setReview] = useState('')
  const labels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent']
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl p-6 animate-slide-in-bottom" style={{ background: '#1E1E1E', border: '1px solid rgba(255,255,255,0.08)' }} onClick={e => e.stopPropagation()}>
        <div className="bottom-sheet-handle" />
        <h3 className="text-lg font-bold text-white text-center">Rate {targetName}</h3>
        <p className="mt-1 mb-6 text-sm text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>How was your experience?</p>
        <div className="mb-2 flex justify-center gap-3">
          {[1, 2, 3, 4, 5].map(i => (
            <button key={i} onClick={() => setStars(i)} className="transition-transform active:scale-90">
              <svg width={40} height={40} viewBox="0 0 24 24" fill={i <= stars ? '#fbbf24' : 'none'} stroke={i <= stars ? '#fbbf24' : 'rgba(255,255,255,0.2)'} strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>
          ))}
        </div>
        <p className="mb-4 text-center font-semibold" style={{ color: '#fbbf24' }}>{labels[stars]}</p>
        <textarea className="input min-h-20 resize-none mb-4" value={review} onChange={e => setReview(e.target.value)} placeholder="Leave a review (optional)" />
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Skip</button>
          <button onClick={() => onSubmit(stars, review)} className="flex-1 btn font-bold" style={{ background: '#A6B300', color: '#0B0B0B' }}>Submit</button>
        </div>
      </div>
    </div>
  )
}
