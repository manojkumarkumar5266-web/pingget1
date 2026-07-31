import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, MapPin, Store, FileText, Camera, Mic, Play, Pause, Package, Home, Navigation, ShoppingBag } from 'lucide-react'

export default function FullOrderDetails() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const [request, setRequest] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [playingVoice, setPlayingVoice] = useState(false)
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)

  useEffect(() => {
    if (!roomId) return
    const fetchData = async () => {
      const { data: room } = await supabase.from('chat_rooms').select('request_id').eq('id', roomId).maybeSingle()
      if (!room?.request_id) { setLoading(false); return }
      const { data: req } = await supabase.from('requests').select('*').eq('id', room.request_id).maybeSingle()
      setRequest(req)
      setLoading(false)
    }
    fetchData()
  }, [roomId])

  const playVoice = () => {
    if (!request?.voice_note_url) return
    if (audioRef) { audioRef.pause(); setAudioRef(null); setPlayingVoice(false); return }
    const audio = new Audio(request.voice_note_url)
    audio.onended = () => { setPlayingVoice(false); setAudioRef(null) }
    audio.play().catch(() => {})
    setAudioRef(audio)
    setPlayingVoice(true)
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-black text-white/40">Loading...</div>
  if (!request) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black">
      <p className="text-white/50">Order not found</p>
      <button onClick={() => navigate(-1)} className="btn-primary">Back</button>
    </div>
  )

  const photos: string[] = request.photo_urls || []
  const isUser = window.location.pathname.startsWith('/app')

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(11,11,11,0.95)', backdropFilter: 'blur(20px)' }}>
        <button onClick={() => navigate(-1)} className="btn-icon">
          <ArrowLeft size={20} style={{ color: 'rgba(255,255,255,0.7)' }} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white">Full Order Details</h1>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Everything the customer entered</p>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto max-w-md space-y-5">
          {/* Description / Notes */}
          {request.description && (
            <div className="card p-4">
              <div className="mb-2 flex items-center gap-2">
                <FileText size={16} style={{ color: '#A6B300' }} />
                <h3 className="text-sm font-bold text-white">Notes & Item List</h3>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/70">{request.description}</p>
            </div>
          )}

          {/* Photos */}
          {photos.length > 0 && (
            <div className="card p-4">
              <div className="mb-3 flex items-center gap-2">
                <Camera size={16} style={{ color: '#A6B300' }} />
                <h3 className="text-sm font-bold text-white">Photos ({photos.length})</h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((url, i) => (
                  <button key={i} onClick={() => setLightboxImage(url)}
                    className="overflow-hidden rounded-xl" style={{ aspectRatio: '1' }}>
                    <img src={url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Voice Note */}
          {request.voice_note_url && (
            <div className="card p-4">
              <div className="mb-3 flex items-center gap-2">
                <Mic size={16} style={{ color: '#A6B300' }} />
                <h3 className="text-sm font-bold text-white">Voice Note</h3>
              </div>
              <button onClick={playVoice}
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5"
                style={{ background: 'rgba(166,179,0,0.08)', border: '1px solid rgba(166,179,0,0.2)' }}>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: '#A6B300' }}>
                  {playingVoice ? <Pause size={16} className="text-[#0B0B0B]" /> : <Play size={16} className="text-[#0B0B0B]" />}
                </div>
                <span className="text-sm font-medium" style={{ color: '#A6B300' }}>
                  {playingVoice ? 'Pause Voice Note' : 'Play Voice Note'}
                </span>
              </button>
            </div>
          )}

          {/* Preferred Shop */}
          {request.preferred_shop && (
            <div className="card p-4">
              <div className="mb-2 flex items-center gap-2">
                <Store size={16} style={{ color: '#A6B300' }} />
                <h3 className="text-sm font-bold text-white">Preferred Shop</h3>
              </div>
              <p className="text-sm text-white/70">{request.preferred_shop}</p>
            </div>
          )}

          {/* Pickup Location */}
          {request.pickup_address && (
            <div className="card p-4">
              <div className="mb-2 flex items-center gap-2">
                <ShoppingBag size={16} style={{ color: '#A6B300' }} />
                <h3 className="text-sm font-bold text-white">Pickup Location</h3>
              </div>
              <p className="text-sm text-white/70">{request.pickup_address}</p>
            </div>
          )}

          {/* Delivery Address */}
          {request.delivery_address && (
            <div className="card p-4">
              <div className="mb-2 flex items-center gap-2">
                <Home size={16} className="text-red-400" />
                <h3 className="text-sm font-bold text-white">Delivery Address</h3>
              </div>
              <p className="text-sm text-white/70">{request.delivery_address}</p>
              {request.delivery_lat && request.delivery_lng && (
                <a href={`https://www.google.com/maps/search/?api=1&query=${request.delivery_lat},${request.delivery_lng}`}
                  target="_blank" rel="noopener noreferrer"
                  className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold"
                  style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa' }}>
                  <Navigation size={13} /> Open in Google Maps
                </a>
              )}
            </div>
          )}

          {/* Status */}
          <div className="card p-4">
            <div className="mb-2 flex items-center gap-2">
              <Package size={16} style={{ color: '#A6B300' }} />
              <h3 className="text-sm font-bold text-white">Order Status</h3>
            </div>
            <p className="text-sm capitalize text-white/70">{request.status}</p>
          </div>
        </div>
      </div>

      {/* Image lightbox */}
      {lightboxImage && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 animate-fade-in" onClick={() => setLightboxImage(null)}>
          <button className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10" onClick={() => setLightboxImage(null)}>
            <ArrowLeft size={20} className="text-white" />
          </button>
          <img src={lightboxImage} alt="Full size" className="max-h-full max-w-full object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
