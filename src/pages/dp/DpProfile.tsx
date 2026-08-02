import { useAuth } from '../../context'
import { Avatar, StarRating } from '../../components/ui'
import { Mail, Phone, MapPin, Bike, LogOut, Shield, Headphones, ChevronRight, Edit2, Camera, X, Check } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { supabase, DeliveryPartner } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { compressImage } from '../../lib/imageCompress'

export default function DpProfile() {
  const { profile, signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [dp, setDp] = useState<DeliveryPartner | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [editingAddress, setEditingAddress] = useState(false)
  const [addressValue, setAddressValue] = useState('')
  const [cityValue, setCityValue] = useState('')
  const [savingAddress, setSavingAddress] = useState(false)
  const [photoRequired, setPhotoRequired] = useState(false)

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('delivery_partners')
        .select('*')
        .eq('user_id', profile!.id)
        .maybeSingle()
      setDp(data as DeliveryPartner)
    }
    fetch()
  }, [profile])

  useEffect(() => {
    setPhotoRequired(!profile?.photo_url)
  }, [profile?.photo_url])

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const compressed = await compressImage(file)
      const path = `${profile!.id}/avatar-${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, compressed, { upsert: true, contentType: 'image/jpeg' })
      if (upErr) throw upErr
      const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
      const { error: dbErr } = await supabase.from('profiles').update({ photo_url: url }).eq('id', profile!.id)
      if (dbErr) throw dbErr
      await refreshProfile()
      setPhotoRequired(false)
    } catch (err: any) {
      console.error('Photo upload failed:', err)
      alert('Failed to update photo. Please try again.')
    }
    setUploadingPhoto(false)
    e.target.value = ''
  }

  const saveAddress = async () => {
    if (!profile?.id) return
    setSavingAddress(true)
    await supabase.from('profiles').update({ address: addressValue.trim() || null, city: cityValue.trim() || null }).eq('id', profile.id)
    await refreshProfile()
    setSavingAddress(false)
    setEditingAddress(false)
  }

  return (
    <div className="mx-auto max-w-md px-4 py-4">
      {/* Profile header */}
      <div className="card overflow-hidden mb-4 animate-slide-up">
        <div className="h-24 bg-gradient-to-br from-primary-600 to-primary-800" />
        <div className="px-4 pb-4">
          <div className="relative -mt-12 flex items-end justify-between">
            <div className="relative">
              <Avatar url={profile?.photo_url} name={profile?.full_name || 'DP'} size={80} />
              <button
                onClick={() => cameraRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-white shadow-md active:scale-90 transition-transform"
              >
                <Camera size={14} />
              </button>
              <input ref={cameraRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handlePhotoCapture} />
            </div>
            <span className={`badge mb-2 ${dp?.status === 'approved' ? 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300' : 'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-300'}`}>
              <Shield size={12} /> {dp?.status || 'pending'}
            </span>
          </div>
          <div className="mt-3">
            <h2 className="text-lg font-bold text-white">{profile?.full_name}</h2>
            <p className="text-sm text-white/50">Delivery Partner</p>
            {photoRequired && (
              <p className="mt-1.5 text-xs font-medium text-yellow-400">Please take a live photo to complete your profile</p>
            )}
            {uploadingPhoto && <p className="mt-1.5 text-xs text-white/50">Uploading photo...</p>}
            {dp && dp.rating_count > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <StarRating value={dp.rating_avg} size={16} />
                <span className="text-sm font-medium text-white/60">{dp.rating_avg.toFixed(1)} ({dp.rating_count})</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contact info */}
      <div className="card overflow-hidden mb-4 animate-slide-up" style={{ animationDelay: '50ms' }}>
        <div className="flex items-center gap-3 border-b border-gray-50 dark:border-gray-800 px-4 py-3.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl glass">
            <Phone size={16} className="text-gray-500" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-white/40">Phone</p>
            <p className="text-sm font-medium text-white">{profile?.phone || 'Not set'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl glass">
            <MapPin size={16} className="text-gray-500" />
          </div>
          <div className="flex-1">
            {editingAddress ? (
              <div className="space-y-2">
                <input className="input text-sm" value={addressValue} onChange={e => setAddressValue(e.target.value)} placeholder="Enter your address" />
                <input className="input text-sm" value={cityValue} onChange={e => setCityValue(e.target.value)} placeholder="City" />
                <div className="flex gap-2">
                  <button onClick={saveAddress} disabled={savingAddress} className="btn-primary text-xs py-2" style={{ background: '#A6B300', color: '#0B0B0B' }}>
                    <Check size={14} /> {savingAddress ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setEditingAddress(false)} className="btn-secondary text-xs py-2">
                    <X size={14} /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs text-white/40">Address</p>
                <p className="text-sm font-medium text-white">{profile?.address || 'Not set'}</p>
                <p className="text-xs text-white/40">{profile?.city}</p>
                <button onClick={() => { setAddressValue(profile?.address || ''); setCityValue(profile?.city || ''); setEditingAddress(true) }}
                  className="mt-1 flex items-center gap-1 text-xs font-semibold" style={{ color: '#A6B300' }}>
                  <Edit2 size={11} /> {profile?.address ? 'Edit Address' : 'Add Address'}
                </button>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 border-t border-gray-50 dark:border-gray-800 px-4 py-3.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl glass">
            <Bike size={16} className="text-gray-500" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-white/40">Vehicle</p>
            <p className="text-sm font-medium text-white">{dp?.vehicle_type || 'Bike'}</p>
          </div>
        </div>
      </div>

      {/* UPI */}
      {dp?.upi_id && (
        <div className="card mb-4 p-4 flex items-center gap-3 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl glass">
            <span className="text-sm font-bold text-gray-500">₹</span>
          </div>
          <div>
            <p className="text-xs text-white/40">UPI ID</p>
            <p className="text-sm font-medium text-white">{dp.upi_id}</p>
          </div>
        </div>
      )}

      {/* Customer Service */}
      <div className="card mb-4 p-4 animate-slide-up" style={{ animationDelay: '150ms' }}>
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/40">
            <Headphones size={16} className="text-primary-600 dark:text-primary-400" />
          </div>
          <h3 className="text-sm font-bold text-white">Customer Service</h3>
        </div>
        <p className="mb-3 text-xs text-white/50">
          Send us an email with your request and our customer care executive will reach out to you shortly.
        </p>
        <a
          href="mailto:support@pingget.in"
          className="flex items-center gap-3 rounded-xl bg-primary-50 px-4 py-3 transition-all active:scale-[0.98] dark:bg-primary-900/20"
        >
          <Mail size={16} className="text-primary-600 dark:text-primary-400" />
          <span className="text-sm font-semibold text-primary-700 dark:text-primary-300">support@pingget.in</span>
          <ChevronRight size={16} className="ml-auto text-primary-400" />
        </a>
      </div>

      <button onClick={() => signOut()} className="btn-danger w-full animate-slide-up" style={{ animationDelay: '200ms' }}>
        <LogOut size={18} /> Sign Out
      </button>

      <p className="mt-4 text-center text-xs text-white/40">PingGET v1.0.0</p>
    </div>
  )
}
