import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ErrorBanner } from '../components/ui'
import {
  ArrowLeft, ArrowRight, Camera, Upload, Mail, MapPin,
  User, Phone, Lock, Truck, FileText, Shield, CheckCircle, XCircle, Home,
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
  const [password, setPassword] = useState('')
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
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
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

  const handleStep3 = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!photoFile) { setError('Profile photo is required'); return }
    if (!aadhaarFile) { setError('Aadhaar document is required'); return }
    if (needsLicense && !licenseFile) { setError('Driving licence is required for your vehicle type'); return }

    setError(null)
    setLoading(true)
    try {
      // Create confirmed user + profile + dp record via edge function
      const { data: signupData, error: fnError } = await supabase.functions.invoke('signup-user', {
        body: {
          email, password, role: 'dp', full_name: fullName, phone, address,
          pincode: pincode || undefined,
          vehicle_type: vehicleType,
          aadhaar_number: aadhaarNumber,
          emergency_contact: emergencyContact,
        },
      })
      if (fnError || signupData?.error) { setError(signupData?.error || fnError?.message || 'Sign up failed'); return }
      const uid: string = signupData.user_id

      // Sign in to get an authenticated session for file uploads
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) { setError(signInError.message); return }

      const [photoUrl, aadhaarUrl, licenseUrl] = await Promise.all([
        uploadFile(photoFile, `${uid}/photo`, 'avatars'),
        uploadFile(aadhaarFile, `${uid}/aadhaar`, 'media'),
        licenseFile ? uploadFile(licenseFile, `${uid}/license`, 'media') : Promise.resolve(null),
      ])

      const dpUpdates: Record<string, string | null> = {}
      if (aadhaarUrl) dpUpdates.aadhaar_url = aadhaarUrl
      if (licenseUrl) dpUpdates.driving_license_url = licenseUrl
      if (Object.keys(dpUpdates).length > 0) {
        await supabase.from('delivery_partners').update(dpUpdates).eq('user_id', uid)
      }
      if (photoUrl) await supabase.from('profiles').update({ photo_url: photoUrl }).eq('id', uid)

      await supabase.auth.signOut()
      setStep(4)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto max-w-md px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => {
              if (step === 2) { setStep(1); setError(null) }
              else if (step === 3) { setStep(2); setError(null) }
              else navigate('/auth')
            }}
            className="btn-ghost p-2"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">Delivery Partner</p>
              <p className="text-xs text-gray-500">Registration</p>
            </div>
          </div>
        </div>

        {/* Progress — 4 visible steps */}
        <div className="mb-6 flex items-center gap-2">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                s <= step ? 'text-white' : 'bg-gray-200 text-gray-400 dark:bg-gray-700'
              }`} style={s <= step ? { backgroundColor: '#556d34' } : {}}>
                {s < step ? <CheckCircle size={14} /> : s}
              </div>
              {s < 4 && <div className="flex-1 h-0.5 rounded-full" style={{ background: s < step ? '#6e8c45' : '#e5e7eb' }} />}
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
                <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
              </div>
              <div>
                <label className="label flex items-center gap-1.5"><Lock size={14} /> Password *</label>
                <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" required minLength={6} />
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

        {/* STEP 3: Documents */}
        {step === 3 && (
          <div className="card p-6">
            <h2 className="mb-1 text-xl font-bold text-gray-900 dark:text-white">Documents & Photo</h2>
            <p className="mb-5 text-sm text-gray-500">
              Upload your profile photo, Aadhaar{needsLicense ? ', and driving licence' : ''}. All required.
            </p>
            <form onSubmit={handleStep3} className="space-y-5">
              {/* Profile photo */}
              <div>
                <label className="label flex items-center gap-1.5"><Camera size={14} /> Profile Photo *</label>
                <input ref={photoInputRef} type="file" className="hidden" accept="image/*" capture="user"
                  onChange={e => e.target.files?.[0] && pickFile(e.target.files[0], 'photo')} />
                {photoPreview ? (
                  <div className="relative">
                    <img src={photoPreview} alt="Profile" className="h-28 w-28 rounded-2xl object-cover" />
                    <button type="button" onClick={() => photoInputRef.current?.click()}
                      className="absolute bottom-1 right-1 rounded-full p-1.5 text-white shadow" style={{ backgroundColor: '#556d34' }}>
                      <Camera size={14} />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => photoInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 py-8 text-sm font-medium text-gray-500 hover:border-primary-400 dark:border-gray-700">
                    <Camera size={20} style={{ color: '#6e8c45' }} /> Take Photo or Upload *
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
                    <Upload size={20} style={{ color: '#6e8c45' }} /> Upload Aadhaar *
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
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Submitting application…' : 'Submit Application'}
              </button>
            </form>
          </div>
        )}

        {/* STEP 4: Success */}
        {step === 4 && (
          <div className="card p-6 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: '#e5ecda' }}>
                <CheckCircle size={32} style={{ color: '#556d34' }} />
              </div>
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Application Submitted!</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Your delivery partner application is under review. We&apos;ll notify you once approved.
            </p>
            <div className="mt-4 rounded-xl border border-primary-100 bg-primary-50 p-4 dark:border-primary-900/40 dark:bg-primary-900/20">
              <p className="text-sm font-medium text-primary-800 dark:text-primary-300">
                Once an admin approves your application, sign in with your email and password to start accepting requests.
              </p>
            </div>
            <button onClick={() => navigate('/auth')} className="btn-primary mt-5 w-full">Go to Sign In</button>
          </div>
        )}
      </div>
    </div>
  )
}
