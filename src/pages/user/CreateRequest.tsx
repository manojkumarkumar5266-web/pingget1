import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase } from '../../lib/supabase'
import { ErrorBanner } from '../../components/ui'
import { getSelectedDeliveryAddress } from '../../components/AddressPicker'
import { Camera, Mic, MicOff, X, Play, Pause, ArrowLeft } from 'lucide-react'

const DRAFT_KEY = 'cr_notes_draft'

/**
 * Instant booking — single notes page:
 * photos + voice (top-right) + text, then Submit → scanning.
 * Delivery address comes from Home (AddressPicker).
 */
export default function CreateRequest() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [description, setDescription] = useState(() => sessionStorage.getItem(DRAFT_KEY) || '')
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

  useEffect(() => { sessionStorage.setItem(DRAFT_KEY, description) }, [description])

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
    if (!profile?.id) return
    if (!description.trim() && photoFiles.length === 0 && !voiceBlob) {
      setError('Add notes, a photo, or a voice note'); return
    }
    const addr = await getSelectedDeliveryAddress(profile.id)
    if (!addr?.text) {
      setError('Please select a delivery address on the Home page first'); return
    }
    setLoading(true)
    try {
      if (recording) stopRecording()
      const ts = Date.now()
      const photoUrls: string[] = []
      for (let i = 0; i < photoFiles.length; i++) {
        const url = await uploadToStorage(photoFiles[i], `requests/${profile.id}/${ts}-photo-${i}`)
        if (url) photoUrls.push(url)
      }
      const voiceUrl = voiceBlob ? await uploadToStorage(voiceBlob, `requests/${profile.id}/${ts}-voice.webm`) : null
      const { data: inserted, error: err } = await supabase.from('requests').insert({
        user_id: profile.id,
        description: description.trim() || 'Instant request',
        photo_urls: photoUrls.length > 0 ? photoUrls : null,
        voice_note_url: voiceUrl,
        delivery_address: addr.text,
        delivery_lat: addr.lat,
        delivery_lng: addr.lng,
        order_type: 'instant',
        radius_meters: 10000,
        status: 'pending',
      }).select('id').single()
      if (err) throw err
      sessionStorage.removeItem(DRAFT_KEY)
      navigate(`/app/scanning/${inserted.id}`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const canSubmit = (description.trim().length > 0 || photoFiles.length > 0 || !!voiceBlob) && !loading

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#0B0B0B' }}>
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-4" style={{ background: '#0B0B0B', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <button type="button" onClick={() => navigate('/app')}
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <ArrowLeft size={20} style={{ color: '#fff' }} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white">New Request</h1>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Add photos, voice & notes</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-32 space-y-4">
        {/* Photos */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: '#C4D600' }}>
            Add Photos (items, shopping list, prescription)
          </p>
          <input ref={photoInputRef} type="file" className="hidden" accept="image/*" multiple onChange={handlePhotosSelect} />
          <div className="flex flex-wrap gap-2">
            {photoPreviews.map((preview, idx) => (
              <div key={idx} className="relative">
                <img src={preview} alt="" className="h-20 w-20 rounded-2xl object-cover" style={{ border: '1px solid rgba(255,255,255,0.1)' }} />
                <button type="button" onClick={() => removePhoto(idx)}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white">
                  <X size={10} />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => photoInputRef.current?.click()}
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1.5px dashed rgba(166,179,0,0.35)', color: '#A6B300' }}>
              <Camera size={20} />
              <span className="text-[10px] font-semibold">Add</span>
            </button>
          </div>
        </div>

        {/* Notes card with voice on top-right */}
        <div className="rounded-2xl p-4 relative" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#C4D600' }}>Notes</p>
            <div className="flex items-center gap-2">
              {recording ? (
                <button type="button" onClick={stopRecording}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold"
                  style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                  <MicOff size={14} /> Stop {fmtDur(voiceDuration)}
                </button>
              ) : (
                <button type="button" onClick={startRecording}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold"
                  style={{ background: 'rgba(166,179,0,0.15)', color: '#A6B300' }}>
                  <Mic size={14} /> Voice
                </button>
              )}
            </div>
          </div>

          {/* Reflect photos inside notes */}
          {photoPreviews.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {photoPreviews.map((p, i) => (
                <img key={i} src={p} alt="" className="h-12 w-12 rounded-lg object-cover opacity-90" />
              ))}
            </div>
          )}

          {/* Reflect voice inside notes */}
          {voiceBlob && voiceUrlRef.current && (
            <div className="mb-3 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(166,179,0,0.1)', border: '1px solid rgba(166,179,0,0.25)' }}>
              <button type="button" onClick={playVoice} className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: '#A6B300' }}>
                {playingVoice ? <Pause size={14} className="text-[#0B0B0B]" /> : <Play size={14} className="text-[#0B0B0B]" />}
              </button>
              <span className="flex-1 text-xs font-medium" style={{ color: '#A6B300' }}>Voice note · {fmtDur(voiceDuration)}</span>
              <button type="button" onClick={clearVoice}><X size={14} style={{ color: 'rgba(255,255,255,0.4)' }} /></button>
            </div>
          )}

          <textarea
            className="input min-h-[220px] resize-none text-sm leading-relaxed"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Type what you need… quantities, brands, shop preferences, or extra instructions."
          />
        </div>

        {error && <ErrorBanner message={error} />}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 px-4 pb-6 pt-3" style={{ background: 'linear-gradient(transparent, #0B0B0B 30%)' }}>
        <button type="button" onClick={handleSubmit} disabled={!canSubmit}
          className="mx-auto block w-full max-w-md rounded-2xl py-4 text-base font-bold disabled:opacity-40"
          style={{ background: '#A6B300', color: '#0B0B0B' }}>
          {loading ? 'Submitting...' : 'Submit'}
        </button>
      </div>
    </div>
  )
}
