import { useAuth } from '../../context'
import { Avatar } from '../../components/ui'
import { Mail, Phone, MapPin, Globe, LogOut, Edit2, X, Check, Camera } from 'lucide-react'
import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { uploadProfilePhoto } from '../../lib/uploadProfilePhoto'
import { Screen, PageTitle, Surface, CTA } from '../../design/primitives'
import { pg } from '../../design/tokens'
import NeedHelpCard from '../../components/NeedHelpCard'
import { BrandPersonName } from '../../components/Brand'

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
    if (!file || !profile?.id) return
    setUploadingPhoto(true)
    try {
      await uploadProfilePhoto(profile.id, file)
      await refreshProfile()
    } catch (err: any) {
      console.error('Photo upload failed:', err)
      alert(err?.message ? `Photo upload failed: ${err.message}` : 'Failed to update photo. Please try again.')
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

  const infoRows = [
    { icon: Mail, label: 'Email', value: profile?.email || 'Verified account' },
    { icon: Phone, label: 'Phone', value: profile?.phone || 'Not set' },
    { icon: Globe, label: 'Language', value: profile?.preferred_language === 'en' ? 'English' : profile?.preferred_language || '—' },
  ]

  return (
    <Screen className="mx-auto max-w-lg animate-fade-in-up">
      <PageTitle eyebrow="Account" title="Profile" />

      <Surface className="mb-5 overflow-hidden">
        <div className="relative px-5 pb-5 pt-8 text-center">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-24"
            style={{ background: `linear-gradient(180deg, ${pg.limeDim} 0%, transparent 100%)` }}
          />
          <div className="relative mx-auto mb-4 w-fit">
            <Avatar url={profile?.photo_url} name={profile?.full_name || 'User'} size={88} />
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={uploadingPhoto}
              className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full transition active:scale-90"
              style={{ background: pg.lime, color: pg.limeText, boxShadow: '0 4px 16px rgba(196,214,0,0.35)' }}
            >
              <Camera size={16} />
            </button>
            <input ref={cameraRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoCapture} />
          </div>
          {uploadingPhoto && <p className="mb-1 text-xs" style={{ color: pg.text3 }}>Updating photo...</p>}
          <BrandPersonName as="h2" className="text-2xl" style={{ color: pg.text }}>
            {profile?.full_name}
          </BrandPersonName>
          <p className="mt-1 text-sm capitalize" style={{ color: pg.text3 }}>{profile?.role} account</p>
        </div>
      </Surface>

      <div className="mb-5 space-y-2">
        {infoRows.map(row => (
          <Surface key={row.label} className="flex items-center gap-3 p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: pg.surface2, color: pg.ink }}>
              <row.icon size={18} style={{ color: pg.text3 }} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: pg.text4 }}>{row.label}</p>
              <p className="truncate text-sm font-extrabold">{row.value}</p>
            </div>
          </Surface>
        ))}

        <Surface className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: pg.surface2, color: pg.ink }}>
              <MapPin size={18} style={{ color: pg.text3 }} />
            </div>
            <div className="min-w-0 flex-1">
              {editingAddress ? (
                <div className="space-y-2">
                  <input className="input text-sm" value={addressValue} onChange={e => setAddressValue(e.target.value)} placeholder="Enter your address" />
                  <input className="input text-sm" value={cityValue} onChange={e => setCityValue(e.target.value)} placeholder="City" />
                  <div className="flex gap-2">
                    <CTA className="min-h-0 flex-1 rounded-xl py-2.5 text-xs" onClick={saveAddress} disabled={savingAddress}>
                      <Check size={14} /> {savingAddress ? 'Saving...' : 'Save'}
                    </CTA>
                    <CTA variant="secondary" className="min-h-0 flex-1 rounded-xl py-2.5 text-xs" onClick={() => setEditingAddress(false)}>
                      <X size={14} /> Cancel
                    </CTA>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: pg.text4 }}>Address</p>
                  <p className="text-sm font-extrabold">{profile?.address || 'Not set'}</p>
                  {profile?.city && <p className="text-xs" style={{ color: pg.text3 }}>{profile.city}</p>}
                  <button
                    type="button"
                    onClick={() => { setAddressValue(profile?.address || ''); setCityValue(profile?.city || ''); setEditingAddress(true) }}
                    className="mt-2 flex items-center gap-1 text-xs font-extrabold"
                    style={{ color: pg.lime }}
                  >
                    <Edit2 size={11} /> {profile?.address ? 'Edit Address' : 'Add Address'}
                  </button>
                </>
              )}
            </div>
          </div>
        </Surface>
      </div>

      <div className="mb-5">
        <NeedHelpCard chatBasePath="/app/support" />
      </div>

      <CTA variant="danger" className="w-full" onClick={() => signOut()}>
        <LogOut size={18} /> Sign Out
      </CTA>
    </Screen>
  )
}
