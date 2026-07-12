import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase } from '../../lib/supabase'
import { ErrorBanner } from '../../components/ui'
import { MapPin, Camera, Mic, MicOff, Clock, IndianRupee, FileText, Store, ArrowLeft, X, Play, Pause } from 'lucide-react'

const RADII = [500, 1000, 2000, 5000]

export default function CreateRequest() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    title: '', description: '', preferred_shop: '',
    pickup_address: '', delivery_address: profile?.address || '',
    expected_time: '', max_budget: '', special_instructions: '',
  })
  const [radius, setRadius] = useState(500)
  const [gpsLat, setGpsLat] = useState<number | null>(profile?.gps_lat || null)
  const [gpsLng, setGpsLng] = useState<number | null>(profile?.gps_lng || null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
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

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const getLocation = () => {
    if (!navigator.geolocation) { setError('Geolocation not supported'); return }
    setGpsLoading(true); setError(null)
    navigator.geolocation.getCurrentPosition(
      pos => { setGpsLat(pos.coords.latitude); setGpsLng(pos.coords.longitude); setGpsLoading(false) },
      () => { setError('Location denied. Please allow location in browser settings.'); setGpsLoading(false) },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
    )
  }

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setPhotoFile(file); setPhotoPreview(URL.createObjectURL(file))
  }

  const startRecording = async () => {
    setError(null)
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
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        if (voiceUrlRef.current) URL.revokeObjectURL(voiceUrlRef.current)
        voiceUrlRef.current = URL.createObjectURL(blob)
        setVoiceBlob(blob)
        stream.getTracks().forEach(t => t.stop())
      }
      mr.start()
      setRecording(true)
      setVoiceDuration(0)
      durationTimerRef.current = setInterval(() => setVoiceDuration(d => d + 1), 1000)
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Microphone permission denied. Please allow microphone access and try again.')
      } else {
        setError('Could not start recording: ' + (err.message || err))
      }
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
    if (durationTimerRef.current) { clearInterval(durationTimerRef.current); durationTimerRef.current = null }
  }

  const playVoice = () => {
    if (!voiceUrlRef.current) return
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; setPlayingVoice(false); return }
    const audio = new Audio(voiceUrlRef.current)
    audioRef.current = audio
    setPlayingVoice(true)
    audio.onended = () => { setPlayingVoice(false); audioRef.current = null }
    audio.onerror = () => { setPlayingVoice(false); audioRef.current = null }
    audio.play().catch(() => { setPlayingVoice(false); audioRef.current = null })
  }

  const clearVoice = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    setPlayingVoice(false)
    setVoiceBlob(null)
    setVoiceDuration(0)
    if (voiceUrlRef.current) { URL.revokeObjectURL(voiceUrlRef.current); voiceUrlRef.current = null }
  }

  const uploadToStorage = async (file: File | Blob, path: string): Promise<string | null> => {
    const { error } = await supabase.storage.from('media').upload(path, file, { upsert: true })
    if (error) return null
    return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setLoading(true)
    try {
      if (recording) stopRecording()
      const ts = Date.now()
      const photoUrl = photoFile ? await uploadToStorage(photoFile, `requests/${profile!.id}/${ts}-photo`) : null
      const voiceUrl = voiceBlob ? await uploadToStorage(voiceBlob, `requests/${profile!.id}/${ts}-voice.webm`) : null

      const { error } = await supabase.from('requests').insert({
        user_id: profile!.id, title: form.title,
        description: form.description || null,
        photo_url: photoUrl, voice_note_url: voiceUrl,
        preferred_shop: form.preferred_shop || null,
        pickup_address: form.pickup_address || null,
        delivery_address: form.delivery_address,
        delivery_lat: gpsLat, delivery_lng: gpsLng,
        expected_time: form.expected_time || null,
        max_budget: form.max_budget ? parseFloat(form.max_budget) : null,
        special_instructions: form.special_instructions || null,
        radius_meters: radius, status: 'pending',
      })
      if (error) throw error
      navigate('/app/orders')
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-100 bg-white/80 px-4 py-3 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/80">
        <button type="button" onClick={() => navigate('/app')} className="btn-ghost p-2"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">New Delivery Request</h1>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto max-w-md space-y-4 px-4 py-4">
        <div className="card p-5 space-y-4">
          <div>
            <label className="label">Request Title *</label>
            <input className="input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Get groceries from local store" required />
          </div>
          <div>
            <label className="label">Description (one item per line)</label>
            <textarea className="input min-h-24 resize-none" value={form.description} onChange={e => set('description', e.target.value)} placeholder={"e.g.\nDolo 650\nPain killer\nAll items"} />
          </div>

          <input ref={photoInputRef} type="file" className="hidden" accept="image/*" capture="environment" onChange={handlePhotoSelect} />
          {photoPreview ? (
            <div className="relative">
              <img src={photoPreview} alt="Request" className="h-40 w-full rounded-xl object-cover" />
              <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null) }} className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white"><X size={14} /></button>
            </div>
          ) : (
            <button type="button" onClick={() => photoInputRef.current?.click()} className="btn-secondary w-full"><Camera size={18} /> Add Photo</button>
          )}

          {voiceBlob ? (
            <div className="flex items-center gap-3 rounded-xl border px-4 py-3" style={{ borderColor: '#afc28e', backgroundColor: '#f4f7ee' }}>
              <button type="button" onClick={playVoice} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: '#556d34' }}>
                {playingVoice ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: '#556d34' }}>Voice Note ({fmtDur(voiceDuration)})</p>
                <p className="text-xs text-gray-500">Tap to play</p>
              </div>
              <button type="button" onClick={clearVoice} className="text-gray-400"><X size={16} /></button>
            </div>
          ) : recording ? (
            <button type="button" onClick={stopRecording} className="flex w-full items-center justify-center gap-2 rounded-xl bg-error-500 py-3 text-sm font-semibold text-white">
              <MicOff size={18} /> Stop Recording ({fmtDur(voiceDuration)})
            </button>
          ) : (
            <button type="button" onClick={startRecording} className="btn-secondary w-full"><Mic size={18} /> Add Voice Note</button>
          )}
        </div>

        <div className="card p-5 space-y-4">
          <div>
            <label className="label flex items-center gap-1.5"><Store size={16} /> Preferred Shop</label>
            <input className="input" value={form.preferred_shop} onChange={e => set('preferred_shop', e.target.value)} placeholder="e.g. Reliance Fresh, Main Road" />
          </div>
          <div>
            <label className="label">Pickup Location (if different)</label>
            <input className="input" value={form.pickup_address} onChange={e => set('pickup_address', e.target.value)} placeholder="Where the DP should pick up items" />
          </div>
          <div>
            <label className="label">Delivery Address *</label>
            <textarea className="input min-h-20 resize-none" value={form.delivery_address} onChange={e => set('delivery_address', e.target.value)} placeholder="Your delivery address" required />
          </div>
          <button type="button" onClick={getLocation} disabled={gpsLoading} className="btn-secondary w-full">
            <MapPin size={18} />
            {gpsLoading ? 'Getting location...' : gpsLat ? `GPS set: ${gpsLat.toFixed(4)}, ${gpsLng!.toFixed(4)}` : 'Set GPS Location'}
          </button>
        </div>

        <div className="card p-5 space-y-4">
          <div>
            <label className="label">Search Radius for Delivery Partners</label>
            <div className="grid grid-cols-4 gap-2">
              {RADII.map(r => (
                <button key={r} type="button" onClick={() => setRadius(r)}
                  className={`rounded-xl border-2 py-2.5 text-sm font-semibold transition-all ${radius === r ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400'}`}
                >
                  {r < 1000 ? `${r}m` : `${r / 1000}km`}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label flex items-center gap-1.5"><Clock size={16} /> Expected Time</label>
              <input className="input" value={form.expected_time} onChange={e => set('expected_time', e.target.value)} placeholder="e.g. 2 hours" />
            </div>
            <div>
              <label className="label flex items-center gap-1.5"><IndianRupee size={16} /> Max Budget</label>
              <input type="number" className="input" value={form.max_budget} onChange={e => set('max_budget', e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div>
            <label className="label flex items-center gap-1.5"><FileText size={16} /> Special Instructions</label>
            <textarea className="input min-h-20 resize-none" value={form.special_instructions} onChange={e => set('special_instructions', e.target.value)} placeholder="Any special instructions for the delivery partner" />
          </div>
        </div>

        {error && <ErrorBanner message={error} />}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Submitting...' : 'Submit Request'}
        </button>
      </form>
    </div>
  )
}
