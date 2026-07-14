import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase } from '../../lib/supabase'
import { ErrorBanner } from '../../components/ui'
import { Camera, Mic, MicOff, X, Play, Pause, Store, ArrowLeft, Image as ImageIcon, Package } from 'lucide-react'

export default function CreateRequest() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [description, setDescription] = useState('')
  const [preferredShop, setPreferredShop] = useState('')
  const [pickupAddress, setPickupAddress] = useState('')

  // Auto-detect GPS silently — not shown to user, but sent to DP
  const [gpsLat, setGpsLat] = useState<number | null>(profile?.gps_lat || null)
  const [gpsLng, setGpsLng] = useState<number | null>(profile?.gps_lng || null)

  // Multiple photos
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Voice note
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

  // Silent GPS detection
  useEffect(() => {
    if (gpsLat) return
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      pos => { setGpsLat(pos.coords.latitude); setGpsLng(pos.coords.longitude) },
      () => {},
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    )
  }, [])

  const handlePhotosSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    const newPreviews = files.map(f => URL.createObjectURL(f))
    setPhotoFiles(prev => [...prev, ...files])
    setPhotoPreviews(prev => [...prev, ...newPreviews])
  }

  const removePhoto = (idx: number) => {
    setPhotoPreviews(prev => {
      URL.revokeObjectURL(prev[idx])
      return prev.filter((_, i) => i !== idx)
    })
    setPhotoFiles(prev => prev.filter((_, i) => i !== idx))
  }

  const startRecording = async () => {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone not supported on this device.')
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
      setError('Could not start recording: ' + (err.message || err))
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
    e.preventDefault(); setError(null)
    if (!description.trim()) { setError('Please describe what you need'); return }
    setLoading(true)
    try {
      if (recording) stopRecording()
      const ts = Date.now()

      // Upload all photos
      const photoUrls: string[] = []
      for (let i = 0; i < photoFiles.length; i++) {
        const url = await uploadToStorage(photoFiles[i], `requests/${profile!.id}/${ts}-photo-${i}`)
        if (url) photoUrls.push(url)
      }

      const voiceUrl = voiceBlob ? await uploadToStorage(voiceBlob, `requests/${profile!.id}/${ts}-voice.webm`) : null

      const { error } = await supabase.from('requests').insert({
        user_id: profile!.id,
        title: null,
        description: description.trim(),
        photo_url: photoUrls.length > 0 ? photoUrls[0] : null,
        photo_urls: photoUrls.length > 0 ? photoUrls : null,
        voice_note_url: voiceUrl,
        preferred_shop: preferredShop.trim() || null,
        pickup_address: pickupAddress.trim() || null,
        delivery_address: profile?.address || null,
        delivery_lat: gpsLat, delivery_lng: gpsLng,
        expected_time: null, max_budget: null, special_instructions: null,
        radius_meters: 0, status: 'pending',
      })
      if (error) throw error
      navigate('/app/orders')
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 glass px-4 py-3 flex items-center gap-3">
        <button type="button" onClick={() => navigate('/app')} className="btn-ghost p-2">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-white">New Request</h1>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto max-w-md space-y-4 px-4 py-4">
        {/* What do you need? */}
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'linear-gradient(135deg, rgba(110,140,69,0.3), rgba(66,86,42,0.3))' }}>
              <Package size={16} style={{ color: '#8fa964' }} />
            </div>
            <h2 className="text-sm font-bold text-white">What do you need?</h2>
          </div>
          <textarea
            className="input min-h-24 resize-none"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={"Describe what you need delivered...\ne.g. 2kg rice, 1 litre milk, medicines from Apollo Pharmacy"}
            autoFocus
          />
        </div>

        {/* Photos */}
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'linear-gradient(135deg, rgba(110,140,69,0.3), rgba(66,86,42,0.3))' }}>
              <Camera size={16} style={{ color: '#8fa964' }} />
            </div>
            <h2 className="text-sm font-bold text-white">Add Photos</h2>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>for DP reference</span>
          </div>

          <input ref={photoInputRef} type="file" className="hidden" accept="image/*" multiple onChange={handlePhotosSelect} />

          {photoPreviews.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {photoPreviews.map((preview, idx) => (
                <div key={idx} className="relative">
                  <img src={preview} alt={`Photo ${idx + 1}`} className="h-20 w-20 rounded-xl object-cover" />
                  <button type="button" onClick={() => removePhoto(idx)}
                    className="absolute -right-1 -top-1 rounded-full bg-red-500 p-1 text-white shadow">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button type="button" onClick={() => photoInputRef.current?.click()}
            className="w-full rounded-xl border-2 border-dashed py-4 text-sm font-medium transition-all"
            style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.05)' }}>
            <Camera size={18} className="mx-auto mb-1" style={{ color: '#8fa964' }} />
            {photoPreviews.length > 0 ? 'Add More Photos' : 'Add Photos'}
          </button>
        </div>

        {/* Voice Note */}
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'linear-gradient(135deg, rgba(110,140,69,0.3), rgba(66,86,42,0.3))' }}>
              <Mic size={16} style={{ color: '#8fa964' }} />
            </div>
            <h2 className="text-sm font-bold text-white">Voice Note</h2>
          </div>

          {voiceBlob ? (
            <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(110,140,69,0.15)', border: '1px solid rgba(110,140,69,0.25)' }}>
              <button type="button" onClick={playVoice}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
                style={{ background: 'linear-gradient(135deg, #6e8c45, #42562a)' }}>
                {playingVoice ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">Voice Note ({fmtDur(voiceDuration)})</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Tap to play</p>
              </div>
              <button type="button" onClick={clearVoice} style={{ color: 'rgba(255,255,255,0.4)' }}><X size={16} /></button>
            </div>
          ) : recording ? (
            <button type="button" onClick={stopRecording}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white"
              style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <MicOff size={18} /> Stop ({fmtDur(voiceDuration)})
            </button>
          ) : (
            <button type="button" onClick={startRecording}
              className="w-full rounded-xl border-2 border-dashed py-4 text-sm font-medium transition-all"
              style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.05)' }}>
              <Mic size={18} className="mx-auto mb-1" style={{ color: '#8fa964' }} />
              Add Voice Note
            </button>
          )}
        </div>

        {/* Optional details */}
        <div className="card p-5 space-y-3">
          <div>
            <label className="label flex items-center gap-1.5"><Store size={13} /> Preferred Shop <span className="text-white/30">(optional)</span></label>
            <input className="input" value={preferredShop} onChange={e => setPreferredShop(e.target.value)} placeholder="e.g. Reliance Fresh, Main Road" />
          </div>
          <div>
            <label className="label">Pickup Location <span className="text-white/30">(optional)</span></label>
            <input className="input" value={pickupAddress} onChange={e => setPickupAddress(e.target.value)} placeholder="Where the DP should pick up items" />
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
