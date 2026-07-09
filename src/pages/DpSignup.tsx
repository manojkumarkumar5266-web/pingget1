import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ErrorBanner } from '../components/ui'
import {
  ArrowLeft, ArrowRight, Camera, Upload, Mail, MapPin,
  User, Phone, Truck, FileText, Shield, CheckCircle, XCircle, Home, Bike,
} from 'lucide-react'

type Step = 1 | 2 | 3 | 4

const VEHICLE_TYPES = ['Bicycle', 'Motorbike', 'Scooter', 'Auto', 'Car', 'Other']
const LICENSE_REQUIRED = ['Motorbike', 'Scooter', 'Auto', 'Car', 'Other']

type PincodeStatus = { served: boolean; area?: string; city?: string } | null

export default function DpSignup() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1
  const [fullName, setFullName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [pincode, setPincode] = useState('')
  const [pincodeStatus, setPincodeStatus] = useState<PincodeStatus>(null)
  const [pincodeChecking, setPincodeChecking] = useState(false)
  const [email, setEmail] = useState('')
  const pinDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Step 2
  const [vehicleType, setVehicleType] = useState('')
  const [aadhaarNumber, setAadhaarNumber] = useState('')
  const [emergencyContact, setEmergencyContact] = useState('')

  // Step 3 files
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [aadhaarFile, setAadhaarFile] = useState<File | null>(null)
  const [aadhaarPreview, setAadhaarPreview] = useState<string | null>(null)
  const [licenseFile, setLicenseFile] = useState<File | null>(null)
  const [licensePreview, setLicensePreview] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const aadhaarInputRef = useRef<HTMLInputElement>(null)
  const licenseInputRef = useRef<HTMLInputElement>(null)

  const needsLicense = LICENSE_REQUIRED.includes(vehicleType)

  // Load saved state from sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem('dp-signup-state')
    if (saved) {
      try {
        const data = JSON.parse(saved)
        setFullName(data.fullName || '')
        setAddress(data.address || '')
        setPhone(data.phone || '')
        setPincode(data.pincode || '')
        setEmail(data.email || '')
        setVehicleType(data.vehicleType || '')
        setAadhaarNumber(data.aadhaarNumber || '')
        setEmergencyContact(data.emergencyContact || '')
      } catch {}
    }
  }, [])

  // Save state to sessionStorage whenever it changes
  useEffect(() => {
    const state = { fullName, address, phone, pincode, email, vehicleType, aadhaarNumber, emergencyContact }
    sessionStorage.setItem('dp-signup-state', JSON.stringify(state))
  }, [fullName, address, phone, pincode, email, vehicleType, aadhaarNumber, emergencyContact])

  useEffect(() => {
    if (pincode.length !== 6) { setPincodeStatus(null); return }
    if (pinDebounceRef.current) clearTimeout(pinDebounceRef.current)
    pinDebounceRef.current = setTimeout(async () => {
      setPincodeChecking(true)
      const { data: pins } = await supabase
        .from('pincodes').select('area_name, city_id')
        .eq('pincode', pincode).eq('is_active', true).limit(1)
      const pin = pins?.[0]
      if (!pin) { setPincodeChecking(false); setPincodeStatus({ served: false }); return }
      const { data: city } = await supabase.from('cities').select('name, is_active').eq('id', pin.city_id).maybeSingle()
      setPincodeChecking(false)
      if (city?.is_active) {
        setPincodeStatus({ served: true, area: pin.area_name || '', city: city.name })
      } else {
        setPincodeStatus({ served: false })
      }
    }, 500)
    return () => { if (pinDebounceRef.current) clearTimeout(pinDebounceRef.current) }
  }, [pincode])

  const pickFile = (file: File, type: 'photo' | 'aadhaar' | 'license') => {
    const url = URL.createObjectURL(file)
    if (type === 'photo') { setPhotoFile(file); setPhotoPreview(url) }
    else if (type === 'aadhaar') { setAadhaarFile(file); setAadhaarPreview(url) }
    else { setLicenseFile(file); setLicensePreview(url) }
  }

  const uploadFile = async (file: File, path: string, bucket: string): Promise<string | null> => {
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
    if (error) return null
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
  }

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) { setError('Full name is required'); return }
    if (!address.trim()) { setError('Address is required'); return }
    if (!phone.trim() || !/^\+?[\d\s\-]{10,}$/.test(phone)) { setError('Please enter a valid phone number'); return }
    if (pincode.length !== 6) { setError('Please enter a 6-digit pincode'); return }
    if (!pincodeStatus?.served) { setError('Sorry, we do not operate in this area yet.'); return }
    if (!email.trim() || !email.includes('@')) { setError('Please enter a valid email'); return }
    setError(null)
    setStep(2)
  }

  const handleStep2 = (e: React.FormEvent) => {
    e.preventDefault()
    if (!vehicleType) { setError('Please select a vehicle type'); return }
    if (aadhaarNumber.length !== 12) { setError('Aadhaar number must be exactly 12 digits'); return }
    if (!emergencyContact.trim()) { setError('Emergency contact is required'); return }
    setError(null)
    setStep(3)
  }

  const handleStep3 = async () => {
    setError(null)
    setLoading(true)

    try {
      // Initiate Google OAuth - store signup data in sessionStorage for callback processing
      const signupData = {
        role: 'dp',
        full_name: fullName,
        phone,
        address,
        pincode,
        vehicle_type: vehicleType,
        aadhaar_number: aadhaarNumber,
        emergency_contact: emergencyContact,
        is_new_signup: true,
        timestamp: Date.now(),
      }
      sessionStorage.setItem('dp-oauth-signup', JSON.stringify(signupData))

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/dp-signup',
          queryParams: { prompt: 'select_account' },
        },
      })

      if (oauthError) {
        setError(oauthError.message)
        setLoading(false)
      }
      // If successful, user will be redirected to Google, then back here
      // The callback processing happens in the useEffect above
    } catch (err: any) {
      setError(err.message || 'Failed to start Google sign in')
      setLoading(false)
    }
  }

  // Handle OAuth callback
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const signupDataStr = sessionStorage.getItem('dp-oauth-signup')
      if (!signupDataStr) return

      const signupData = JSON.parse(signupDataStr)

      // Check if this is a fresh signup (timestamp within last 60 seconds)
      if (!signupData.is_new_signup || Date.now() - signupData.timestamp > 60000) return

      // Clear the signup marker
      sessionStorage.removeItem('dp-oauth-signup')

      setLoading(true)

      try {
        const userId = session.user.id
        const userEmail = session.user.email

        // Check if profile already exists
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', userId)
          .maybeSingle()

        if (existingProfile) {
          // Profile exists, check if they have a DP record
          const { data: existingDp } = await supabase
            .from('delivery_partners')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle()

          if (existingDp) {
            setError('This Google account is already registered as a delivery partner.')
            setLoading(false)
            return
          }
        }

        // Create profile if it doesn't exist
        if (!existingProfile) {
          const { error: profileError } = await supabase.from('profiles').insert({
            id: userId,
            role: 'dp',
            full_name: signupData.full_name,
            phone: signupData.phone,
            address: signupData.address,
            pincode: signupData.pincode,
            status: 'active',
          })

          if (profileError) throw profileError
        }

        // Create delivery_partner record
        const { error: dpError } = await supabase.from('delivery_partners').insert({
          user_id: userId,
          vehicle_type: signupData.vehicle_type,
          aadhaar_number: signupData.aadhaar_number,
          emergency_contact: signupData.emergency_contact,
          status: 'pending',
        })

        if (dpError) throw dpError

        // Upload documents if they exist in session
        const docsStr = sessionStorage.getItem('dp-upload-docs')
        if (docsStr) {
          try {
            const docs = JSON.parse(docsStr)
            if (docs.photo) {
              const photoBlob = await fetch(docs.photo).then(r => r.blob())
              const photoUrl = await uploadFile(photoBlob as File, `${userId}/photo`, 'avatars')
              if (photoUrl) await supabase.from('profiles').update({ photo_url: photoUrl }).eq('id', userId)
            }
            if (docs.aadhaar) {
              const aadhaarBlob = await fetch(docs.aadhaar).then(r => r.blob())
              const aadhaarUrl = await uploadFile(aadhaarBlob as File, `${userId}/aadhaar`, 'media')
              if (aadhaarUrl) await supabase.from('delivery_partners').update({ aadhaar_url: aadhaarUrl }).eq('user_id', userId)
            }
            if (docs.license) {
              const licenseBlob = await fetch(docs.license).then(r => r.blob())
              const licenseUrl = await uploadFile(licenseBlob as File, `${userId}/license`, 'media')
              if (licenseUrl) await supabase.from('delivery_partners').update({ driving_license_url: licenseUrl }).eq('user_id', userId)
            }
          } catch {}
          sessionStorage.removeItem('dp-upload-docs')
        }

        // Sign out and show success
        await supabase.auth.signOut()
        sessionStorage.removeItem('dp-signup-state')
        setStep(4)
      } catch (err: any) {
        setError(err.message || 'Failed to complete signup')
      } finally {
        setLoading(false)
      }
    }

    handleOAuthCallback()
  }, [])

  const handleUploadDocuments = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!photoFile) { setError('Profile photo is required'); return }
    if (!aadhaarFile) { setError('Aadhaar document is required'); return }
    if (needsLicense && !licenseFile) { setError('Driving licence is required for your vehicle type'); return }

    // Store image previews in session for later upload after OAuth
    const docs: Record<string, string> = {}
    if (photoPreview) docs.photo = photoPreview
    if (aadhaarPreview) docs.aadhaar = aadhaarPreview
    if (licensePreview) docs.license = licensePreview
    sessionStorage.setItem('dp-upload-docs', JSON.stringify(docs))

    setError(null)
    await handleStep3()
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #1c2a14 0%, #2a3d1c 40%, #374524 100%)' }}>
      <div className="mx-auto max-w-md px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => {
              if (step === 2) { setStep(1); setError(null) }
              else if (step === 3) { setStep(2); setError(null) }
              else navigate('/auth')
            }}
            className="btn-ghost p-2 text-white"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 flex justify-center">
            <div className="flex flex-col items-center">
              <span className="text-lg font-black tracking-tight text-white" style={{ fontFamily: 'system-ui, sans-serif' }}>
                <span>pin</span>
                <span style={{ color: '#808000' }}>G</span>
                <span className="text-white">G</span>
                <span>et</span>
              </span>
              <span className="text-[8px] font-semibold tracking-wider" style={{ color: '#808000' }}>
                CHAT . ORDER . GET IT
              </span>
            </div>
          </div>
          <div className="flex-1"></div>
        </div>

        {/* Progress — 4 visible steps */}
        <div className="mb-6 flex items-center gap-2">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                s <= step ? 'text-white' : 'bg-white/20 text-white/60'
              }`} style={s <= step ? { backgroundColor: '#808000' } : {}}>
                {s < step ? <CheckCircle size={14} /> : s}
              </div>
              {s < 4 && <div className="flex-1 h-0.5 rounded-full" style={{ background: s < step ? '#808000' : 'rgba(255,255,255,0.2)' }} />}
            </div>
          ))}
        </div>

        {/* STEP 1: Basic Info */}
        {step === 1 && (
          <div className="card p-6">
            <h2 className="mb-1 text-xl font-bold text-gray-900 dark:text-white">Basic Information</h2>
            <p className="mb-5 text-sm text-gray-500">All fields are required</p>
            <form onSubmit={handleStep1} className="space-y-4">
              <div>
                <label className="label flex items-center gap-1.5"><User size={14} /> Full Name *</label>
                <input className="input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" required />
              </div>
              <div>
                <label className="label flex items-center gap-1.5"><Home size={14} /> Address *</label>
                <input className="input" value={address} onChange={e => setAddress(e.target.value)} placeholder="Your full address" required />
              </div>
              <div>
                <label className="label flex items-center gap-1.5"><Phone size={14} /> Phone Number *</label>
                <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="10-digit mobile number" required />
              </div>
              <div>
                <label className="label flex items-center gap-1.5"><MapPin size={14} /> Your Area Pincode *</label>
                <input
                  className="input"
                  value={pincode}
                  onChange={e => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit pincode"
                  maxLength={6}
                  required
                />
                {pincodeChecking && <p className="mt-1.5 text-xs text-gray-400">Checking service area…</p>}
                {!pincodeChecking && pincodeStatus && (
                  <div className={`mt-1.5 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                    pincodeStatus.served
                      ? 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300'
                      : 'bg-error-50 text-error-700 dark:bg-error-900/30 dark:text-error-300'
                  }`}>
                    {pincodeStatus.served
                      ? <><CheckCircle size={13} /> We operate in {pincodeStatus.area}{pincodeStatus.city ? `, ${pincodeStatus.city}` : ''}!</>
                      : <><XCircle size={13} /> We don&apos;t operate in this area yet.</>}
                  </div>
                )}
              </div>
              <div>
                <label className="label flex items-center gap-1.5"><Mail size={14} /> Email *</label>
                <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@gmail.com (Google account)" required />
                <p className="mt-1 text-xs text-gray-400">Use your Google account email for sign in</p>
              </div>
              {error && <ErrorBanner message={error} />}
              <button type="submit" className="btn-primary w-full">
                <span>Continue</span> <ArrowRight size={16} />
              </button>
            </form>
          </div>
        )}

        {/* STEP 2: Vehicle & Identity */}
        {step === 2 && (
          <div className="card p-6">
            <h2 className="mb-1 text-xl font-bold text-gray-900 dark:text-white">Vehicle & Identity</h2>
            <p className="mb-5 text-sm text-gray-500">All fields are required</p>
            <form onSubmit={handleStep2} className="space-y-4">
              <div>
                <label className="label flex items-center gap-1.5"><Truck size={14} /> Vehicle Type *</label>
                <div className="grid grid-cols-3 gap-2">
                  {VEHICLE_TYPES.map(v => (
                    <button
                      key={v} type="button" onClick={() => setVehicleType(v)}
                      className={`rounded-xl border-2 py-2.5 text-sm font-medium transition-all ${
                        vehicleType === v
                          ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                          : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400'
                      }`}
                    >{v}</button>
                  ))}
                </div>
                {vehicleType && (
                  <p className={`mt-2 text-xs font-medium ${needsLicense ? 'text-warning-600 dark:text-warning-400' : 'text-success-600 dark:text-success-400'}`}>
                    {needsLicense ? 'Driving licence required for this vehicle type' : 'No driving licence required for bicycle'}
                  </p>
                )}
              </div>
              <div>
                <label className="label flex items-center gap-1.5"><FileText size={14} /> Aadhaar Number *</label>
                <input
                  className="input"
                  value={aadhaarNumber}
                  onChange={e => setAadhaarNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                  placeholder="12-digit Aadhaar number"
                  maxLength={12}
                  required
                />
                {aadhaarNumber.length > 0 && aadhaarNumber.length < 12 && (
                  <p className="mt-1 text-xs text-error-600">{12 - aadhaarNumber.length} more digits needed</p>
                )}
              </div>
              <div>
                <label className="label flex items-center gap-1.5"><Phone size={14} /> Emergency Contact *</label>
                <input className="input" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} placeholder="+91 98765 43210" required />
              </div>
              {error && <ErrorBanner message={error} />}
              <button type="submit" className="btn-primary w-full">Continue <ArrowRight size={16} /></button>
            </form>
          </div>
        )}

        {/* STEP 3: Documents + Google Sign In */}
        {step === 3 && (
          <div className="card p-6">
            <h2 className="mb-1 text-xl font-bold text-gray-900 dark:text-white">Documents & Photo</h2>
            <p className="mb-5 text-sm text-gray-500">
              Upload your profile photo, Aadhaar{needsLicense ? ', and driving licence' : ''}. All required.
            </p>
            <form onSubmit={handleUploadDocuments} className="space-y-5">
              {/* Profile photo */}
              <div>
                <label className="label flex items-center gap-1.5"><Camera size={14} /> Profile Photo *</label>
                <input ref={photoInputRef} type="file" className="hidden" accept="image/*" capture="user"
                  onChange={e => e.target.files?.[0] && pickFile(e.target.files[0], 'photo')} />
                {photoPreview ? (
                  <div className="relative">
                    <img src={photoPreview} alt="Profile" className="h-28 w-28 rounded-2xl object-cover" />
                    <button type="button" onClick={() => photoInputRef.current?.click()}
                      className="absolute bottom-1 right-1 rounded-full p-1.5 text-white shadow" style={{ backgroundColor: '#808000' }}>
                      <Camera size={14} />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => photoInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 py-8 text-sm font-medium text-gray-500 hover:border-primary-400 dark:border-gray-700">
                    <Camera size={20} style={{ color: '#808000' }} /> Take Photo or Upload *
                  </button>
                )}
              </div>

              {/* Aadhaar document */}
              <div>
                <label className="label flex items-center gap-1.5"><Upload size={14} /> Aadhaar Proof *</label>
                <input ref={aadhaarInputRef} type="file" className="hidden" accept="image/*,application/pdf"
                  onChange={e => e.target.files?.[0] && pickFile(e.target.files[0], 'aadhaar')} />
                {aadhaarPreview ? (
                  <div className="flex items-center gap-3 rounded-xl border border-success-200 bg-success-50 p-3 dark:border-success-800 dark:bg-success-900/20">
                    {aadhaarFile?.type.startsWith('image') ? (
                      <img src={aadhaarPreview} alt="Aadhaar" className="h-14 w-14 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-success-100 dark:bg-success-900/40">
                        <FileText size={24} className="text-success-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{aadhaarFile?.name}</p>
                      <p className="text-xs text-success-600">Aadhaar uploaded</p>
                    </div>
                    <button type="button" onClick={() => aadhaarInputRef.current?.click()} className="btn-ghost p-2"><Upload size={16} /></button>
                  </div>
                ) : (
                  <button type="button" onClick={() => aadhaarInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 py-8 text-sm font-medium text-gray-500 hover:border-primary-400 dark:border-gray-700">
                    <Upload size={20} style={{ color: '#808000' }} /> Upload Aadhaar *
                  </button>
                )}
              </div>

              {/* Driving licence (motor vehicles only) */}
              {needsLicense && (
                <div>
                  <label className="label flex items-center gap-1.5"><FileText size={14} /> Driving Licence *</label>
                  <input ref={licenseInputRef} type="file" className="hidden" accept="image/*,application/pdf"
                    onChange={e => e.target.files?.[0] && pickFile(e.target.files[0], 'license')} />
                  {licensePreview ? (
                    <div className="flex items-center gap-3 rounded-xl border border-success-200 bg-success-50 p-3 dark:border-success-800 dark:bg-success-900/20">
                      {licenseFile?.type.startsWith('image') ? (
                        <img src={licensePreview} alt="Licence" className="h-14 w-14 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-success-100 dark:bg-success-900/40">
                          <FileText size={24} className="text-success-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{licenseFile?.name}</p>
                        <p className="text-xs text-success-600">Licence uploaded</p>
                      </div>
                      <button type="button" onClick={() => licenseInputRef.current?.click()} className="btn-ghost p-2"><Upload size={16} /></button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => licenseInputRef.current?.click()}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-warning-200 py-8 text-sm font-medium text-gray-500 hover:border-warning-400 dark:border-warning-800">
                      <Upload size={20} className="text-warning-500" /> Upload Driving Licence *
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-start gap-2 rounded-xl bg-accent-50 p-3 text-xs text-accent-700 dark:bg-accent-950/40 dark:text-accent-300">
                <Shield size={14} className="mt-0.5 shrink-0" />
                Your documents are securely stored and only visible to admin for verification.
              </div>

              {error && <ErrorBanner message={error} />}
              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {loading ? 'Signing in with Google...' : 'Complete with Google Sign In'}
              </button>
              <p className="text-xs text-gray-400 text-center">You&apos;ll sign in with your Google account ({email}) to complete registration</p>
            </form>
          </div>
        )}

        {/* STEP 4: Success */}
        {step === 4 && (
          <div className="card p-6 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: '#e5ecda' }}>
                <CheckCircle size={32} style={{ color: '#808000' }} />
              </div>
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Application Submitted!</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Your delivery partner application is under review. We&apos;ll notify you once approved.
            </p>
            <div className="mt-4 rounded-xl border border-primary-100 bg-primary-50 p-4 dark:border-primary-900/40 dark:bg-primary-900/20">
              <p className="text-sm font-medium text-primary-800 dark:text-primary-300">
                Once an admin approves your application, sign in with your Google account to start accepting requests.
              </p>
            </div>
            <button onClick={() => navigate('/auth')} className="btn-primary mt-5 w-full">Go to Sign In</button>
          </div>
        )}
      </div>
    </div>
  )
}
