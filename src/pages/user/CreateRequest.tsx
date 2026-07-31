import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase } from '../../lib/supabase'
import { ErrorBanner } from '../../components/ui'
import CategorySelectionModal, { type CategorySelection } from '../../components/CategorySelectionModal'
import { Camera, Mic, MicOff, X, Play, Pause, Store, ArrowLeft, Package, Trash2, Plus, ChevronRight, FileText } from 'lucide-react'

type DbCategory = { id: string; name: string; icon: string }

const ICON_MAP: Record<string, string> = {
  Food: '🍱', Medicine: '💊', Grocery: '🛒', Parcel: '📦',
  Courier: '🚀', Gift: '🎁', Laundry: '👔', Documents: '📄',
  Flowers: '🌸', Electronics: '📱',
}

export default function CreateRequest() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [description, setDescription] = useState('')
  const [preferredShop, setPreferredShop] = useState('')
  const [pickupAddress, setPickupAddress] = useState('')
  const [activeCategory, setActiveCategory] = useState<{ name: string; id: string } | null>(null)
  const [selections, setSelections] = useState<CategorySelection[]>([])
  const [categories, setCategories] = useState<DbCategory[]>([])
  const [showDetails, setShowDetails] = useState(false)

  const [gpsLat, setGpsLat] = useState<number | null>(profile?.gps_lat || null)
  const [gpsLng, setGpsLng] = useState<number | null>(profile?.gps_lng || null)

  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [recording, setRecording] = useState(false)
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null)
  const [voiceDuration, setVoiceDuration] = useState(0)
  const [playingVoice, setPlayingVoice] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const voiceUrlRef = useRef<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('categories').select('id, name, icon').eq('is_active', true).order('sort_order')
      .then(({ data }) => setCategories((data as DbCategory[]) || []))
  }, [])

  useEffect(() => {
    if (gpsLat) return
    navigator.geolocation?.getCurrentPosition(
      pos => { setGpsLat(pos.coords.latitude); setGpsLng(pos.coords.longitude) },
      () => {}, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    )
  }, [])

  const handlePhotosSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setPhotoFiles(prev => [...prev, ...files])
    setPhotoPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))])
  }
  const removePhoto = (idx: number) => {
    setPhotoPreviews(prev => { URL.revokeObjectURL(prev[idx]); return prev.filter((_, i) => i !== idx) })
    setPhotoFiles(prev => prev.filter((_, i) => i !== idx))
  }

  const startRecording = async () => {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia) { setError('Microphone not supported.'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : MediaRecorder.isTypeSupported('audio/ogg') ? 'audio/ogg' : 'audio/mp4'
      const mr = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mr; audioChunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        if (voiceUrlRef.current) URL.revokeObjectURL(voiceUrlRef.current)
        voiceUrlRef.current = URL.createObjectURL(blob)
        setVoiceBlob(blob); stream.getTracks().forEach(t => t.stop())
      }
      mr.start(); setRecording(true); setVoiceDuration(0)
      durationTimerRef.current = setInterval(() => setVoiceDuration(d => d + 1), 1000)
    } catch (err: any) { setError('Could not start recording: ' + (err.message || err)) }
  }
  const stopRecording = () => {
    mediaRecorderRef.current?.stop(); setRecording(false)
    if (durationTimerRef.current) { clearInterval(durationTimerRef.current); durationTimerRef.current = null }
  }
  const playVoice = () => {
    if (!voiceUrlRef.current) return
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; setPlayingVoice(false); return }
    const audio = new Audio(voiceUrlRef.current); audioRef.current = audio; setPlayingVoice(true)
    audio.onended = () => { setPlayingVoice(false); audioRef.current = null }
    audio.play().catch(() => { setPlayingVoice(false); audioRef.current = null })
  }
  const clearVoice = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    setPlayingVoice(false); setVoiceBlob(null); setVoiceDuration(0)
    if (voiceUrlRef.current) { URL.revokeObjectURL(voiceUrlRef.current); voiceUrlRef.current = null }
  }

  const uploadToStorage = async (file: File | Blob, path: string): Promise<string | null> => {
    const { error } = await supabase.storage.from('media').upload(path, file, { upsert: true })
    if (error) return null
    return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
  }

  const handleSubmit = async () => {
    setError(null)
    const selectionLines: string[] = []
    selections.forEach(sel => {
      selectionLines.push(`[${sel.category}]`)
      sel.items.forEach(item => {
        const priceStr = item.price > 0 ? ` ₹${item.price}` : ''
        selectionLines.push(`  ${item.name} ×${item.quantity}${priceStr}`)
      })
    })
    const fullDescription = [...selectionLines, description.trim()].filter(Boolean).join('\n')
    if (!fullDescription.trim()) { setError('Please select items or add a description'); return }
    setLoading(true)
    try {
      if (recording) stopRecording()
      const ts = Date.now()
      const photoUrls: string[] = []
      for (let i = 0; i < photoFiles.length; i++) {
        const url = await uploadToStorage(photoFiles[i], `requests/${profile!.id}/${ts}-photo-${i}`)
        if (url) photoUrls.push(url)
      }
      const voiceUrl = voiceBlob ? await uploadToStorage(voiceBlob, `requests/${profile!.id}/${ts}-voice.webm`) : null
      const { data: inserted, error } = await supabase.from('requests').insert({
        user_id: profile!.id, description: fullDescription,
        photo_urls: photoUrls.length > 0 ? photoUrls : null, voice_note_url: voiceUrl,
        preferred_shop: preferredShop.trim() || null, pickup_address: pickupAddress.trim() || null,
        delivery_address: profile?.address || null,
        pickup_lat: gpsLat, pickup_lng: gpsLng, delivery_lat: gpsLat, delivery_lng: gpsLng,
        expected_time: null, max_budget: null, special_instructions: null, radius_meters: 0, status: 'pending',
      }).select('id').single()
      if (error) throw error
      navigate(`/app/scanning/${inserted.id}`)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const totalItems = selections.reduce((s, sel) => s + sel.items.length, 0)
  const canSubmit = (selections.length > 0 || description.trim().length > 0) && !loading

  return (
    <div className="flex flex-col bg-[#0B0B0B] min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3.5" style={{ background: 'rgba(11,11,11,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <button type="button" onClick={() => navigate('/app')} className="btn-icon">
          <ArrowLeft size={20} style={{ color: 'rgba(255,255,255,0.7)' }} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white">New Request</h1>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Tell us what you need</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-32 px-4 pt-5 space-y-5">
        {/* Delivery Address Card */}
        <div className="card p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl" style={{ background: 'rgba(239,68,68,0.15)' }}>
            <span className="text-lg">📍</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Deliver To</p>
            <p className="text-sm font-medium text-white truncate">{profile?.address || 'Your registered address'}</p>
          </div>
          <ChevronRight size={16} style={{ color: 'rgba(255,255,255,0.3)' }} />
        </div>

        {/* Category Grid */}
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>What do you need?</p>
          <div className="grid grid-cols-4 gap-2.5">
            {categories.map(cat => {
              const sel = selections.find(s => s.category === cat.name)
              return (
                <button key={cat.id} type="button" onClick={() => setActiveCategory({ name: cat.name, id: cat.id })}
                  className="relative flex flex-col items-center gap-2 rounded-2xl p-3 transition-all active:scale-90"
                  style={sel
                    ? { background: 'rgba(166,179,0,0.15)', border: '1.5px solid rgba(166,179,0,0.4)' }
                    : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <span className="text-2xl">{ICON_MAP[cat.name] || cat.icon}</span>
                  <span className="text-center text-[10px] font-semibold leading-tight" style={{ color: sel ? '#A6B300' : 'rgba(255,255,255,0.55)' }}>
                    {cat.name}
                  </span>
                  {sel && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-[#0B0B0B]" style={{ background: '#A6B300' }}>
                      {sel.items.length}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected Items Summary */}
        {selections.length > 0 && (
          <div className="space-y-2 animate-slide-up">
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Selected Items</p>
            {selections.map(sel => (
              <div key={sel.category} className="card-elevated p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{ICON_MAP[sel.category] || '📦'}</span>
                    <p className="font-bold text-white text-sm">{sel.category}</p>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(166,179,0,0.2)', color: '#A6B300' }}>
                      {sel.items.length} item{sel.items.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <button type="button" onClick={() => setSelections(prev => prev.filter(s => s.category !== sel.category))}
                    className="flex h-7 w-7 items-center justify-center rounded-xl transition-colors"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sel.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <span className="font-semibold text-white">{item.name}</span>
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>×{item.quantity}</span>
                      {item.price > 0 && <span style={{ color: '#A6B300' }}>₹{item.quantity * item.price}</span>}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setActiveCategory({ name: sel.category, id: categories.find(c => c.name === sel.category)?.id || '' })}
                  className="mt-3 flex items-center gap-1 text-xs font-medium" style={{ color: '#A6B300' }}>
                  <Plus size={12} /> Edit items
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="label flex items-center gap-1.5">
            <FileText size={12} /> Extra Notes
            <span style={{ color: 'rgba(255,255,255,0.3)', textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
          </label>
          <textarea className="input min-h-[90px] resize-none" value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Brand preferences, specific instructions, or anything else..." />
        </div>

        {/* Photos */}
        <div>
          <label className="label flex items-center gap-1.5"><Camera size={12} /> Add Photos</label>
          <input ref={photoInputRef} type="file" className="hidden" accept="image/*" multiple onChange={handlePhotosSelect} />
          {photoPreviews.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {photoPreviews.map((preview, idx) => (
                <div key={idx} className="relative">
                  <img src={preview} alt={`Photo ${idx + 1}`} className="h-20 w-20 rounded-2xl object-cover" style={{ border: '1px solid rgba(255,255,255,0.1)' }} />
                  <button type="button" onClick={() => removePhoto(idx)}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-lg">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={() => photoInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-medium transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1.5px dashed rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)' }}>
            <Camera size={16} />
            {photoPreviews.length > 0 ? 'Add More Photos' : 'Add Reference Photos'}
          </button>
        </div>

        {/* Voice Note */}
        <div>
          <label className="label flex items-center gap-1.5"><Mic size={12} /> Voice Note</label>
          {voiceBlob ? (
            <div className="flex items-center gap-3 rounded-2xl px-4 py-3.5" style={{ background: 'rgba(166,179,0,0.08)', border: '1px solid rgba(166,179,0,0.2)' }}>
              <button type="button" onClick={playVoice}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-all active:scale-90"
                style={{ background: '#A6B300' }}>
                {playingVoice ? <Pause size={16} className="text-[#0B0B0B]" /> : <Play size={16} className="text-[#0B0B0B]" />}
              </button>
              <div className="flex-1">
                <div className="flex items-center gap-1 mb-1.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className={`voice-wave-bar ${playingVoice ? '' : ''}`}
                      style={{ height: `${12 + Math.random() * 16}px`, opacity: playingVoice ? 1 : 0.4 }} />
                  ))}
                </div>
                <p className="text-xs font-semibold" style={{ color: '#A6B300' }}>Voice Note · {fmtDur(voiceDuration)}</p>
              </div>
              <button type="button" onClick={clearVoice} className="p-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                <X size={16} />
              </button>
            </div>
          ) : recording ? (
            <button type="button" onClick={stopRecording}
              className="flex w-full items-center justify-center gap-3 rounded-2xl py-4 text-sm font-semibold"
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="voice-wave-bar" style={{ height: `${12 + Math.random() * 16}px`, background: '#ef4444' }} />
                ))}
              </div>
              <MicOff size={18} /> Stop · {fmtDur(voiceDuration)}
            </button>
          ) : (
            <button type="button" onClick={startRecording}
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-medium transition-all active:scale-95"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1.5px dashed rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)' }}>
              <Mic size={16} /> Record Voice Note
            </button>
          )}
        </div>

        {/* Optional Details Toggle */}
        <button type="button" onClick={() => setShowDetails(!showDetails)}
          className="flex w-full items-center justify-between rounded-2xl px-4 py-3.5 transition-colors active:scale-95"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
          <span className="flex items-center gap-2 text-sm font-medium">
            <Store size={15} /> Additional Details
          </span>
          <ChevronRight size={16} className={`transition-transform ${showDetails ? 'rotate-90' : ''}`} />
        </button>

        {showDetails && (
          <div className="space-y-3 animate-slide-up">
            <div>
              <label className="label">Preferred Shop <span style={{ color: 'rgba(255,255,255,0.3)', textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
              <input className="input" value={preferredShop} onChange={e => setPreferredShop(e.target.value)} placeholder="e.g. Reliance Fresh, Main Road" />
            </div>
            <div>
              <label className="label">Pickup Location <span style={{ color: 'rgba(255,255,255,0.3)', textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
              <input className="input" value={pickupAddress} onChange={e => setPickupAddress(e.target.value)} placeholder="Where the partner should pick up items" />
            </div>
          </div>
        )}

        {error && <ErrorBanner message={error} />}
      </div>

      {/* Sticky Submit Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-10 px-4 py-4" style={{ background: 'rgba(11,11,11,0.95)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="mx-auto max-w-md">
          {totalItems > 0 && (
            <div className="mb-3 flex items-center justify-between text-sm">
              <span style={{ color: 'rgba(255,255,255,0.45)' }}>{totalItems} item{totalItems !== 1 ? 's' : ''} selected</span>
              <span className="font-semibold" style={{ color: '#A6B300' }}>Ready to submit</span>
            </div>
          )}
          <button type="button" onClick={handleSubmit} disabled={!canSubmit}
            className="btn-primary w-full py-4 text-base font-bold disabled:opacity-40"
            style={{ background: canSubmit ? '#A6B300' : undefined, color: '#0B0B0B' }}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0B0B0B]/30" style={{ borderTopColor: '#0B0B0B' }} />
                Submitting...
              </span>
            ) : (
              <span className="flex items-center gap-2"><Package size={18} strokeWidth={2.5} /> Submit Request</span>
            )}
          </button>
        </div>
      </div>

      {activeCategory && (
        <CategorySelectionModal
          category={activeCategory.name} categoryId={activeCategory.id}
          onClose={() => setActiveCategory(null)}
          onSave={(selection) => {
            setSelections(prev => [...prev.filter(s => s.category !== selection.category), selection])
            setActiveCategory(null)
          }}
        />
      )}
    </div>
  )
}
