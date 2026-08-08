import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context'
import { supabase } from '../../lib/supabase'
import { ErrorBanner } from '../../components/ui'
import { getSelectedDeliveryAddress } from '../../components/AddressPicker'
import { Camera, Mic, MicOff, X, Play, Pause, ArrowLeft } from 'lucide-react'
import { Screen, TopChrome, Surface, CTA, SectionLabel, IconButton } from '../../design/primitives'
import { pg } from '../../design/tokens'

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
    <div className="flex min-h-screen flex-col" style={{ background: pg.bg }}>
      <TopChrome
        left={
          <IconButton onClick={() => navigate('/app')}>
            <ArrowLeft size={20} />
          </IconButton>
        }
        center={
          <div>
            <p className="text-base font-extrabold">Instant Request</p>
            <p className="text-[10px]" style={{ color: pg.text3 }}>Photos, voice & notes</p>
          </div>
        }
      />

      <Screen pad className="flex-1 overflow-y-auto pb-28 pt-0">
        <section className="mb-5">
          <SectionLabel title="Photos" />
          <input ref={photoInputRef} type="file" className="hidden" accept="image/*" multiple onChange={handlePhotosSelect} />
          <div className="flex flex-wrap gap-2">
            {photoPreviews.map((preview, idx) => (
              <div key={idx} className="relative">
                <img
                  src={preview}
                  alt=""
                  className="h-20 w-20 rounded-2xl object-cover"
                  style={{ border: `1px solid ${pg.line}` }}
                  draggable={false}
                />
                <button
                  type="button"
                  onClick={() => removePhoto(idx)}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-2xl transition active:scale-95"
              style={{ background: pg.surface, border: `1.5px dashed rgba(212,240,0,0.35)`, color: pg.lime }}
            >
              <Camera size={20} />
              <span className="text-[10px] font-extrabold">Add</span>
            </button>
          </div>
        </section>

        <Surface className="relative p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: pg.lime }}>Notes</p>
            <div className="flex items-center gap-2">
              {recording ? (
                <CTA variant="danger" className="min-h-0 rounded-xl px-3 py-1.5 text-xs" onClick={stopRecording}>
                  <MicOff size={14} /> Stop {fmtDur(voiceDuration)}
                </CTA>
              ) : (
                <CTA variant="secondary" className="min-h-0 rounded-xl px-3 py-1.5 text-xs" onClick={startRecording}>
                  <Mic size={14} /> Voice
                </CTA>
              )}
            </div>
          </div>

          {photoPreviews.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {photoPreviews.map((p, i) => (
                <img key={i} src={p} alt="" className="h-12 w-12 rounded-xl object-cover opacity-90" draggable={false} />
              ))}
            </div>
          )}

          {voiceBlob && voiceUrlRef.current && (
            <div className="mb-3 flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: pg.limeDim, border: '1px solid rgba(212,240,0,0.25)' }}>
              <button
                type="button"
                onClick={playVoice}
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{ background: pg.lime, color: pg.limeText }}
              >
                {playingVoice ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <span className="flex-1 text-xs font-extrabold" style={{ color: pg.lime }}>Voice note · {fmtDur(voiceDuration)}</span>
              <button type="button" onClick={clearVoice}><X size={14} style={{ color: pg.text3 }} /></button>
            </div>
          )}

          <textarea
            className="input min-h-[220px] resize-none text-sm leading-relaxed"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Type what you need… quantities, brands, shop preferences, or extra instructions."
          />
        </Surface>

        {error && <div className="mt-4"><ErrorBanner message={error} /></div>}
      </Screen>

      <div
        className="fixed bottom-0 left-0 right-0 z-20 px-4 pb-6 pt-3"
        style={{ background: `linear-gradient(transparent, ${pg.bg} 35%)` }}
      >
        <CTA className="mx-auto w-full max-w-lg" onClick={handleSubmit} disabled={!canSubmit}>
          {loading ? 'Submitting...' : 'Submit Request'}
        </CTA>
      </div>
    </div>
  )
}
