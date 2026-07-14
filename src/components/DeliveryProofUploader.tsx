import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Camera, X, CheckCircle, Upload, Image as ImageIcon } from 'lucide-react'

type Props = {
  requestId: string
  userId: string
  onUploaded: (url: string) => void
  onClose: () => void
}

export default function DeliveryProofUploader({ requestId, userId, onUploaded, onClose }: Props) {
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    const path = `${userId}/delivery-proof-${requestId}-${Date.now()}`
    const { error } = await supabase.storage.from('media').upload(path, file, { upsert: true })
    if (error) {
      alert('Upload failed: ' + error.message)
      setUploading(false)
      return
    }
    const publicUrl = supabase.storage.from('media').getPublicUrl(path).data.publicUrl
    await supabase.from('requests').update({
      delivery_proof_url: publicUrl,
      delivery_proof_by: userId,
      delivery_proof_at: new Date().toISOString(),
    }).eq('id', requestId)
    setUploaded(true)
    setUploading(false)
    setTimeout(() => {
      onUploaded(publicUrl)
      onClose()
    }, 1200)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 animate-fade-in" onClick={onClose}>
      <div className="card w-full max-w-md p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Delivery Proof Photo</h3>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
        </div>

        {uploaded ? (
          <div className="flex flex-col items-center py-8">
            <CheckCircle size={48} className="text-success-500 mb-3" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Delivery proof uploaded!</p>
          </div>
        ) : preview ? (
          <div className="space-y-4">
            <div className="relative">
              <img src={preview} alt="Delivery proof" className="h-56 w-full rounded-xl object-cover" />
              <button onClick={() => { setPreview(null); setFile(null) }}
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white">
                <X size={16} />
              </button>
            </div>
            <button onClick={handleUpload} disabled={uploading} className="btn-primary w-full">
              {uploading ? 'Uploading...' : 'Upload Proof'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4">
              Take a photo of the delivered items as proof of delivery.
            </p>
            <input ref={cameraRef} type="file" className="hidden" accept="image/*" capture="environment"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <input ref={galleryRef} type="file" className="hidden" accept="image/*"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <button onClick={() => cameraRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-primary-200 bg-primary-50 py-4 text-sm font-semibold text-primary-700 dark:border-primary-900/40 dark:bg-primary-900/20 dark:text-primary-300">
              <Camera size={20} /> Take Photo
            </button>
            <button onClick={() => galleryRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-4 text-sm font-medium text-gray-500 dark:border-gray-700">
              <ImageIcon size={20} /> Choose from Gallery
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
