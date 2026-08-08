import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context'
import { supabase } from '../lib/supabase'
import { ErrorBanner } from '../components/ui'
import AuthLayout from '../components/AuthLayout'
import { pg } from '../design/tokens'
import { CTA, IconButton, Surface } from '../design/primitives'
import { ArrowLeft, ArrowRight, Camera, Upload, Mail, MapPin, User, Phone, Truck, FileText, Shield, CircleCheck as CheckCircle, Circle as XCircle, Lock, Eye, EyeOff, KeyRound } from 'lucide-react'

type View = 'signup' | 'signin' | 'forgot' | 'success'
type Step = 1 | 2 | 3 | 4

const VEHICLE_TYPES = ['Bicycle', 'Motorbike', 'Scooter', 'Auto', 'Car', 'Other']
const LICENSE_REQUIRED = ['Motorbike', 'Scooter', 'Auto', 'Car', 'Other']

type PincodeStatus = { served: boolean; area?: string; city?: string } | null

async function autoDetectPincode(setPin: (v: string) => void, setError: (e: string | null) => void) {
  if (!navigator.geolocation) { setError('Location not supported on this device'); return }
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&addressdetails=1`)
        const data = await res.json()
        const addr = data?.address || {}
        const rawPin = (addr.postcode || addr.postal_code || '').replace(/\D/g, '').slice(0, 6)
        const areaBits = [addr.suburb, addr.neighbourhood, addr.quarter, addr.city_district, addr.locality, addr.town, addr.village].filter(Boolean)
        const areaName = areaBits.join(' ').toLowerCase().trim()

        if (areaName) {
          const { data: allPins } = await supabase.from('pincodes').select('pincode, area_name').eq('is_active', true)
          const matched = (allPins || []).find((p: any) => {
            const dbArea = (p.area_name || '').toLowerCase()
            return dbArea && (areaName.includes(dbArea) || dbArea.includes(areaName))
          })
          if (matched?.pincode) { setPin(matched.pincode); return }
        }

        if (rawPin) setPin(rawPin)
        else setError('Could not detect pincode for your location. Please enter it manually.')
      } catch {
        setError('Could not detect pincode. Please enter it manually.')
      }
    },
    () => setError('Location permission denied. Please enter pincode manually.'),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  )
}

export default function DpSignup() {
  const { signInWithEmail } = useAuth()
  const navigate = useNavigate()

  const [view, setView] = useState<View>('signup')
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  // Sign-in fields (DP sign in)
  const [signInEmail, setSignInEmail] = useState('')
  const [signInPassword, setSignInPassword] = useState('')
  const [signInPincode, setSignInPincode] = useState('')
  const [signInPincodeStatus, setSignInPincodeStatus] = useState<PincodeStatus>(null)
  const [signInPincodeChecking, setSignInPincodeChecking] = useState(false)
  const signInPinDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Forgot password
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)

  // Step 1 — basic info + credentials
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [pincode, setPincode] = useState('')
  const [pincodeStatus, setPincodeStatus] = useState<PincodeStatus>(null)
  const [pincodeChecking, setPincodeChecking] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const pinDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Step 2 — vehicle & identity
  const [vehicleType, setVehicleType] = useState('')
  const [aadhaarNumber, setAadhaarNumber] = useState('')
  const [emergencyContact, setEmergencyContact] = useState('')

  // Step 3 — files
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

  // ── Pincode check for DP sign-in ──
  useEffect(() => {
    if (signInPincode.length !== 6) { setSignInPincodeStatus(null); return }
    if (signInPinDebounceRef.current) clearTimeout(signInPinDebounceRef.current)
    signInPinDebounceRef.current = setTimeout(async () => {
      setSignInPincodeChecking(true)
      const { data: pins } = await supabase.from('pincodes').select('area_name, city_id').eq('pincode', signInPincode).eq('is_active', true).limit(1)
      const pin = pins?.[0]
      if (!pin) { setSignInPincodeChecking(false); setSignInPincodeStatus({ served: false }); return }
      const { data: city } = await supabase.from('cities').select('name, is_active').eq('id', pin.city_id).maybeSingle()
      setSignInPincodeChecking(false)
      if (city?.is_active) setSignInPincodeStatus({ served: true, area: pin.area_name || '', city: city.name })
      else setSignInPincodeStatus({ served: false })
    }, 500)
    return () => { if (signInPinDebounceRef.current) clearTimeout(signInPinDebounceRef.current) }
  }, [signInPincode])

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
    setError(null)
    if (!fullName.trim()) { setError('Full name is required'); return }
    const phoneDigits = phone.replace(/\D/g, '')
    if (phoneDigits.length < 10) { setError('Please enter a valid 10-digit phone number'); return }
    if (pincode.length !== 6) { setError('Please enter a 6-digit pincode'); return }
    if (!pincodeStatus?.served) { setError('Sorry, we do not operate in this area yet.'); return }
    if (!email.trim() || !email.includes('@')) { setError('Please enter a valid email'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    setStep(2)
  }

  const handleStep2 = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!vehicleType) { setError('Please select a vehicle type'); return }
    if (aadhaarNumber.length !== 12) { setError('Aadhaar number must be exactly 12 digits'); return }
    if (!emergencyContact.trim()) { setError('Emergency contact is required'); return }
    setStep(3)
  }

  // Step 3: create account + upload docs → then show step 4 success (fixed bug)
  const handleStep3 = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!photoFile) { setError('Profile photo is required'); return }
    if (!aadhaarFile) { setError('Aadhaar document is required'); return }
    if (needsLicense && !licenseFile) { setError('Driving licence is required for your vehicle type'); return }

    setLoading(true)
    try {
      const phoneDigits = phone.replace(/\D/g, '')

      // Check phone uniqueness
      const { count } = await supabase
        .from('profiles').select('id', { count: 'exact', head: true }).eq('phone', phoneDigits)
      if ((count ?? 0) > 0) {
        setError('This mobile number is already registered.')
        setLoading(false)
        return
      }

      // Create user + profile + delivery_partner record server-side (bypasses RLS)
      const { data: signupData, error: signupError } = await supabase.functions.invoke('signup-user', {
        body: {
          email: email.trim(), password, role: 'dp', full_name: fullName.trim(),
          phone: phoneDigits, pincode,
          vehicle_type: vehicleType, aadhaar_number: aadhaarNumber, emergency_contact: emergencyContact,
        },
      })
      if (signupError || !signupData?.success) {
        const msg = signupError?.message || signupData?.error || 'Failed to create account.'
        if (msg.includes('already') || msg.includes('duplicate')) {
          setError('An account with this email already exists. Please sign in instead.')
        } else {
          setError(msg)
        }
        setLoading(false)
        return
      }

      const userId = signupData.user_id

      // Upload documents
      if (photoFile) {
        const photoUrl = await uploadFile(photoFile, `${userId}/photo`, 'avatars')
        if (photoUrl) await supabase.from('profiles').update({ photo_url: photoUrl }).eq('id', userId)
      }
      if (aadhaarFile) {
        const aadhaarUrl = await uploadFile(aadhaarFile, `${userId}/aadhaar`, 'media')
        if (aadhaarUrl) await supabase.from('delivery_partners').update({ aadhaar_url: aadhaarUrl }).eq('user_id', userId)
      }
      if (needsLicense && licenseFile) {
        const licenseUrl = await uploadFile(licenseFile, `${userId}/license`, 'media')
        if (licenseUrl) await supabase.from('delivery_partners').update({ driving_license_url: licenseUrl }).eq('user_id', userId)
      }

      setStep(4)
    } catch (err: any) {
      setError(err.message || 'Failed to complete signup')
    } finally {
      setLoading(false)
    }
  }

  const handleDpSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!signInEmail.trim() || !signInPassword) { setError('Please enter your email and password'); return }
    if (signInPincode.length === 6 && !signInPincodeStatus?.served) {
      setError('Sorry, we do not operate in this area yet. Please check back later.')
      return
    }
    setLoading(true)
    const { error: signInError } = await signInWithEmail(signInEmail.trim(), signInPassword)
    if (signInError) { setError(signInError); setSignInEmail(''); setSignInPassword(''); setLoading(false); return }
    // App.tsx redirects based on profile role
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!resetEmail.trim()) { setError('Please enter your email address'); return }
    setLoading(true)

    const { data: profileData } = await supabase
      .from('profiles').select('id').ilike('email', resetEmail.trim()).maybeSingle()
    if (!profileData) {
      setError('No account found with this email address.')
      setLoading(false)
      return
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      resetEmail.trim(),
      { redirectTo: window.location.origin + '/reset-password' }
    )
    if (resetError) {
      // Fallback: try via Resend edge function
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            to: resetEmail.trim(),
            type: 'password_reset',
            data: { name: '', reset_url: `${window.location.origin}/reset-password` },
          },
        })
      } catch { /* fallback also failed */ }
    }
    setLoading(false)
    setResetSent(true)
  }

  // ---- FORGOT PASSWORD ----
  if (view === 'forgot') {
    return (
      <AuthLayout showBrand={false}>
        <button type="button" onClick={() => { setView('signin'); setError(null); setResetSent(false) }} className="mb-4 text-sm font-bold hover:underline" style={{ color: pg.lime }}>← Back to Sign In</button>
        <h2 className="mb-1 text-xl font-extrabold">Forgot Password</h2>
        <p className="mb-6 text-sm" style={{ color: pg.text3 }}>Enter your email and we&apos;ll send you a reset link.</p>
        {resetSent ? (
          <Surface accent className="px-4 py-3 text-sm" style={{ color: pg.success }}>
            <div className="flex items-center gap-2"><CheckCircle size={16} className="shrink-0" /> Reset link sent! Check your email.</div>
          </Surface>
        ) : (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="label flex items-center gap-1.5"><Mail size={14} /> Email</label>
              <input type="email" className="input" value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            {error && <ErrorBanner message={error} />}
            <CTA type="submit" disabled={loading} className="w-full"><KeyRound size={16} /> {loading ? 'Sending...' : 'Send Reset Link'}</CTA>
          </form>
        )}
      </AuthLayout>
    )
  }

  // ---- DP SIGN IN ----
  if (view === 'signin') {
    return (
      <AuthLayout showBrand={false}>
        <button type="button" onClick={() => { setView('signup'); setStep(1); setError(null) }} className="mb-4 text-sm font-bold hover:underline" style={{ color: pg.lime }}>← Back</button>
        <h2 className="mb-1 text-xl font-extrabold">Delivery Partner Sign In</h2>
        <p className="mb-6 text-sm" style={{ color: pg.text3 }}>Sign in with your email and password</p>
        {error && <ErrorBanner message={error} />}
        <form onSubmit={handleDpSignIn} className="space-y-3">
            <div>
              <label className="label flex items-center gap-1.5"><Mail size={14} /> Email</label>
              <input type="email" className="input" value={signInEmail} onChange={e => setSignInEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div>
              <label className="label flex items-center gap-1.5"><Lock size={14} /> Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} className="input pr-10" value={signInPassword} onChange={e => setSignInPassword(e.target.value)} placeholder="Your password" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="label flex items-center gap-1.5"><MapPin size={14} /> Your Area Pincode (optional)</label>
              <div className="flex gap-2">
                <input className="input flex-1" value={signInPincode} onChange={e => setSignInPincode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit pincode" maxLength={6} />
                <button type="button" onClick={() => autoDetectPincode(setSignInPincode, setError)} className="shrink-0 rounded-2xl px-3 py-2" style={{ background: pg.surface2, border: `1px solid ${pg.line}` }} title="Detect my location">
                  <MapPin size={16} style={{ color: pg.lime }} />
                </button>
              </div>
              {signInPincodeChecking && <p className="mt-1 text-xs text-white/40">Checking service area...</p>}
              {!signInPincodeChecking && signInPincodeStatus && (
                <div className={`mt-1.5 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${signInPincodeStatus.served ? 'text-green-300' : 'text-red-300'}`} style={{ background: signInPincodeStatus.served ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${signInPincodeStatus.served ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
                  {signInPincodeStatus.served
                    ? <><CheckCircle size={13} /> We serve {signInPincodeStatus.area}{signInPincodeStatus.city ? `, ${signInPincodeStatus.city}` : ''}!</>
                    : <><XCircle size={13} /> Sorry, we don&apos;t serve this area yet.</>}
                </div>
              )}
            </div>
            <div className="text-right">
              <button type="button" onClick={() => { setView('forgot'); setError(null); setResetSent(false) }} className="text-xs font-bold hover:underline" style={{ color: pg.lime }}>Forgot password?</button>
            </div>
            <CTA type="submit" disabled={loading} className="w-full">{loading ? 'Signing in...' : 'Sign In'}</CTA>
          </form>
          <p className="mt-4 text-center text-xs" style={{ color: pg.text3 }}>
            Don&apos;t have an account?{' '}
            <button type="button" onClick={() => { setView('signup'); setStep(1); setError(null) }} className="font-extrabold hover:underline" style={{ color: pg.lime }}>Sign up here</button>
          </p>
      </AuthLayout>
    )
  }

  // ---- SUCCESS (step 4) ----
  if (step === 4) {
    return <DpSuccessScreen onContinue={() => navigate('/auth')} />
  }

  // ---- SIGNUP FLOW (steps 1-3) ----
  return (
    <AuthLayout>
      <div className="mb-4 flex items-center gap-3">
        <IconButton
          onClick={() => { if (step === 2) { setStep(1); setError(null) } else if (step === 3) { setStep(2); setError(null) } else navigate('/landing') }}
          className="!h-10 !w-10"
        >
          <ArrowLeft size={18} />
        </IconButton>
      </div>

      <div className="mb-4 text-center">
        <h2 className="text-xl font-extrabold tracking-tight">Earn money delivering in your neighbourhood!</h2>
        <p className="mt-1 text-sm" style={{ color: pg.text3 }}>Join as a delivery partner and get started today</p>
      </div>

      <div className="mb-4 flex items-center gap-2">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold transition-all"
              style={s <= step ? { background: pg.lime, color: pg.limeText } : { background: pg.surface2, color: pg.text3 }}
            >
              {s < step ? <CheckCircle size={14} /> : s}
            </div>
            {s < 4 && <div className="h-0.5 flex-1 rounded-full" style={{ background: s < step ? pg.lime : pg.line }} />}
          </div>
        ))}
      </div>

      <div>
        {step === 1 && (
          <>
            <h2 className="mb-1 text-xl font-extrabold">Basic Information</h2>
            <p className="mb-5 text-sm" style={{ color: pg.text3 }}>All fields are required</p>
            <form onSubmit={handleStep1} className="space-y-3">
              <div><label className="label flex items-center gap-1.5"><User size={14} /> Full Name *</label><input className="input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" required /></div>
              <div><label className="label flex items-center gap-1.5"><Phone size={14} /> Phone Number *</label><input className="input" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile number" maxLength={10} required /></div>
              <div>
                <label className="label flex items-center gap-1.5"><MapPin size={14} /> Your Area Pincode *</label>
                <input className="input" value={pincode} onChange={e => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit pincode" maxLength={6} required />
                {pincodeChecking && <p className="mt-1.5 text-xs text-white/40">Checking service area...</p>}
                {!pincodeChecking && pincodeStatus && (
                  <div className={`mt-1.5 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${pincodeStatus.served ? 'text-green-300' : 'text-red-300'}`}>
                    {pincodeStatus.served ? <><CheckCircle size={13} /> We operate in {pincodeStatus.area}{pincodeStatus.city ? `, ${pincodeStatus.city}` : ''}!</> : <><XCircle size={13} /> We don&apos;t operate in this area yet.</>}
                  </div>
                )}
              </div>
              <div><label className="label flex items-center gap-1.5"><Mail size={14} /> Email *</label><input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required /></div>
              <div>
                <label className="label flex items-center gap-1.5"><Lock size={14} /> Password *</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} className="input pr-10" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </div>
              <div>
                <label className="label flex items-center gap-1.5"><Lock size={14} /> Confirm Password *</label>
                <input type={showPassword ? 'text' : 'password'} className="input" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter your password" required />
                {confirmPassword && password !== confirmPassword && <p className="mt-1 text-xs text-red-400">Passwords do not match</p>}
              </div>
              {error && <ErrorBanner message={error} />}
              <CTA type="submit" className="w-full">Continue <ArrowRight size={16} /></CTA>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="mb-1 text-xl font-extrabold">Vehicle & Identity</h2>
            <p className="mb-5 text-sm" style={{ color: pg.text3 }}>All fields are required</p>
            <form onSubmit={handleStep2} className="space-y-3">
              <div>
                <label className="label flex items-center gap-1.5"><Truck size={14} /> Vehicle Type *</label>
                <div className="grid grid-cols-3 gap-2">
                  {VEHICLE_TYPES.map(v => (
                    <button key={v} type="button" onClick={() => setVehicleType(v)}
                      className="rounded-2xl border-2 py-2.5 text-sm font-bold transition-all"
                      style={vehicleType === v
                        ? { borderColor: pg.lime, background: pg.limeDim, color: pg.lime }
                        : { borderColor: pg.line, color: pg.text3 }}
                    >{v}</button>
                  ))}
                </div>
                {vehicleType && <p className={`mt-2 text-xs font-medium ${needsLicense ? 'text-yellow-400' : 'text-green-400'}`}>{needsLicense ? 'Driving licence required for this vehicle type' : 'No driving licence required for bicycle'}</p>}
              </div>
              <div>
                <label className="label flex items-center gap-1.5"><FileText size={14} /> Aadhaar Number *</label>
                <input className="input" value={aadhaarNumber} onChange={e => setAadhaarNumber(e.target.value.replace(/\D/g, '').slice(0, 12))} placeholder="12-digit Aadhaar number" maxLength={12} required />
                {aadhaarNumber.length > 0 && aadhaarNumber.length < 12 && <p className="mt-1 text-xs text-red-400">{12 - aadhaarNumber.length} more digits needed</p>}
              </div>
              <div><label className="label flex items-center gap-1.5"><Phone size={14} /> Emergency Contact *</label><input className="input" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} placeholder="+91 98765 43210" required /></div>
              {error && <ErrorBanner message={error} />}
              <CTA type="submit" className="w-full">Continue <ArrowRight size={16} /></CTA>
            </form>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="mb-1 text-xl font-extrabold">Documents & Photo</h2>
            <p className="mb-5 text-sm" style={{ color: pg.text3 }}>Upload your profile photo, Aadhaar{needsLicense ? ', and driving licence' : ''}. All required.</p>
            <form onSubmit={handleStep3} className="space-y-5">
              <div>
                <label className="label flex items-center gap-1.5"><Camera size={14} /> Profile Photo *</label>
                <input ref={photoInputRef} type="file" className="hidden" accept="image/*" capture="user" onChange={e => e.target.files?.[0] && pickFile(e.target.files[0], 'photo')} />
                {photoPreview ? (
                  <div className="relative">
                    <img src={photoPreview} alt="Profile" className="h-28 w-28 rounded-2xl object-cover" />
                    <button type="button" onClick={() => photoInputRef.current?.click()} className="absolute bottom-1 right-1 rounded-full p-1.5 shadow" style={{ background: pg.lime, color: pg.limeText }}><Camera size={14} /></button>
                  </div>
                ) : (
                  <button type="button" onClick={() => photoInputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-4" style={{ borderColor: pg.line, color: pg.text3 }}><Camera size={20} style={{ color: pg.lime }} /> Take Photo or Upload *</button>
                )}
              </div>
              <div>
                <label className="label flex items-center gap-1.5"><Upload size={14} /> Aadhaar Proof *</label>
                <input ref={aadhaarInputRef} type="file" className="hidden" accept="image/*,application/pdf" onChange={e => e.target.files?.[0] && pickFile(e.target.files[0], 'aadhaar')} />
                {aadhaarPreview ? (
                  <div className="flex items-center gap-3 rounded-2xl p-3" style={{ background: pg.surface2, border: `1px solid ${pg.line}` }}>
                    {aadhaarFile?.type.startsWith('image') ? <img src={aadhaarPreview} alt="Aadhaar" className="h-14 w-14 rounded-lg object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-lg "><FileText size={24} className="text-green-400" /></div>}
                    <div className="flex-1 min-w-0"><p className="truncate text-sm font-medium text-white">{aadhaarFile?.name}</p><p className="text-xs text-green-400">Aadhaar uploaded</p></div>
                    <button type="button" onClick={() => aadhaarInputRef.current?.click()} className="btn-ghost p-2"><Upload size={16} /></button>
                  </div>
                ) : (
                  <button type="button" onClick={() => aadhaarInputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-4" style={{ borderColor: pg.line, color: pg.text3 }}><Upload size={20} style={{ color: pg.lime }} /> Upload Aadhaar *</button>
                )}
              </div>
              {needsLicense && (
                <div>
                  <label className="label flex items-center gap-1.5"><FileText size={14} /> Driving Licence *</label>
                  <input ref={licenseInputRef} type="file" className="hidden" accept="image/*,application/pdf" onChange={e => e.target.files?.[0] && pickFile(e.target.files[0], 'license')} />
                  {licensePreview ? (
                    <div className="flex items-center gap-3 rounded-2xl p-3" style={{ background: pg.surface2, border: `1px solid ${pg.line}` }}>
                      {licenseFile?.type.startsWith('image') ? <img src={licensePreview} alt="Licence" className="h-14 w-14 rounded-lg object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-lg "><FileText size={24} className="text-green-400" /></div>}
                      <div className="flex-1 min-w-0"><p className="truncate text-sm font-medium text-white">{licenseFile?.name}</p><p className="text-xs text-green-400">Licence uploaded</p></div>
                      <button type="button" onClick={() => licenseInputRef.current?.click()} className="btn-ghost p-2"><Upload size={16} /></button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => licenseInputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-4" style={{ borderColor: pg.line, color: pg.text3 }}><Upload size={20} style={{ color: pg.warning }} /> Upload Driving Licence *</button>
                  )}
                </div>
              )}
              <Surface className="flex items-start gap-2 p-3 text-xs" style={{ background: pg.bgElevated }}>
                <Shield size={14} className="mt-0.5 shrink-0" style={{ color: pg.lime }} /> Your documents are securely stored and only visible to admin for verification.
              </Surface>
              {error && <ErrorBanner message={error} />}
              <CTA type="submit" disabled={loading} className="w-full">{loading ? 'Submitting application...' : 'Submit Application'}</CTA>
            </form>
          </>
        )}
      </div>

      {step === 1 && (
        <p className="mt-4 text-center text-sm" style={{ color: pg.text3 }}>Already a delivery partner?{' '}
          <button type="button" onClick={() => navigate('/auth')} className="font-extrabold hover:underline" style={{ color: pg.lime }}>Sign in here</button>
        </p>
      )}
    </AuthLayout>
  )
}

function DpSuccessScreen({ onContinue }: { onContinue: () => void }) {
  const [countdown, setCountdown] = useState(5)
  useEffect(() => {
    if (countdown <= 0) { onContinue(); return }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown, onContinue])

  return (
    <AuthLayout showBrand={false}>
      <div className="text-center animate-bounce-in">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: pg.lime }}>
          <CheckCircle size={32} style={{ color: pg.limeText }} />
        </div>
        <h2 className="mb-2 text-2xl font-extrabold">Application Submitted!</h2>
        <p className="mb-4 text-sm" style={{ color: pg.text3 }}>Your delivery partner application is now under review. You'll be notified once an admin approves it.</p>
        <Surface accent className="mb-4 p-4">
          <p className="text-sm font-extrabold" style={{ color: pg.lime }}>Awaiting Admin Approval</p>
          <p className="mt-1 text-xs" style={{ color: pg.text3 }}>Redirecting to sign in page in {countdown}s...</p>
        </Surface>
        <CTA onClick={onContinue} className="w-full">Go to Sign In Now</CTA>
      </div>
    </AuthLayout>
  )
}
