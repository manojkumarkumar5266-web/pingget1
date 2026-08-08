import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase, Message, ChatRoom, Order, Profile, DeliveryPartner } from '../../lib/supabase'
import { Avatar, StatusBadge, ErrorBanner, FullScreenLoader } from '../../components/ui'
import { formatCurrency, timeOfDay, STATUS_LABELS } from '../../lib/utils'
import { ArrowLeft, Send, FileText, Check, CheckCheck, Star, IndianRupee, Camera, Mic, MicOff, X, Play, Pause, Paperclip, PackageCheck, CheckCircle, ClipboardList, CreditCard, Upload, ShieldCheck, AlertCircle, CalendarClock, Clock, RotateCcw, Shield, MapPin, Navigation, Tag, Volume2, ChevronDown, ChevronUp } from 'lucide-react'

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
  const greetingSentRef = useRef(false)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [showPickupPhoto, setShowPickupPhoto] = useState(false)
  const [showAdvancePayment, setShowAdvancePayment] = useState(false)
  const [showPaymentProof, setShowPaymentProof] = useState<string | null>(null)
  const [advancePaymentData, setAdvancePaymentData] = useState<any>(null)
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null)
  const [paymentProofPreview, setPaymentProofPreview] = useState<string | null>(null)
  const [upiRef, setUpiRef] = useState('')
  const [transactionId, setTransactionId] = useState('')
  const [paymentRemarks, setPaymentRemarks] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null)
  const [uploadingProof, setUploadingProof] = useState(false)
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
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
      // Fetch advance payment if exists
      if ((reqData as any)?.advance_payment_id) {
        const { data: apData } = await supabase.from('advance_payments').select('*').eq('id', (reqData as any).advance_payment_id).maybeSingle()
        setAdvancePaymentData(apData)
      } else {
        // Also check by request_id
        const { data: apData } = await supabase.from('advance_payments').select('*').eq('request_id', roomData.request_id).order('created_at', { ascending: false }).limit(1).maybeSingle()
        setAdvancePaymentData(apData)
      }
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

  // Auto-generated greetings disabled — only typed messages appear
  useEffect(() => {
    greetingSentRef.current = true
  }, [])

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
    const pollInterval = setInterval(onFocus, 5000)
    return () => { clearInterval(pollInterval) }
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
      .subscribe()
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
        (payload: any) => {
          const updated = payload.new as any
          if (updated.status === 'cancelled') navigate(isUser ? '/app' : '/dp')
          // Refresh fullOrderData so payment status / booking status changes reflect immediately
          setFullOrderData(updated)
          // If advance payment status changed, refetch advance payment data
          if (updated.advance_payment_id) {
            supabase.from('advance_payments').select('*').eq('id', updated.advance_payment_id).maybeSingle()
              .then(({ data }) => { if (data) setAdvancePaymentData(data) })
          }
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [room?.request_id, isUser, profile?.id, navigate])

  // Realtime: listen for advance_payments changes (payment proof upload, verification, rejection)
  useEffect(() => {
    if (!room?.request_id || !fullOrderData?.advance_payment_id) return
    const apId = fullOrderData.advance_payment_id
    const channel = supabase.channel(`advance-payment-${apId}-${profile?.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'advance_payments', filter: `id=eq.${apId}` },
        (payload: any) => {
          setAdvancePaymentData(payload.new)
          // Also refetch messages so payment proof / verification messages appear
          fetchMessages()
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [room?.request_id, fullOrderData?.advance_payment_id, profile?.id])

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

  const fetchMessages = async () => {
    if (!roomId) return
    const { data: msgs } = await supabase.from('messages').select('*').eq('chat_room_id', roomId).order('created_at', { ascending: true })
    setMessages((msgs as Message[]) || [])
    // Also refresh advance payment data
    if (fullOrderData?.id) {
      const { data: apData } = await supabase.from('advance_payments').select('*').eq('request_id', fullOrderData.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
      setAdvancePaymentData(apData)
    }
    // Refresh request data
    if (fullOrderData?.id) {
      const { data: reqData } = await supabase.from('requests').select('*').eq('id', fullOrderData.id).maybeSingle()
      if (reqData) setFullOrderData(reqData as any)
    }
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
    if (!error) {
      setHasRated(true); setShowRating(false)
      if (isUser) {
        const { data: ratings } = await supabase.from('ratings').select('stars').eq('rated_id', otherUserId)
        if (ratings && ratings.length > 0) {
          const avg = ratings.reduce((s, r) => s + r.stars, 0) / ratings.length
          await supabase.from('delivery_partners').update({
            rating_avg: parseFloat(avg.toFixed(2)),
            rating_count: ratings.length,
          }).eq('user_id', otherUserId)
        }
      }
    }
  }

  if (loading) return <FullScreenLoader />
  if (error) return <div className="p-4"><ErrorBanner message={error} /></div>

  const chatLocked = order?.status === 'completed'
  const lastOwnMsg = [...messages].reverse().find(m => m.sender_id === profile?.id)
  const isCompleted = order?.status === 'completed'

  return (
    <div className="flex h-screen flex-col" style={{ background: '#0B0B0B' }}>
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 px-4 py-3 z-10"
        style={{ background: '#0B0B0B', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={() => navigate(isUser ? '/app' : '/dp')} className="btn-icon shrink-0">
          <ArrowLeft size={18} style={{ color: '#fff' }} />
        </button>
        <Avatar url={otherUser?.photo_url} name={otherUser?.full_name || 'User'} size={42} />
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
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {dpInfo.vehicle_type} {dpInfo.rating_avg > 0 ? `· ${dpInfo.rating_avg.toFixed(1)}★` : ''} · {dpInfo.is_online ? 'Online' : 'Offline'}
            </p>
          ) : (
            <p className="flex items-center gap-1 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {lastOwnMsg?.read_at ? <><CheckCheck size={11} style={{ color: '#A6B300' }} /> Seen</> : lastOwnMsg ? <><Check size={11} /> Delivered</> : 'Chat'}
            </p>
          )}
        </div>
        {order && <StatusBadge status={order.status} />}
        {!isCompleted && isUser && !order && (
          <button
            onClick={async () => {
              if (!room) return
              if (confirm('Cancel this request? Chat will close.')) {
                await supabase.from('requests').update({ status: 'cancelled' }).eq('id', room.request_id)
                navigate('/app')
              }
            }}
            className="shrink-0 rounded-2xl px-3 py-1.5 text-xs font-bold transition-all active:scale-95"
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
            Cancel
          </button>
        )}
      </header>

      {/* Pinned Advance Task Summary (advance bookings only) */}
      {fullOrderData?.order_type === 'advance' && (
        <AdvanceTaskSummary
          request={fullOrderData}
          statusLabel={STATUS_LABELS[fullOrderData.status] || fullOrderData.status}
        />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ background: '#0B0B0B' }}>
        <div className="mx-auto max-w-md space-y-2.5">
          {/* Context banners */}
          {!order && isUser && fullOrderData?.order_type !== 'advance' && (
            <div className="mb-4 rounded-2xl px-4 py-3 text-center text-xs font-medium animate-fade-in"
              style={{ background: 'rgba(166,179,0,0.08)', border: '1px solid rgba(166,179,0,0.2)', color: 'rgba(255,255,255,0.6)' }}>
              Discuss items and delivery charge. Your partner will send a quotation.
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
                    ? { background: '#A6B300' }
                    : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>

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

                  {msg.message_type === 'quotation' && msg.quotation_data && (
                    <div className="min-w-[240px] space-y-3">
                      <div className="flex items-center justify-center gap-2 pb-2 border-b" style={{ borderColor: isOwn ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)' }}>
                        <FileText size={15} style={{ color: isOwn ? '#0B0B0B' : '#A6B300' }} />
                        <p className="text-sm font-bold tracking-wide" style={{ color: isOwn ? '#0B0B0B' : '#A6B300' }}>Quotation</p>
                      </div>
                      {msg.quotation_data.photo_url && (
                        <div className="flex flex-wrap gap-1.5">
                          {msg.quotation_data.photo_url.split(',').map((url: string, i: number) => (
                            <button key={i} type="button" onClick={() => setLightboxImage(url)}>
                              <img src={url} alt={`Proof ${i + 1}`} className="h-20 w-20 rounded-xl object-cover" style={{ border: '1px solid rgba(255,255,255,0.1)' }} />
                            </button>
                          ))}
                        </div>
                      )}
                      <ul className="space-y-1.5">
                        {String(msg.quotation_data.items_summary || '').split('\n').map((line: string, i: number) =>
                          line.trim() ? (
                            <li key={i} className="flex items-start gap-2 text-sm" style={{ color: isOwn ? '#0B0B0B' : 'rgba(255,255,255,0.85)' }}>
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: isOwn ? '#0B0B0B' : '#A6B300' }} />
                              {line.trim()}
                            </li>
                          ) : null
                        )}
                      </ul>
                      <div className="space-y-1.5 border-t pt-2.5 text-sm" style={{ borderColor: isOwn ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.1)' }}>
                        <div className="flex justify-between" style={{ color: isOwn ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.55)' }}>
                          <span>Item Cost</span><span>{formatCurrency(msg.quotation_data.item_cost)}</span>
                        </div>
                        <div className="flex justify-between font-bold" style={{ color: isOwn ? '#0B0B0B' : '#fff' }}>
                          <span>Delivery Charge</span><span>{formatCurrency(msg.quotation_data.delivery_charge)}</span>
                        </div>
                      </div>
                      {!order && isUser && (
                        <div className="flex gap-2 pt-1">
                          <button onClick={rejectQuotation} className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition-all active:scale-95"
                            style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)' }}>
                            Decline
                          </button>
                          <button onClick={() => acceptQuotation(msg)} className="flex-1 rounded-xl py-2.5 text-sm font-bold transition-all active:scale-95"
                            style={{ background: '#fff', color: '#0B0B0B' }}>
                            Accept
                          </button>
                        </div>
                      )}
                      {order && <p className="text-center text-sm font-bold" style={{ color: isOwn ? 'rgba(0,0,0,0.7)' : '#A6B300' }}>✓ Accepted</p>}
                    </div>
                  )}

                  {/* Advance Payment Card */}
                  {msg.message_type === 'advance_payment' && msg.quotation_data && (
                    <div className="w-72 space-y-3 p-4 rounded-2xl"
                      style={{ background: isOwn ? 'rgba(0,0,0,0.08)' : 'rgba(166,179,0,0.06)', border: `1px solid ${isOwn ? 'rgba(0,0,0,0.15)' : 'rgba(166,179,0,0.2)'}` }}>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: 'rgba(166,179,0,0.2)' }}>
                          <CreditCard size={16} style={{ color: '#A6B300' }} />
                        </div>
                        <div>
                          <p className="text-sm font-bold" style={{ color: isOwn ? '#0B0B0B' : '#A6B300' }}>Advance Booking Confirmation</p>
                          <p className="text-[10px]" style={{ color: isOwn ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.4)' }}>Payment Request</p>
                        </div>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between"><span style={{ color: isOwn ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)' }}>Booking ID</span><span className="font-mono font-semibold" style={{ color: isOwn ? '#0B0B0B' : '#fff' }}>{(msg.quotation_data.booking_id || '').slice(0, 8)}...</span></div>
                        <div className="flex justify-between"><span style={{ color: isOwn ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)' }}>Scheduled Date</span><span className="font-semibold" style={{ color: isOwn ? '#0B0B0B' : '#fff' }}>{msg.quotation_data.scheduled_date || 'N/A'}</span></div>
                        <div className="flex justify-between"><span style={{ color: isOwn ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)' }}>Scheduled Time</span><span className="font-semibold" style={{ color: isOwn ? '#0B0B0B' : '#fff' }}>{msg.quotation_data.scheduled_time || 'N/A'}</span></div>
                        <div className="flex justify-between"><span style={{ color: isOwn ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)' }}>Amount</span><span className="font-bold" style={{ color: '#A6B300' }}>{formatCurrency(msg.quotation_data.amount)}</span></div>
                        {msg.quotation_data.payment_deadline && (
                          <div className="flex justify-between"><span style={{ color: isOwn ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)' }}>Deadline</span><span className="font-semibold" style={{ color: isOwn ? '#0B0B0B' : '#fff' }}>{msg.quotation_data.payment_deadline}</span></div>
                        )}
                        <div className="flex justify-between"><span style={{ color: isOwn ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)' }}>Purpose</span><span className="font-semibold" style={{ color: isOwn ? '#0B0B0B' : '#fff' }}>Advance Booking Confirmation</span></div>
                        <div className="flex justify-between"><span style={{ color: isOwn ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)' }}>Status</span>
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                            style={{ background: msg.quotation_data.status === 'verified' ? 'rgba(16,185,129,0.2)' : msg.quotation_data.status === 'proof_uploaded' ? 'rgba(59,130,246,0.2)' : msg.quotation_data.status === 'rejected' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                              color: msg.quotation_data.status === 'verified' ? '#34d399' : msg.quotation_data.status === 'proof_uploaded' ? '#60a5fa' : msg.quotation_data.status === 'rejected' ? '#f87171' : '#f59e0b' }}>
                            {msg.quotation_data.status === 'waiting' ? 'Waiting For Payment' : msg.quotation_data.status === 'proof_uploaded' ? 'Proof Uploaded' : msg.quotation_data.status === 'verified' ? 'Payment Verified' : msg.quotation_data.status === 'rejected' ? 'Rejected' : 'Expired'}
                          </span>
                        </div>
                      </div>
                      {/* Customer: Upload payment proof button (also after rejection so they can re-upload) */}
                      {isUser && (msg.quotation_data.status === 'waiting' || msg.quotation_data.status === 'rejected') && msg.advance_payment_id && (
                        <button onClick={() => { setShowPaymentProof(msg.advance_payment_id); setAdvancePaymentData(msg.quotation_data) }}
                          className="w-full rounded-xl py-2.5 text-xs font-bold transition-all active:scale-95"
                          style={{ background: '#A6B300', color: '#0B0B0B' }}>
                          <Upload size={12} className="inline mr-1" /> Upload Payment Proof
                        </button>
                      )}
                      {/* DP: Verify/Reject buttons when proof uploaded */}
                      {!isUser && msg.quotation_data.status === 'proof_uploaded' && msg.advance_payment_id && (
                        <div className="flex gap-2">
                          <button onClick={() => setShowRejectModal(msg.advance_payment_id)}
                            className="flex-1 rounded-xl py-2.5 text-xs font-bold transition-all active:scale-95"
                            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
                            Reject
                          </button>
                          <button onClick={async () => {
                            await supabase.from('advance_payments').update({ status: 'verified', verified_by: profile!.id, verified_at: new Date().toISOString() }).eq('id', msg.advance_payment_id)
                            await supabase.from('requests').update({ status: 'booking_confirmed' }).eq('advance_payment_id', msg.advance_payment_id)
                            await supabase.from('messages').insert({ chat_room_id: room!.id, sender_id: profile!.id, message_type: 'text', content: 'Advance Confirmation Payment Verified. Your booking has been successfully reserved. See you on the scheduled date and time.' })
                            await supabase.from('notifications').insert({ user_id: fullOrderData?.user_id, title: 'Payment Verified', body: 'Your advance payment has been verified. Booking confirmed!', type: 'payment_verified', related_id: fullOrderData?.id })
                            fetchMessages()
                          }}
                            className="flex-1 rounded-xl py-2.5 text-xs font-bold transition-all active:scale-95"
                            style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399' }}>
                            <ShieldCheck size={12} className="inline mr-1" /> Verify
                          </button>
                        </div>
                      )}
                      {/* DP: Request Another Proof after rejection */}
                      {!isUser && msg.quotation_data.status === 'rejected' && msg.advance_payment_id && (
                        <button onClick={async () => {
                          await supabase.from('advance_payments').update({ status: 'waiting', reject_reason: null }).eq('id', msg.advance_payment_id)
                          await supabase.from('messages').insert({ chat_room_id: room!.id, sender_id: profile!.id, message_type: 'text', content: 'Please re-upload the payment proof with the correct details.' })
                          fetchMessages()
                        }}
                          className="w-full rounded-xl py-2.5 text-xs font-bold transition-all active:scale-95"
                          style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b' }}>
                          <RotateCcw size={12} className="inline mr-1" /> Request Another Proof
                        </button>
                      )}
                      {/* Admin Override: Force verify or reject */}
                      {profile?.role === 'admin' && msg.advance_payment_id && msg.quotation_data.status !== 'verified' && (
                        <div className="flex gap-2">
                          <button onClick={async () => {
                            await supabase.from('advance_payments').update({ status: 'verified', verified_by: profile!.id, verified_at: new Date().toISOString(), admin_override: true }).eq('id', msg.advance_payment_id)
                            await supabase.from('requests').update({ status: 'booking_confirmed' }).eq('advance_payment_id', msg.advance_payment_id)
                            await supabase.from('messages').insert({ chat_room_id: room!.id, sender_id: profile!.id, message_type: 'text', content: '[Admin Override] Payment verified by admin. Booking confirmed.' })
                            fetchMessages()
                          }}
                            className="flex-1 rounded-xl py-2.5 text-xs font-bold transition-all active:scale-95"
                            style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399' }}>
                            <Shield size={12} className="inline mr-1" /> Force Verify
                          </button>
                          <button onClick={async () => {
                            await supabase.from('advance_payments').update({ status: 'rejected', verified_by: profile!.id, verified_at: new Date().toISOString(), admin_override: true, reject_reason: 'Rejected by admin' }).eq('id', msg.advance_payment_id)
                            await supabase.from('messages').insert({ chat_room_id: room!.id, sender_id: profile!.id, message_type: 'text', content: '[Admin Override] Payment rejected by admin.' })
                            fetchMessages()
                          }}
                            className="flex-1 rounded-xl py-2.5 text-xs font-bold transition-all active:scale-95"
                            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
                            <Shield size={12} className="inline mr-1" /> Force Reject
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Payment Proof Card */}
                  {msg.message_type === 'payment_proof' && msg.quotation_data && (
                    <div className="w-72 space-y-3 p-4 rounded-2xl"
                      style={{ background: isOwn ? 'rgba(0,0,0,0.08)' : 'rgba(59,130,246,0.06)', border: `1px solid ${isOwn ? 'rgba(0,0,0,0.15)' : 'rgba(59,130,246,0.2)'}` }}>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: 'rgba(59,130,246,0.2)' }}>
                          <ShieldCheck size={16} style={{ color: '#60a5fa' }} />
                        </div>
                        <div>
                          <p className="text-sm font-bold" style={{ color: isOwn ? '#0B0B0B' : '#60a5fa' }}>Payment Proof Uploaded</p>
                          <p className="text-[10px]" style={{ color: isOwn ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.4)' }}>Customer payment confirmation</p>
                        </div>
                      </div>
                      {msg.quotation_data.screenshot_url && (
                        <a href={msg.quotation_data.screenshot_url} target="_blank" rel="noopener noreferrer">
                          <img src={msg.quotation_data.screenshot_url} alt="Payment Proof" className="h-32 w-full rounded-xl object-cover" />
                        </a>
                      )}
                      <div className="space-y-1 text-xs">
                        {msg.quotation_data.upi_ref && <div className="flex justify-between"><span style={{ color: isOwn ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)' }}>UPI Ref</span><span className="font-mono font-semibold" style={{ color: isOwn ? '#0B0B0B' : '#fff' }}>{msg.quotation_data.upi_ref}</span></div>}
                        {msg.quotation_data.transaction_id && <div className="flex justify-between"><span style={{ color: isOwn ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)' }}>Transaction ID</span><span className="font-mono font-semibold" style={{ color: isOwn ? '#0B0B0B' : '#fff' }}>{msg.quotation_data.transaction_id}</span></div>}
                        {msg.quotation_data.customer_remarks && <div className="flex justify-between"><span style={{ color: isOwn ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)' }}>Remarks</span><span className="font-semibold" style={{ color: isOwn ? '#0B0B0B' : '#fff' }}>{msg.quotation_data.customer_remarks}</span></div>}
                      </div>
                    </div>
                  )}

                  {/* Timestamp + ticks */}
                  <div className={`mt-1 flex items-center justify-end gap-1 text-[10px]`}
                    style={{ color: isOwn ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.3)' }}>
                    {timeOfDay(msg.created_at)}
                    {isOwn && (
                      <span style={{ color: msg.read_at ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)' }}>
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
              <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm px-4 py-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
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
      {isCompleted && isUser && !hasRated && (
        <div className="shrink-0 px-4 py-3" style={{ background: '#0B0B0B', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={() => setShowRating(true)} className="w-full gap-2 rounded-xl py-3.5 text-sm font-bold transition-all active:scale-95"
            style={{ background: '#A6B300', color: '#0B0B0B' }}>
            <Star size={16} /> Rate Your Partner
          </button>
        </div>
      )}
      {isCompleted && hasRated && (
        <div className="shrink-0 flex items-center justify-center gap-2 px-4 py-3" style={{ background: '#0B0B0B', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <CheckCircle size={15} style={{ color: '#A6B300' }} />
          <p className="text-sm font-medium" style={{ color: '#A6B300' }}>Order completed & rated</p>
        </div>
      )}

      {/* Input area — WhatsApp style: Photo | Voice | Type message */}
      {chatLocked ? (
        <div className="shrink-0 flex items-center justify-center gap-2 px-4 py-4" style={{ background: '#0B0B0B', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Conversation ended — order completed.
          </p>
        </div>
      ) : (
        <div className="shrink-0 px-4 py-3" style={{ background: '#0B0B0B', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <input ref={imageInputRef} type="file" className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) sendImage(f); e.target.value = '' }} />

          {!isUser && order && ['confirmed','shopping','purchased','on_the_way','arrived'].includes(order.status) && (
            <div className="mb-2 flex justify-start">
              <button type="button" onClick={() => setShowPickupPhoto(true)}
                className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium"
                style={{ background: 'rgba(166,179,0,0.12)', border: '1px solid rgba(166,179,0,0.25)', color: '#A6B300' }}>
                <PackageCheck size={14} /> Pickup Proof
              </button>
            </div>
          )}

          <div className="mx-auto flex max-w-md items-center gap-2">
            <button type="button" onClick={() => imageInputRef.current?.click()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl active:scale-90"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Camera size={18} style={{ color: 'rgba(255,255,255,0.6)' }} />
            </button>

            {recording ? (
              <div className="flex flex-1 items-center gap-2.5 rounded-2xl px-3.5 py-2.5" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                <span className="flex-1 text-sm font-medium text-red-400">Recording {fmtDur(voiceDuration)}</span>
                <button type="button" onClick={stopVoiceRecord} className="text-xs font-bold text-red-400">Send</button>
              </div>
            ) : (
              <>
                <button type="button" onClick={startVoiceRecord}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl active:scale-90"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <Mic size={18} style={{ color: 'rgba(255,255,255,0.6)' }} />
                </button>
                <input value={input} onChange={handleInputChange}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Type a message..."
                  className="flex-1 rounded-xl py-3 px-4 text-sm text-white outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </>
            )}

            {!recording && (
              <button type="button" onClick={handleSend}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl active:scale-90"
                style={input.trim()
                  ? { background: '#A6B300' }
                  : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Send size={18} style={{ color: input.trim() ? '#0B0B0B' : 'rgba(255,255,255,0.4)' }} />
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

      {/* View Full Order + Send Quotation buttons */}
      {fullOrderData && !isCompleted && (
        <div className="fixed bottom-20 left-0 right-0 z-20 flex justify-center gap-2 px-4">
          <button onClick={() => navigate(isUser ? `/app/chat/${roomId}/order` : `/dp/chat/${roomId}/order`)}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold shadow-lg transition-all active:scale-95"
            style={{ background: '#A6B300', color: '#0B0B0B' }}>
            <ClipboardList size={14} /> View Full Order
          </button>
          {!isUser && !order && fullOrderData?.order_type !== 'advance' && (
            <button onClick={() => setShowQuotation(true)}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold shadow-lg transition-all active:scale-95"
              style={{ background: '#808000', color: '#fff' }}>
              <FileText size={14} /> Send Quotation
            </button>
          )}
          {/* Advance: prefer Advance Payment instead of quotation */}
          {!isUser && fullOrderData?.order_type === 'advance' && ['dp_reserved', 'accepted', 'searching_dp'].includes(fullOrderData.status) && !advancePaymentData && (
            <button onClick={() => setShowAdvancePayment(true)}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold shadow-lg transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, #A6B300, #808000)', color: '#0B0B0B' }}>
              <CreditCard size={14} /> Advance Payment
            </button>
          )}
        </div>
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

      {/* V3: Advance Payment Request Modal (DP sends payment card in chat) */}
      {showAdvancePayment && room && fullOrderData && (
        <AdvancePaymentModal
          onClose={() => setShowAdvancePayment(false)}
          roomId={room.id}
          request={fullOrderData}
          dpId={profile!.id}
          onSent={() => { setShowAdvancePayment(false); fetchMessages() }}
        />
      )}

      {/* V3: Payment Proof Upload Modal (Customer uploads proof) */}
      {showPaymentProof && room && (
        <PaymentProofModal
          onClose={() => { setShowPaymentProof(null); setPaymentProofFile(null); setPaymentProofPreview(null); setUpiRef(''); setTransactionId(''); setPaymentRemarks('') }}
          roomId={room.id}
          advancePaymentId={showPaymentProof}
          customerId={profile!.id}
          onSent={() => { setShowPaymentProof(null); setPaymentProofFile(null); setPaymentProofPreview(null); setUpiRef(''); setTransactionId(''); setPaymentRemarks(''); fetchMessages() }}
        />
      )}

      {/* V3: Reject Payment Modal (DP rejects with reason) */}
      {showRejectModal && room && (
        <RejectPaymentModal
          onClose={() => { setShowRejectModal(null); setRejectReason('') }}
          advancePaymentId={showRejectModal}
          dpId={profile!.id}
          onReject={async (reason) => {
            await supabase.from('advance_payments').update({ status: 'rejected', reject_reason: reason, verified_by: profile!.id, verified_at: new Date().toISOString() }).eq('id', showRejectModal)
            await supabase.from('messages').insert({ chat_room_id: room.id, sender_id: profile!.id, message_type: 'text', content: `Payment rejected: ${reason}` })
            setShowRejectModal(null); setRejectReason(''); fetchMessages()
          }}
        />
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
      <div className="w-full max-w-md rounded-3xl p-6 animate-slide-in-bottom" style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)' }} onClick={e => e.stopPropagation()}>
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
          <button onClick={handleSubmit} disabled={!file || uploading} className="flex-1 btn font-bold disabled:opacity-40 rounded-xl py-3"
            style={{ background: '#A6B300', color: '#0B0B0B' }}>
            {uploading ? 'Sending...' : 'Send Proof'}
          </button>
        </div>
      </div>
    </div>
  )
}

const MAX_PROOF_PHOTOS = 10
function QuotationModal({ onClose, onSend, initialItems, roomId, senderId }: { onClose: () => void; onSend: (itemCost: number, deliveryCharge: number, itemsSummary: string, photoUrl?: string | null) => void; initialItems?: string; roomId: string; senderId: string }) {
  const [items, setItems] = useState(() => initialItems || '')
  const [itemCost, setItemCost] = useState('')
  const [deliveryCharge, setDeliveryCharge] = useState('')
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const remaining = MAX_PROOF_PHOTOS - photoFiles.length
    const toAdd = files.slice(0, remaining)
    if (toAdd.length < files.length) alert(`You can upload up to ${MAX_PROOF_PHOTOS} photos.`)
    setPhotoFiles(prev => [...prev, ...toAdd])
    setPhotoPreviews(prev => [...prev, ...toAdd.map(f => URL.createObjectURL(f))])
  }
  const removePhoto = (idx: number) => {
    setPhotoPreviews(prev => { URL.revokeObjectURL(prev[idx]); return prev.filter((_, i) => i !== idx) })
    setPhotoFiles(prev => prev.filter((_, i) => i !== idx))
  }
  const handleSend = async () => {
    setUploading(true)
    let photoUrl: string | null = null
    if (photoFiles.length > 0) {
      const ts = Date.now()
      const urls: string[] = []
      for (let i = 0; i < photoFiles.length; i++) {
        const path = `quotations/${senderId}/${ts}-proof-${i}`
        const { error } = await supabase.storage.from('media').upload(path, photoFiles[i], { upsert: true })
        if (!error) urls.push(supabase.storage.from('media').getPublicUrl(path).data.publicUrl)
      }
      photoUrl = urls.length > 0 ? urls.join(',') : null
    }
    setUploading(false)
    onSend(parseFloat(itemCost) || 0, parseFloat(deliveryCharge) || 0, items, photoUrl)
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-t-3xl animate-slide-in-bottom" style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-4 pb-2">
          <div className="bottom-sheet-handle" />
          <h3 className="text-lg font-bold text-white mb-4">Send Quotation</h3>
        </div>
        <div className="overflow-y-auto px-5 pb-8 space-y-4" style={{ maxHeight: 'calc(90vh - 80px)' }}>
          <div>
            <label className="label" style={{ color: '#C4D600' }}>Items Summary</label>
            <p className="mb-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Edit the customer's request — each item on its own line.</p>
            <textarea className="input min-h-24 resize-none" value={items} onChange={e => setItems(e.target.value)} placeholder="2kg Rice&#10;1L Milk" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label flex items-center gap-1" style={{ color: '#C4D600' }}><IndianRupee size={12} /> Item Cost</label>
              <input type="number" className="input" value={itemCost} onChange={e => setItemCost(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="label flex items-center gap-1" style={{ color: '#C4D600' }}><IndianRupee size={12} /> Delivery Fee</label>
              <input type="number" className="input" value={deliveryCharge} onChange={e => setDeliveryCharge(e.target.value)} placeholder="0" />
            </div>
          </div>
          <div>
            <label className="label" style={{ color: '#C4D600' }}>Proof Photos <span style={{ color: 'rgba(255,255,255,0.3)', textTransform: 'none', letterSpacing: 0 }}>(up to {MAX_PROOF_PHOTOS})</span></label>
            <input ref={photoInputRef} type="file" className="hidden" accept="image/*" multiple onChange={handlePhotoSelect} />
            {photoPreviews.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {photoPreviews.map((preview, idx) => (
                  <div key={idx} className="relative">
                    <img src={preview} alt={`Proof ${idx + 1}`} className="h-20 w-20 rounded-2xl object-cover" style={{ border: '1px solid rgba(255,255,255,0.1)' }} />
                    <button onClick={() => removePhoto(idx)} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-lg">
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {photoFiles.length < MAX_PROOF_PHOTOS && (
              <button onClick={() => photoInputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm transition-all active:scale-95"
                style={{ background: 'rgba(166,179,0,0.08)', border: '1.5px dashed rgba(166,179,0,0.25)', color: '#A6B300' }}>
                <Camera size={15} /> {photoFiles.length > 0 ? 'Add More Photos' : 'Upload Proof Photos'}
              </button>
            )}
            <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{photoFiles.length}/{MAX_PROOF_PHOTOS} photos</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleSend} disabled={!items || !deliveryCharge || uploading} className="flex-1 btn font-bold disabled:opacity-40 rounded-xl py-3 transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, #A6B300, #808000)', color: '#0B0B0B', boxShadow: '0 8px 24px rgba(166,179,0,0.35)' }}>
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
      <div className="w-full max-w-md rounded-t-3xl p-6 animate-slide-in-bottom" style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)' }} onClick={e => e.stopPropagation()}>
        <div className="bottom-sheet-handle" />
        <h3 className="text-lg font-bold text-white text-center">Rate {targetName}</h3>
        <p className="mt-1 mb-6 text-sm text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>How was your experience?</p>
        <div className="mb-2 flex justify-center gap-3">
          {[1, 2, 3, 4, 5].map(i => (
            <button key={i} onClick={() => setStars(i)} className="transition-transform active:scale-90">
              <svg width={40} height={40} viewBox="0 0 24 24" fill={i <= stars ? '#A6B300' : 'none'} stroke={i <= stars ? '#A6B300' : 'rgba(255,255,255,0.2)'} strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>
          ))}
        </div>
        <p className="mb-4 text-center font-semibold" style={{ color: '#A6B300' }}>{labels[stars]}</p>
        <textarea className="input min-h-20 resize-none mb-4" value={review} onChange={e => setReview(e.target.value)} placeholder="Leave a review (optional)" />
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Skip</button>
          <button onClick={() => onSubmit(stars, review)} className="flex-1 btn font-bold rounded-xl py-3"
            style={{ background: '#A6B300', color: '#0B0B0B' }}>Submit</button>
        </div>
      </div>
    </div>
  )
}

// V3: Advance Payment Modal — DP sends a premium payment card inside chat
function AdvancePaymentModal({ onClose, roomId, request, dpId, onSent }: {
  onClose: () => void
  roomId: string
  request: any
  dpId: string
  onSent: () => void
}) {
  const [amount, setAmount] = useState('')
  const [deadline, setDeadline] = useState('120')
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    if (!amount || parseFloat(amount) <= 0) return
    setSending(true)
    try {
      const deadlineMinutes = parseInt(deadline) || 120
      const paymentDeadline = new Date(Date.now() + deadlineMinutes * 60000).toISOString()
      const bookingId = request.id

      const { data: ap, error } = await supabase.from('advance_payments').insert({
        request_id: request.id,
        chat_room_id: roomId,
        dp_id: dpId,
        customer_id: request.user_id,
        amount: parseFloat(amount),
        payment_deadline: paymentDeadline,
        status: 'waiting',
      }).select('id').single()
      if (error) throw error

      await supabase.from('requests').update({
        status: 'waiting_payment',
        advance_payment_id: ap.id,
        payment_deadline: paymentDeadline,
      }).eq('id', request.id)

      await supabase.from('messages').insert({
        chat_room_id: roomId,
        sender_id: dpId,
        message_type: 'advance_payment',
        advance_payment_id: ap.id,
        quotation_data: {
          booking_id: bookingId,
          scheduled_date: request.scheduled_date,
          scheduled_time: request.scheduled_slot || request.scheduled_time,
          amount: parseFloat(amount),
          payment_deadline: new Date(paymentDeadline).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
          purpose: 'Advance Booking Confirmation',
          status: 'waiting',
        },
      })

      await supabase.from('notifications').insert({
        user_id: request.user_id,
        title: 'Payment Request',
        body: `Your delivery partner has requested an advance confirmation payment of ₹${amount}. Please upload your payment proof in chat.`,
        type: 'payment_request',
        related_id: request.id,
      })

      onSent()
    } catch (e) {
      console.error('AdvancePaymentModal error:', e)
      alert('Failed to send payment request. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl glass bottom-sheet max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1"><div className="h-1.5 w-12 rounded-full bg-white/20" /></div>
        <div className="px-5 pb-8 pt-4 space-y-4">
          <div className="flex items-center gap-2">
            <CreditCard size={20} style={{ color: '#A6B300' }} />
            <h3 className="text-lg font-bold text-white">Request Advance Payment</h3>
          </div>
          <p className="text-sm text-white/50">Send a premium payment card to the customer inside this chat. The customer will upload their payment proof here.</p>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/40">Amount (₹)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="200" className="input" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/40">Payment Deadline (minutes)</label>
            <input type="number" value={deadline} onChange={e => setDeadline(e.target.value)} placeholder="120" className="input" />
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleSend} disabled={sending || !amount}
              className="flex-1 rounded-xl py-3 font-bold transition-all active:scale-95 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #A6B300, #808000)', color: '#0B0B0B' }}>
              {sending ? 'Sending...' : 'Send Payment Card'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// V3: Payment Proof Modal — Customer uploads payment screenshot and reference
function PaymentProofModal({ onClose, roomId, advancePaymentId, customerId, onSent }: {
  onClose: () => void
  roomId: string
  advancePaymentId: string
  customerId: string
  onSent: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [upiRef, setUpiRef] = useState('')
  const [txnId, setTxnId] = useState('')
  const [remarks, setRemarks] = useState('')
  const [uploading, setUploading] = useState(false)

  const handleFile = (f: File) => {
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const handleSubmit = async () => {
    if (!file) { alert('Please upload a payment screenshot'); return }
    setUploading(true)
    try {
      const ts = Date.now()
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `payment-proofs/${customerId}/${ts}-${ext}`
      const { error: upErr } = await supabase.storage.from('media').upload(path, file)
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('media').getPublicUrl(path)
      const screenshotUrl = urlData.publicUrl

      await supabase.from('advance_payments').update({
        status: 'proof_uploaded',
        screenshot_url: screenshotUrl,
        upi_ref: upiRef || null,
        transaction_id: txnId || null,
        customer_remarks: remarks || null,
        uploaded_at: new Date().toISOString(),
      }).eq('id', advancePaymentId)

      await supabase.from('messages').insert({
        chat_room_id: roomId,
        sender_id: customerId,
        message_type: 'payment_proof',
        advance_payment_id: advancePaymentId,
        quotation_data: {
          screenshot_url: screenshotUrl,
          upi_ref: upiRef || null,
          transaction_id: txnId || null,
          customer_remarks: remarks || null,
        },
      })

      onSent()
    } catch (e) {
      console.error('PaymentProofModal error:', e)
      alert('Failed to upload payment proof. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl glass bottom-sheet max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1"><div className="h-1.5 w-12 rounded-full bg-white/20" /></div>
        <div className="px-5 pb-8 pt-4 space-y-4">
          <div className="flex items-center gap-2">
            <Upload size={20} style={{ color: '#A6B300' }} />
            <h3 className="text-lg font-bold text-white">Upload Payment Proof</h3>
          </div>
          <p className="text-sm text-white/50">Upload your payment screenshot and enter your UPI reference number or transaction ID.</p>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/40">Payment Screenshot</label>
            <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} className="hidden" id="proof-file" />
            <label htmlFor="proof-file" className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 py-6 text-sm text-white/50 transition-all hover:border-[#A6B300] hover:text-[#A6B300]">
              {preview ? <img src={preview} alt="Preview" className="h-24 rounded-lg object-cover" /> : <><Camera size={20} /> Tap to upload screenshot</>}
            </label>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/40">UPI Reference Number</label>
            <input value={upiRef} onChange={e => setUpiRef(e.target.value)} placeholder="e.g. 9876543210" className="input" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/40">Transaction ID (optional)</label>
            <input value={txnId} onChange={e => setTxnId(e.target.value)} placeholder="Bank transaction ID" className="input" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/40">Remarks (optional)</label>
            <textarea value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Any notes for the delivery partner" className="input min-h-16 resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleSubmit} disabled={uploading || !file}
              className="flex-1 rounded-xl py-3 font-bold transition-all active:scale-95 disabled:opacity-50"
              style={{ background: '#A6B300', color: '#0B0B0B' }}>
              {uploading ? 'Uploading...' : 'Submit Proof'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// V3: Reject Payment Modal — DP rejects with mandatory reason
function RejectPaymentModal({ onClose, advancePaymentId, dpId, onReject }: {
  onClose: () => void
  advancePaymentId: string
  dpId: string
  onReject: (reason: string) => void
}) {
  const [reason, setReason] = useState('')

  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl glass bottom-sheet" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1"><div className="h-1.5 w-12 rounded-full bg-white/20" /></div>
        <div className="px-5 pb-8 pt-4 space-y-4">
          <div className="flex items-center gap-2">
            <AlertCircle size={20} style={{ color: '#f87171' }} />
            <h3 className="text-lg font-bold text-white">Reject Payment</h3>
          </div>
          <p className="text-sm text-white/50">Please provide a reason for rejecting this payment. This is mandatory.</p>
          <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Payment amount does not match, invalid screenshot..." className="input min-h-24 resize-none" />
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={() => reason.trim() && onReject(reason.trim())} disabled={!reason.trim()}
              className="flex-1 rounded-xl py-3 font-bold transition-all active:scale-95 disabled:opacity-50"
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
              Reject Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AdvanceTaskSummary({ request, statusLabel }: { request: any; statusLabel: string }) {
  const [expanded, setExpanded] = useState(false)
  const photos: string[] = request.photo_urls || []
  const hasVoice = !!request.voice_note_url
  const hasBudget = request.max_budget != null && Number(request.max_budget) > 0
  const hasInstructions = !!request.special_instructions
  const hasDescription = !!request.description
  const category = request.request_category
  const scheduledDate = request.scheduled_date
  const scheduledTime = request.scheduled_slot || request.scheduled_time
  const pickup = request.pickup_address
  const delivery = request.delivery_address

  const Row = ({ icon, label, value }: { icon: any; label: string; value: string }) => (
    <div className="flex items-start gap-2 py-1.5">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg" style={{ background: 'rgba(166,179,0,0.1)' }}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</p>
        <p className="text-sm text-white break-words">{value}</p>
      </div>
    </div>
  )

  return (
    <div className="shrink-0 px-4 pt-3 pb-1" style={{ background: 'rgba(166,179,0,0.04)', borderBottom: '1px solid rgba(166,179,0,0.12)' }}>
      <div className="mx-auto max-w-md">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex w-full items-center justify-between gap-2 py-1.5"
        >
          <div className="flex items-center gap-2">
            <ClipboardList size={15} style={{ color: '#A6B300' }} />
            <span className="text-sm font-bold text-white">Advance Task Summary</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(166,179,0,0.15)', color: '#A6B300', border: '1px solid rgba(166,179,0,0.25)' }}>
              {statusLabel}
            </span>
            {expanded ? <ChevronUp size={16} style={{ color: 'rgba(255,255,255,0.4)' }} /> : <ChevronDown size={16} style={{ color: 'rgba(255,255,255,0.4)' }} />}
          </div>
        </button>

        {expanded && (
          <div className="pb-3 pt-1 animate-fade-in">
            {category && <Row icon={<Tag size={12} style={{ color: '#A6B300' }} />} label="Category" value={category} />}
            {scheduledDate && <Row icon={<CalendarClock size={12} style={{ color: '#A6B300' }} />} label="Scheduled Date" value={scheduledDate} />}
            {scheduledTime && <Row icon={<Clock size={12} style={{ color: '#A6B300' }} />} label="Scheduled Time" value={scheduledTime} />}
            {pickup && <Row icon={<MapPin size={12} style={{ color: '#A6B300' }} />} label="Pickup Address" value={pickup} />}
            {delivery && <Row icon={<Navigation size={12} style={{ color: '#A6B300' }} />} label="Delivery Address" value={delivery} />}
            {hasDescription && <Row icon={<FileText size={12} style={{ color: '#A6B300' }} />} label="Task Description" value={request.description} />}
            {hasBudget && <Row icon={<IndianRupee size={12} style={{ color: '#A6B300' }} />} label="Budget" value={formatCurrency(Number(request.max_budget))} />}
            {hasInstructions && <Row icon={<ShieldCheck size={12} style={{ color: '#A6B300' }} />} label="Special Instructions" value={request.special_instructions} />}

            {photos.length > 0 && (
              <div className="mt-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Photos</p>
                <div className="flex flex-wrap gap-2">
                  {photos.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt={`Photo ${i + 1}`} className="h-16 w-16 rounded-xl object-cover" style={{ border: '1px solid rgba(255,255,255,0.1)' }} />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {hasVoice && (
              <div className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(166,179,0,0.06)' }}>
                <Volume2 size={14} style={{ color: '#A6B300' }} />
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>Voice note attached</span>
                <a href={request.voice_note_url} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs font-semibold" style={{ color: '#A6B300' }}>Play</a>
              </div>
            )}

            <div className="mt-3 flex items-center gap-1.5 rounded-xl px-3 py-2" style={{ background: 'rgba(166,179,0,0.06)' }}>
              <CheckCircle size={12} style={{ color: '#A6B300' }} />
              <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Current Status: <span className="font-bold" style={{ color: '#A6B300' }}>{statusLabel}</span></p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
