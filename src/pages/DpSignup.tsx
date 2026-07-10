import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context'
import { supabase } from '../lib/supabase'
import { ErrorBanner } from '../components/ui'
import AuthLayout from '../components/AuthLayout'
import { ArrowLeft, ArrowRight, Camera, Upload, Mail, MapPin, User, Phone, Truck, FileText, Shield, CircleCheck as CheckCircle, Circle as XCircle, Chrome as Home, Lock, Eye, EyeOff, KeyRound } from 'lucide-react'

type View = 'signup' | 'signin' | 'forgot' | 'success'
type Step = 1 | 2 | 3 | 4

const VEHICLE_TYPES = ['Bicycle', 'Motorbike', 'Scooter', 'Auto', 'Car', 'Other']
const LICENSE_REQUIRED = ['Motorbike', 'Scooter', 'Auto', 'Car', 'Other']

type PincodeStatus = { served: boolean; area?: string; city?: string } | null

export default function DpSignup() {
  const { signInWithEmail, signUpWithEmail } = useAuth()
  const navigate = useNavigate()

  const [view, setView] = useState<View>('signup')
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  // Sign-in fields (DP sign in)
  const [signInEmail, setSignInEmail] = useState('')
  const [signInPassword, setSignInPassword] = useState('')

  // Forgot password
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)

  // Step 1 — basic info + credentials
  const [fullName, setFullName] = useState('')
  const [address, setAddress] = useState('')
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
    if (!address.trim()) { setError('Address is required'); return }
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

      // Create auth user
      const { error: signUpError } = await signUpWithEmail(email.trim(), password)
      if (signUpError) { setError(signUpError); setLoading(false); return }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setError('Failed to create account. Please try again.'); setLoading(false); return }

      const userId = session.user.id

      // Insert profile
      const { error: profileError } = await supabase.from('profiles').insert({
        id: userId, role: 'dp', full_name: fullName.trim(),
        phone: phoneDigits, address: address.trim(), pincode, status: 'active',
      })

      if (profileError) {
        if (profileError.message.includes('profiles_phone_unique')) {
          setError('This mobile number is already registered.')
        } else if (profileError.message.includes('duplicate')) {
          setError('An account with this email already exists. Please sign in instead.')
        } else {
          setError(profileError.message)
        }
        await supabase.auth.signOut()
        setLoading(false)
        return
      }

      // Insert delivery_partner record
      const { error: dpError } = await supabase.from('delivery_partners').insert({
        user_id: userId, vehicle_type: vehicleType,
        aadhaar_number: aadhaarNumber, emergency_contact: emergencyContact, status: 'pending',
      })
      if (dpError && !dpError.message.includes('duplicate')) {
        setError(dpError.message)
        await supabase.auth.signOut()
        setLoading(false)
        return
      }

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

      // FIXED: Sign out the partial session and show step 4 success
      await supabase.auth.signOut()
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
    setLoading(true)
    const { error: signInError } = await signInWithEmail(signInEmail.trim(), signInPassword)
    if (signInError) { setError(signInError); setLoading(false); return }
    // App.tsx redirects based on profile role
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!resetEmail.trim()) { setError('Please enter your email address'); return }
    setLoading(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: window.location.origin + '/dp-signup',
    })
    setLoading(false)
    if (resetError) { setError(resetError.message); return }
    setResetSent(true)
  }

  // ---- FORGOT PASSWORD ----
  if (view === 'forgot') {
    return (
      <AuthLayout showBrand={false}>
        <div className="card p-6">
          <button onClick={() => { setView('signin'); setError(null); setResetSent(false) }} className="text-sm text-primary-600 dark:text-primary-400 mb-4">← Back to Sign In</button>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Forgot Password</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Enter your email and we&apos;ll send you a reset link.</p>
          {resetSent ? (
            <div className="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-800 dark:bg-success-900/30 dark:text-success-300">
              <div className="flex items-center gap-2"><CheckCircle size={16} className="shrink-0" /> Reset link sent! Check your email.</div>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="label flex items-center gap-1.5"><Mail size={14} /> Email</label>
                <input type="email" className="input" value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="you@example.com" required />
              </div>
              {error && <ErrorBanner message={error} />}
              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2"><KeyRound size={16} /> {loading ? 'Sending...' : 'Send Reset Link'}</button>
            </form>
          )}
        </div>
      </AuthLayout>
    )
  }

  // ---- DP SIGN IN ----
  if (view === 'signin') {
    return (
      <AuthLayout showBrand={false}>
        <div className="card p-6">
          <button onClick={() => { setView('signup'); setStep(1); setError(null) }} className="text-sm text-primary-600 dark:text-primary-400 mb-4">← Back</button>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Delivery Partner Sign In</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Sign in with your email and password</p>
          {error && <ErrorBanner message={error} />}
          <form onSubmit={handleDpSignIn} className="space-y-4">
            <div>
              <label className="label flex items-center gap-1.5"><Mail size={14} /> Email</label>
              <input type="email" className="input" value={signInEmail} onChange={e => setSignInEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div>
              <label className="label flex items-center gap-1.5"><Lock size={14} /> Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} className="input pr-10" value={signInPassword} onChange={e => setSignInPassword(e.target.value)} placeholder="Your password" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="text-right">
              <button type="button" onClick={() => { setView('forgot'); setError(null); setResetSent(false) }} className="text-xs text-primary-600 dark:text-primary-400 hover:underline">Forgot password?</button>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? 'Signing in...' : 'Sign In'}</button>
          </form>
          <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
            Don&apos;t have an account?{' '}
            <button onClick={() => { setView('signup'); setStep(1); setError(null) }} className="text-primary-600 dark:text-primary-400 font-semibold hover:underline">Sign up here</button>
          </p>
        </div>
      </AuthLayout>
    )
  }

  // ---- SUCCESS (step 4) ----
  if (step === 4) {
    return (
      <AuthLayout showBrand={false}>
        <div className="card p-6 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-100 dark:bg-success-900/40">
              <CheckCircle size={32} className="text-success-600 dark:text-success-400" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Application Submitted!</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Your delivery partner application is under review. We&apos;ll notify you once approved.</p>
          <div className="mt-4 rounded-xl border border-primary-100 bg-primary-50 p-4 dark:border-primary-900/40 dark:bg-primary-900/20">
            <p className="text-sm font-medium text-primary-800 dark:text-primary-300">Once an admin approves your application, sign in with your email and password to start accepting requests.</p>
          </div>
          <button onClick={() => navigate('/auth')} className="btn-primary mt-5 w-full">Go to Sign In</button>
        </div>
      </AuthLayout>
    )
  }

  // ---- SIGNUP FLOW (steps 1-3) ----
  return (
    <AuthLayout>
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => { if (step === 2) { setStep(1); setError(null) } else if (step === 3) { setStep(2); setError(null) } else navigate('/auth') }}
          className="btn-ghost p-2 text-white"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1"></div>
      </div>

      <div className="mb-2 text-center">
        <h2 className="text-xl font-bold text-white">Earn money delivering in your neighbourhood!</h2>
        <p className="mt-1 text-sm text-white/70">Join as a delivery partner and get started today</p>
      </div>

      {/* Progress */}
      <div className="mb-3 flex items-center gap-2">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${s <= step ? 'text-white' : 'bg-white/20 text-white/60'}`} style={s <= step ? { backgroundColor: '#808000' } : {}}>
              {s < step ? <CheckCircle size={14} /> : s}
            </div>
            {s < 4 && <div className="flex-1 h-0.5 rounded-full" style={{ background: s < step ? '#808000' : 'rgba(255,255,255,0.2)' }} />}
          </div>
        ))}
      </div>

      <div className="card p-6">
        {step === 1 && (
          <>
            <h2 className="mb-1 text-xl font-bold text-gray-900 dark:text-white">Basic Information</h2>
            <p className="mb-5 text-sm text-gray-500">All fields are required</p>
            <form onSubmit={handleStep1} className="space-y-4">
              <div><label className="label flex items-center gap-1.5"><User size={14} /> Full Name *</label><input className="input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" required /></div>
              <div><label className="label flex items-center gap-1.5"><Home size={14} /> Address *</label><input className="input" value={address} onChange={e => setAddress(e.target.value)} placeholder="Your full address" required /></div>
              <div><label className="label flex items-center gap-1.5"><Phone size={14} /> Phone Number *</label><input className="input" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile number" maxLength={10} required /></div>
              <div>
                <label className="label flex items-center gap-1.5"><MapPin size={14} /> Your Area Pincode *</label>
                <input className="input" value={pincode} onChange={e => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit pincode" maxLength={6} required />
                {pincodeChecking && <p className="mt-1.5 text-xs text-gray-400">Checking service area...</p>}
                {!pincodeChecking && pincodeStatus && (
                  <div className={`mt-1.5 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${pincodeStatus.served ? 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300' : 'bg-error-50 text-error-700 dark:bg-error-900/30 dark:text-error-300'}`}>
                    {pincodeStatus.served ? <><CheckCircle size={13} /> We operate in {pincodeStatus.area}{pincodeStatus.city ? `, ${pincodeStatus.city}` : ''}!</> : <><XCircle size={13} /> We don&apos;t operate in this area yet.</>}
                  </div>
                )}
              </div>
              <div><label className="label flex items-center gap-1.5"><Mail size={14} /> Email *</label><input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required /></div>
              <div>
                <label className="label flex items-center gap-1.5"><Lock size={14} /> Password *</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} className="input pr-10" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </div>
              <div>
                <label className="label flex items-center gap-1.5"><Lock size={14} /> Confirm Password *</label>
                <input type={showPassword ? 'text' : 'password'} className="input" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter your password" required />
                {confirmPassword && password !== confirmPassword && <p className="mt-1 text-xs text-error-600">Passwords do not match</p>}
              </div>
              {error && <ErrorBanner message={error} />}
              <button type="submit" className="btn-primary w-full">Continue <ArrowRight size={16} /></button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="mb-1 text-xl font-bold text-gray-900 dark:text-white">Vehicle & Identity</h2>
            <p className="mb-5 text-sm text-gray-500">All fields are required</p>
            <form onSubmit={handleStep2} className="space-y-4">
              <div>
                <label className="label flex items-center gap-1.5"><Truck size={14} /> Vehicle Type *</label>
                <div className="grid grid-cols-3 gap-2">
                  {VEHICLE_TYPES.map(v => (
                    <button key={v} type="button" onClick={() => setVehicleType(v)}
                      className={`rounded-xl border-2 py-2.5 text-sm font-medium transition-all ${vehicleType === v ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400'}`}
                    >{v}</button>
                  ))}
                </div>
                {vehicleType && <p className={`mt-2 text-xs font-medium ${needsLicense ? 'text-warning-600 dark:text-warning-400' : 'text-success-600 dark:text-success-400'}`}>{needsLicense ? 'Driving licence required for this vehicle type' : 'No driving licence required for bicycle'}</p>}
              </div>
              <div>
                <label className="label flex items-center gap-1.5"><FileText size={14} /> Aadhaar Number *</label>
                <input className="input" value={aadhaarNumber} onChange={e => setAadhaarNumber(e.target.value.replace(/\D/g, '').slice(0, 12))} placeholder="12-digit Aadhaar number" maxLength={12} required />
                {aadhaarNumber.length > 0 && aadhaarNumber.length < 12 && <p className="mt-1 text-xs text-error-600">{12 - aadhaarNumber.length} more digits needed</p>}
              </div>
              <div><label className="label flex items-center gap-1.5"><Phone size={14} /> Emergency Contact *</label><input className="input" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} placeholder="+91 98765 43210" required /></div>
              {error && <ErrorBanner message={error} />}
              <button type="submit" className="btn-primary w-full">Continue <ArrowRight size={16} /></button>
            </form>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="mb-1 text-xl font-bold text-gray-900 dark:text-white">Documents & Photo</h2>
            <p className="mb-5 text-sm text-gray-500">Upload your profile photo, Aadhaar{needsLicense ? ', and driving licence' : ''}. All required.</p>
            <form onSubmit={handleStep3} className="space-y-5">
              <div>
                <label className="label flex items-center gap-1.5"><Camera size={14} /> Profile Photo *</label>
                <input ref={photoInputRef} type="file" className="hidden" accept="image/*" capture="user" onChange={e => e.target.files?.[0] && pickFile(e.target.files[0], 'photo')} />
                {photoPreview ? (
                  <div className="relative">
                    <img src={photoPreview} alt="Profile" className="h-28 w-28 rounded-2xl object-cover" />
                    <button type="button" onClick={() => photoInputRef.current?.click()} className="absolute bottom-1 right-1 rounded-full p-1.5 text-white shadow" style={{ backgroundColor: '#808000' }}><Camera size={14} /></button>
                  </div>
                ) : (
                  <button type="button" onClick={() => photoInputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 py-8 text-sm font-medium text-gray-500 hover:border-primary-400 dark:border-gray-700"><Camera size={20} style={{ color: '#808000' }} /> Take Photo or Upload *</button>
                )}
              </div>
              <div>
                <label className="label flex items-center gap-1.5"><Upload size={14} /> Aadhaar Proof *</label>
                <input ref={aadhaarInputRef} type="file" className="hidden" accept="image/*,application/pdf" onChange={e => e.target.files?.[0] && pickFile(e.target.files[0], 'aadhaar')} />
                {aadhaarPreview ? (
                  <div className="flex items-center gap-3 rounded-xl border border-success-200 bg-success-50 p-3 dark:border-success-800 dark:bg-success-900/20">
                    {aadhaarFile?.type.startsWith('image') ? <img src={aadhaarPreview} alt="Aadhaar" className="h-14 w-14 rounded-lg object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-success-100 dark:bg-success-900/40"><FileText size={24} className="text-success-600" /></div>}
                    <div className="flex-1 min-w-0"><p className="truncate text-sm font-medium text-gray-900 dark:text-white">{aadhaarFile?.name}</p><p className="text-xs text-success-600">Aadhaar uploaded</p></div>
                    <button type="button" onClick={() => aadhaarInputRef.current?.click()} className="btn-ghost p-2"><Upload size={16} /></button>
                  </div>
                ) : (
                  <button type="button" onClick={() => aadhaarInputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 py-8 text-sm font-medium text-gray-500 hover:border-primary-400 dark:border-gray-700"><Upload size={20} style={{ color: '#808000' }} /> Upload Aadhaar *</button>
                )}
              </div>
              {needsLicense && (
                <div>
                  <label className="label flex items-center gap-1.5"><FileText size={14} /> Driving Licence *</label>
                  <input ref={licenseInputRef} type="file" className="hidden" accept="image/*,application/pdf" onChange={e => e.target.files?.[0] && pickFile(e.target.files[0], 'license')} />
                  {licensePreview ? (
                    <div className="flex items-center gap-3 rounded-xl border border-success-200 bg-success-50 p-3 dark:border-success-800 dark:bg-success-900/20">
                      {licenseFile?.type.startsWith('image') ? <img src={licensePreview} alt="Licence" className="h-14 w-14 rounded-lg object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-success-100 dark:bg-success-900/40"><FileText size={24} className="text-success-600" /></div>}
                      <div className="flex-1 min-w-0"><p className="truncate text-sm font-medium text-gray-900 dark:text-white">{licenseFile?.name}</p><p className="text-xs text-success-600">Licence uploaded</p></div>
                      <button type="button" onClick={() => licenseInputRef.current?.click()} className="btn-ghost p-2"><Upload size={16} /></button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => licenseInputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-warning-200 py-8 text-sm font-medium text-gray-500 hover:border-warning-400 dark:border-warning-800"><Upload size={20} className="text-warning-500" /> Upload Driving Licence *</button>
                  )}
                </div>
              )}
              <div className="flex items-start gap-2 rounded-xl bg-accent-50 p-3 text-xs text-accent-700 dark:bg-accent-950/40 dark:text-accent-300"><Shield size={14} className="mt-0.5 shrink-0" /> Your documents are securely stored and only visible to admin for verification.</div>
              {error && <ErrorBanner message={error} />}
              <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? 'Submitting application...' : 'Submit Application'}</button>
            </form>
          </>
        )}
      </div>

      {step === 1 && (
        <p className="mt-4 text-center text-sm text-white/70">Already a delivery partner?{' '}
          <button onClick={() => { setView('signin'); setError(null) }} className="font-semibold hover:underline" style={{ color: '#808000' }}>Sign in here</button>
        </p>
      )}
    </AuthLayout>
  )
}
