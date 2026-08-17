import { useAuth } from '../../context'
import { Avatar, StarRating } from '../../components/ui'
import { Phone, MapPin, Bike, LogOut, Shield, Edit2, Camera, X, Check } from 'lucide-react'
import { useEffect, useState, useRef, type ReactNode } from 'react'
import { supabase, DeliveryPartner } from '../../lib/supabase'
import { uploadProfilePhoto } from '../../lib/uploadProfilePhoto'
import { Screen, PageTitle, Surface, CTA, Chip } from '../../design/primitives'
import { pg } from '../../design/tokens'
import NeedHelpCard from '../../components/NeedHelpCard'
import { BrandPersonName } from '../../components/Brand'

export default function DpProfile() {
  const { profile, signOut, refreshProfile } = useAuth()
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
    if (!file || !profile?.id) return
    setUploadingPhoto(true)
    try {
      await uploadProfilePhoto(profile.id, file)
      await refreshProfile()
      setPhotoRequired(false)
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

  const infoRow = (icon: ReactNode, label: string, children: ReactNode, border = true) => (
    <div
      className={`flex items-start gap-3 px-4 py-3.5 ${border ? '' : ''}`}
      style={border ? { borderBottom: `1px solid ${pg.line}` } : undefined}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: pg.surface2, color: pg.ink, border: `1px solid ${pg.line}` }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-extrabold uppercase tracking-wide" style={{ color: pg.text4 }}>{label}</p>
        {children}
      </div>
    </div>
  )

  return (
    <Screen className="mx-auto max-w-lg animate-fade-in-up">
      <PageTitle eyebrow="Partner" title="Your profile" />

      <Surface className="mb-5 overflow-hidden">
        <div className="h-20" style={{ background: `linear-gradient(135deg, ${pg.limeDim}, ${pg.surface2})` }} />
        <div className="px-4 pb-5">
          <div className="relative -mt-10 flex items-end justify-between">
            <div className="relative">
              <Avatar url={profile?.photo_url} name={profile?.full_name || 'DP'} size={80} />
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full transition active:scale-90"
                style={{ background: pg.lime, color: pg.limeText, boxShadow: '0 4px 12px rgba(196,214,0,0.35)' }}
              >
                <Camera size={14} />
              </button>
              <input ref={cameraRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoCapture} />
            </div>
            <Chip tone={dp?.status === 'approved' ? 'success' : 'warn'}>
              <span className="flex items-center gap-1"><Shield size={10} /> {dp?.status || 'pending'}</span>
            </Chip>
          </div>

          <div className="mt-4">
            <BrandPersonName as="h2" className="text-xl" style={{ color: pg.text }}>
              {profile?.full_name}
            </BrandPersonName>
            <p className="text-sm" style={{ color: pg.text3 }}>Delivery Partner</p>
            {photoRequired && (
              <p className="mt-2 text-xs font-extrabold" style={{ color: pg.warning }}>
                Please take a live photo to complete your profile
              </p>
            )}
            {uploadingPhoto && <p className="mt-1.5 text-xs" style={{ color: pg.text4 }}>Uploading photo…</p>}
            {dp && dp.rating_count > 0 && (
              <div className="mt-2.5 flex items-center gap-2">
                <StarRating value={dp.rating_avg} size={16} />
                <span className="text-sm font-extrabold" style={{ color: pg.text3 }}>
                  {dp.rating_avg.toFixed(1)} ({dp.rating_count})
                </span>
              </div>
            )}
          </div>
        </div>
      </Surface>

      <Surface className="mb-5 overflow-hidden">
        {infoRow(<Phone size={16} style={{ color: pg.text3 }} />, 'Phone', (
          <p className="text-sm font-extrabold">{profile?.phone || 'Not set'}</p>
        ))}
        {infoRow(<MapPin size={16} style={{ color: pg.text3 }} />, 'Address', editingAddress ? (
          <div className="mt-1 space-y-2">
            <input
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={{ background: pg.surface2, border: `1px solid ${pg.line}`, color: pg.text }}
              value={addressValue}
              onChange={e => setAddressValue(e.target.value)}
              placeholder="Enter your address"
            />
            <input
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={{ background: pg.surface2, border: `1px solid ${pg.line}`, color: pg.text }}
              value={cityValue}
              onChange={e => setCityValue(e.target.value)}
              placeholder="City"
            />
            <div className="flex gap-2">
              <CTA className="min-h-0 flex-1 px-3 py-2 text-xs" onClick={saveAddress} disabled={savingAddress}>
                <Check size={14} /> {savingAddress ? 'Saving…' : 'Save'}
              </CTA>
              <CTA variant="secondary" className="min-h-0 flex-1 px-3 py-2 text-xs" onClick={() => setEditingAddress(false)}>
                <X size={14} /> Cancel
              </CTA>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm font-extrabold">{profile?.address || 'Not set'}</p>
            {profile?.city && <p className="text-xs" style={{ color: pg.text4 }}>{profile.city}</p>}
            <button
              type="button"
              onClick={() => { setAddressValue(profile?.address || ''); setCityValue(profile?.city || ''); setEditingAddress(true) }}
              className="mt-1.5 flex items-center gap-1 text-xs font-extrabold"
              style={{ color: pg.lime }}
            >
              <Edit2 size={11} /> {profile?.address ? 'Edit address' : 'Add address'}
            </button>
          </>
        ))}
        {infoRow(<Bike size={16} style={{ color: pg.text3 }} />, 'Vehicle', (
          <p className="text-sm font-extrabold">{dp?.vehicle_type || 'Bike'}</p>
        ), false)}
      </Surface>

      {dp?.upi_id && (
        <Surface className="mb-5 flex items-center gap-3 p-4">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-extrabold"
            style={{ background: pg.limeDim, color: pg.lime }}
          >
            ₹
          </div>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wide" style={{ color: pg.text4 }}>UPI ID</p>
            <p className="text-sm font-extrabold">{dp.upi_id}</p>
          </div>
        </Surface>
      )}

      <div className="mb-5">
        <NeedHelpCard chatBasePath="/dp/support" />
      </div>

      <CTA variant="danger" className="w-full" onClick={() => signOut()}>
        <LogOut size={18} /> Sign out
      </CTA>

      <p className="mt-5 pb-2 text-center text-xs" style={{ color: pg.text4 }}>Partner v1.0.0</p>
    </Screen>
  )
}
