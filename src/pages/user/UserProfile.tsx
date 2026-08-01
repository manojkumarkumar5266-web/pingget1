import { useAuth } from '../../context'
import { Avatar } from '../../components/ui'
import { Mail, Phone, MapPin, Globe, LogOut, Headphones, Edit2, X, Check, Camera } from 'lucide-react'
import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'

export default function UserProfile() {
  const { profile, signOut, refreshProfile } = useAuth()
  const [editingAddress, setEditingAddress] = useState(false)
  const [addressValue, setAddressValue] = useState('')
  const [cityValue, setCityValue] = useState('')
  const [savingAddress, setSavingAddress] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const cameraRef = useRef<HTMLInputElement>(null)

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    const path = `${profile!.id}/avatar-${Date.now()}`
    const { error } = await supabase.storage.from('media').upload(path, file, { upsert: true })
    if (!error) {
      const url = supabase.storage.from('media').getPublicUrl(path).data.publicUrl
      await supabase.from('profiles').update({ photo_url: url }).eq('id', profile!.id)
      await refreshProfile()
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
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="card mb-4 p-6 text-center animate-slide-up">
        <div className="relative mx-auto mb-3 w-fit">
          <Avatar url={profile?.photo_url} name={profile?.full_name || 'User'} size={80} />
          <button
            onClick={() => cameraRef.current?.click()}
            disabled={uploadingPhoto}
            className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-white shadow-md active:scale-90 transition-transform"
          >
            <Camera size={14} />
          </button>
          <input ref={cameraRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handlePhotoCapture} />
        </div>
        {uploadingPhoto && <p className="text-xs text-white/50 mb-1">Updating photo...</p>}
        <h2 className="text-xl font-bold text-white">{profile?.full_name}</h2>
        <p className="text-sm text-white/50 capitalize">{profile?.role} Account</p>
      </div>

      <div className="card divide-y divide-gray-100 dark:divide-gray-800">
        <div className="flex items-center gap-3 p-4">
          <Mail size={18} className="text-white/40" />
          <div>
            <p className="text-xs text-white/40">Email</p>
            <p className="text-sm font-medium text-white">{profile?.email || 'Verified account'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4">
          <Phone size={18} className="text-white/40" />
          <div>
            <p className="text-xs text-white/40">Phone</p>
            <p className="text-sm font-medium text-white">{profile?.phone || 'Not set'}</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-4">
          <MapPin size={18} className="text-white/40 mt-0.5" />
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
        <div className="flex items-center gap-3 p-4">
          <Globe size={18} className="text-white/40" />
          <div>
            <p className="text-xs text-white/40">Language</p>
            <p className="text-sm font-medium text-white">{profile?.preferred_language === 'en' ? 'English' : profile?.preferred_language}</p>
          </div>
        </div>
      </div>

      {/* Customer Service */}
      <div className="card mt-4 p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: '#efefcc' }}>
            <Headphones size={16} style={{ color: '#808000' }} />
          </div>
          <h3 className="text-sm font-bold text-white">Customer Service</h3>
        </div>
        <p className="mb-3 text-xs text-white/50">
          Send us an email with your request our customer care executive will reach out to you shortly.
        </p>
        <a
          href="mailto:support@pingget.in"
          className="flex items-center gap-3 rounded-xl px-4 py-3 transition-colors active:scale-[0.98]"
          style={{ backgroundColor: '#f8f8ec' }}
        >
          <Mail size={16} style={{ color: '#808000' }} />
          <span className="text-sm font-semibold" style={{ color: '#606000' }}>support@pingget.in</span>
        </a>
      </div>

      <button onClick={() => signOut()} className="btn-danger mt-4 w-full">
        <LogOut size={18} /> Sign Out
      </button>
    </div>
  )
}
