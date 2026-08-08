import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, MapPin, Store, FileText, Camera, Mic, Play, Pause, Package, Home, Navigation, ShoppingBag } from 'lucide-react'
import { pg } from '../../design/tokens'
import { CTA, IconButton, Surface } from '../../design/primitives'

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: pg.bg, color: pg.text3 }}>
        Loading...
      </div>
    )
  }

  if (!request) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-5" style={{ background: pg.bg }}>
        <p style={{ color: pg.text3 }}>Order not found</p>
        <CTA onClick={() => navigate(-1)}>Back</CTA>
      </div>
    )
  }

  const photos: string[] = request.photo_urls || []

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: pg.bg }}>
      <div
        className="flex items-center gap-3 px-4 py-3.5"
        style={{ borderBottom: `1px solid ${pg.line}`, background: 'rgba(5,5,5,0.95)', backdropFilter: 'blur(20px)' }}
      >
        <IconButton onClick={() => navigate(-1)} className="!h-10 !w-10">
          <ArrowLeft size={18} />
        </IconButton>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: pg.lime }}>Order</p>
          <h1 className="truncate text-lg font-extrabold tracking-tight">Full Order Details</h1>
          <p className="text-xs" style={{ color: pg.text4 }}>Everything the customer entered</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto max-w-md space-y-4">
          {request.description && (
            <Surface className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <FileText size={16} style={{ color: pg.lime }} />
                <h3 className="text-sm font-extrabold">Notes & Item List</h3>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: pg.text2 }}>{request.description}</p>
            </Surface>
          )}

          {photos.length > 0 && (
            <Surface className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Camera size={16} style={{ color: pg.lime }} />
                <h3 className="text-sm font-extrabold">Photos ({photos.length})</h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setLightboxImage(url)}
                    className="overflow-hidden rounded-2xl"
                    style={{ aspectRatio: '1', border: `1px solid ${pg.line}` }}
                  >
                    <img src={url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </Surface>
          )}

          {request.voice_note_url && (
            <Surface className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Mic size={16} style={{ color: pg.lime }} />
                <h3 className="text-sm font-extrabold">Voice Note</h3>
              </div>
              <button
                type="button"
                onClick={playVoice}
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5"
                style={{ background: pg.limeDim, border: '1px solid rgba(212,240,0,0.22)' }}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: pg.lime }}>
                  {playingVoice ? <Pause size={16} style={{ color: pg.limeText }} /> : <Play size={16} style={{ color: pg.limeText }} />}
                </div>
                <span className="text-sm font-bold" style={{ color: pg.lime }}>
                  {playingVoice ? 'Pause Voice Note' : 'Play Voice Note'}
                </span>
              </button>
            </Surface>
          )}

          {request.preferred_shop && (
            <Surface className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <Store size={16} style={{ color: pg.lime }} />
                <h3 className="text-sm font-extrabold">Preferred Shop</h3>
              </div>
              <p className="text-sm" style={{ color: pg.text2 }}>{request.preferred_shop}</p>
            </Surface>
          )}

          {request.pickup_address && (
            <Surface className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <ShoppingBag size={16} style={{ color: pg.lime }} />
                <h3 className="text-sm font-extrabold">Pickup Location</h3>
              </div>
              <p className="text-sm" style={{ color: pg.text2 }}>{request.pickup_address}</p>
            </Surface>
          )}

          {request.delivery_address && (
            <Surface className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <Home size={16} style={{ color: pg.danger }} />
                <h3 className="text-sm font-extrabold">Delivery Address</h3>
              </div>
              <p className="text-sm" style={{ color: pg.text2 }}>{request.delivery_address}</p>
              {request.delivery_lat && request.delivery_lng && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${request.delivery_lat},${request.delivery_lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold"
                  style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.22)', color: '#93C5FD' }}
                >
                  <Navigation size={13} /> Open in Google Maps
                </a>
              )}
            </Surface>
          )}

          <Surface className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <Package size={16} style={{ color: pg.lime }} />
              <h3 className="text-sm font-extrabold">Order Status</h3>
            </div>
            <p className="text-sm capitalize" style={{ color: pg.text2 }}>{request.status}</p>
          </Surface>
        </div>
      </div>

      {lightboxImage && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.92)' }}
          onClick={() => setLightboxImage(null)}
        >
          <IconButton onClick={() => setLightboxImage(null)} className="absolute right-4 top-4 z-10 !rounded-full">
            <ArrowLeft size={20} />
          </IconButton>
          <img src={lightboxImage} alt="Full size" className="max-h-full max-w-full object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
