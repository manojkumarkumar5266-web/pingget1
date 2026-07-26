import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context'
import { supabase } from '../lib/supabase'
import { ErrorBanner } from '../components/ui'
import AuthLayout from '../components/AuthLayout'
import {
  User, Phone, MapPin, Mail, Lock, Eye, EyeOff,
  CircleCheck as CheckCircle, Circle as XCircle, ArrowRight, KeyRound,
  ChevronDown, Shield, Bike, Truck, FileText, Camera, Upload, Loader2,
} from 'lucide-react'

type Mode = 'signin' | 'signup' | 'signup_success' | 'dp_success' | 'forgot'
type Role = 'user' | 'dp'
type PincodeStatus = { served: boolean; area?: string; city?: string } | null

const VEHICLE_TYPES = ['Bicycle', 'Motorbike', 'Scooter', 'Auto', 'Car', 'Other']
const LICENSE_REQUIRED = ['Motorbike', 'Scooter', 'Auto', 'Car', 'Other']

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

        // Try matching the geocoded area name against pincodes in our DB
        if (areaName) {
          const { data: allPins } = await supabase.from('pincodes').select('pincode, area_name').eq('is_active', true)
          const matched = (allPins || []).find((p: any) => {
            const dbArea = (p.area_name || '').toLowerCase()
            return dbArea && (areaName.includes(dbArea) || dbArea.includes(areaName))
          })
          if (matched?.pincode) { setPin(matched.pincode); return }
        }

        // Fall back to the raw postcode from the geocoder
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

export default function AuthScreen() {
  const { signInWithEmail, signInWithGoogle, refreshProfile, oauthError, clearOauthError } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('signin')
  const [role, setRole] = useState<Role>('user')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submittingRef = useRef(false)
  const [showPassword, setShowPassword] = useState(false)
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false)

  useEffect(() => {
    if (oauthError) { setError(oauthError); clearOauthError() }
  }, [oauthError, clearOauthError])

  useEffect(() => {
    const dpBlocked = sessionStorage.getItem('pingget_dp_blocked_msg')
    if (dpBlocked) { setError(dpBlocked); sessionStorage.removeItem('pingget_dp_blocked_msg') }
  }, [])

  // Sign in fields
  const [signInEmail, setSignInEmail] = useState('')
  const [signInPassword, setSignInPassword] = useState('')

  // Sign up fields (user)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [pincode, setPincode] = useState('')
  const [pincodeStatus, setPincodeStatus] = useState<PincodeStatus>(null)
  const [pincodeChecking, setPincodeChecking] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Forgot password
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)

  // DP signup step state
  const [dpStep, setDpStep] = useState<1 | 2 | 3>(1)
  const [vehicleType, setVehicleType] = useState('')
  const [aadhaarNumber, setAadhaarNumber] = useState('')
  const [emergencyContact, setEmergencyContact] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [aadhaarFile, setAadhaarFile] = useState<File | null>(null)
  const [aadhaarPreview, setAadhaarPreview] = useState<string | null>(null)
  const [licenseFile, setLicenseFile] = useState<File | null>(null)
  const [licensePreview, setLicensePreview] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const aadhaarInputRef = useRef<HTMLInputElement>(null)
  const licenseInputRef = useRef<HTMLInputElement>(null)
  const pinDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const needsLicense = LICENSE_REQUIRED.includes(vehicleType)

  // ── Pincode check (shared by user signup) ──
  useEffect(() => {
    if (pincode.length !== 6) { setPincodeStatus(null); return }
    if (pinDebounceRef.current) clearTimeout(pinDebounceRef.current)
    pinDebounceRef.current = setTimeout(async () => {
      setPincodeChecking(true)
      const { data: pins } = await supabase.from('pincodes').select('area_name, city_id').eq('pincode', pincode).eq('is_active', true).limit(1)
      const pin = pins?.[0]
      if (!pin) { setPincodeChecking(false); setPincodeStatus({ served: false }); return }
      const { data: city } = await supabase.from('cities').select('name, is_active').eq('id', pin.city_id).maybeSingle()
      setPincodeChecking(false)
      if (city?.is_active) setPincodeStatus({ served: true, area: pin.area_name || '', city: city.name })
      else setPincodeStatus({ served: false })
    }, 500)
    return () => { if (pinDebounceRef.current) clearTimeout(pinDebounceRef.current) }
  }, [pincode])

  // ── Auto-detect pincode in background on mount (for signup forms) ──
  const [autoDetecting, setAutoDetecting] = useState(false)
  useEffect(() => {
    if (mode !== 'signup' || pincode) return
    setAutoDetecting(true)
    autoDetectPincode((v) => { setPincode(v); setAutoDetecting(false) }, () => setAutoDetecting(false))
  }, [mode, pincode])

  // ── Helpers ──
  const resetDpFields = () => {
    setDpStep(1); setVehicleType(''); setAadhaarNumber(''); setEmergencyContact('')
    setPhotoFile(null); setPhotoPreview(null); setAadhaarFile(null); setAadhaarPreview(null)
    setLicenseFile(null); setLicensePreview(null)
  }

  const resetAllSignupFields = () => {
    setFullName(''); setPhone(''); setPincode(''); setPincodeStatus(null)
    setEmail(''); setPassword(''); setConfirmPassword('')
    resetDpFields()
  }

  const switchToSignUp = () => {
    setMode('signup'); setError(null); resetDpFields()
  }
  const switchToSignIn = () => {
    setMode('signin'); setError(null); resetDpFields()
  }

  const uploadFile = async (file: File, path: string, bucket: string): Promise<string | null> => {
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
    if (error) return null
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
  }

  // Pre-flight: ensure the email isn't already used by the other role.
  // Supabase auth already enforces one email per account globally; this
  // gives the user a clear, role-aware message instead of a generic duplicate.
  const checkEmailAvailable = async (rawEmail: string, chosenRole: Role): Promise<string | null> => {
    const email = rawEmail.trim().toLowerCase()
    if (!email) return null
    try {
      const { data, error } = await supabase
        .from('profiles').select('role').ilike('email', email).maybeSingle()
      if (error || !data) return null
      const existingRole: string | null = data.role || null
      if (existingRole === 'admin') return 'This email belongs to an admin account and cannot be used to sign up.'
      const existingLabel = existingRole === 'dp' ? 'a Delivery Partner' : 'a User'
      const chosenLabel = chosenRole === 'dp' ? 'Delivery Partner' : 'User'
      return `This email is already registered as ${existingLabel}. Please use a different email, or sign in as ${existingLabel} instead. You cannot use the same email for both ${chosenLabel} and ${existingLabel} accounts.`
    } catch {
      return null
    }
  }

  const pickDpFile = (file: File, type: 'photo' | 'aadhaar' | 'license') => {
    const url = URL.createObjectURL(file)
    if (type === 'photo') { setPhotoFile(file); setPhotoPreview(url) }
    else if (type === 'aadhaar') { setAadhaarFile(file); setAadhaarPreview(url) }
    else { setLicenseFile(file); setLicensePreview(url) }
  }

  // ── Sign In ──
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null)
    if (!signInEmail.trim() || !signInPassword) { setError('Please enter your email and password'); return }
    setLoading(true)
    const { error: signInError } = await signInWithEmail(signInEmail.trim(), signInPassword)
    if (signInError) {
      const msg = signInError.toLowerCase()
      if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
        setError('These credentials do not match our records. Please check your email and password, or sign up first.')
      } else {
        setError(signInError)
      }
      setSignInEmail(''); setSignInPassword(''); setLoading(false); return
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setError('Authentication failed. Please try again.'); setSignInEmail(''); setSignInPassword(''); setLoading(false); return }

    const { data: userProfile } = await supabase.from('profiles').select('role, status').eq('id', session.user.id).maybeSingle()
    if (!userProfile) { setError('No account found for this email. Please sign up first, then sign in.'); await supabase.auth.signOut(); setSignInEmail(''); setSignInPassword(''); setLoading(false); return }
    if (userProfile.status === 'banned' || userProfile.status === 'suspended') {
      await supabase.auth.signOut()
      setError(`Your account is ${userProfile.status}. Please contact support.`)
      setSignInEmail(''); setSignInPassword(''); setLoading(false); return
    }
    if (role === 'dp' && userProfile.role !== 'dp') {
      await supabase.auth.signOut()
      setError("This email is registered as a User, not a Delivery Partner. Please select \"User\" to sign in, or sign up as a Delivery Partner with a different email.")
      setSignInEmail(''); setSignInPassword(''); setLoading(false); return
    }
    if (role === 'user' && userProfile.role === 'dp') {
      await supabase.auth.signOut()
      setError('This email is registered as a Delivery Partner, not a User. Please select "Delivery Partner" to sign in, or sign up as a User with a different email.')
      setSignInEmail(''); setSignInPassword(''); setLoading(false); return
    }
    if (userProfile.role === 'admin') {
      await refreshProfile()
      setLoading(false)
      return
    }
    if (userProfile.role === 'dp') {
      const { data: dp } = await supabase.from('delivery_partners').select('status').eq('user_id', session.user.id).maybeSingle()
      if (dp?.status === 'pending') {
        console.log('[AuthScreen] DP pending — letting App.tsx show pending screen')
        await refreshProfile()
        setLoading(false)
        return
      }
      if (dp?.status === 'rejected' || dp?.status === 'suspended' || dp?.status === 'deleted') {
        console.log('[AuthScreen] DP rejected — letting App.tsx show rejected screen')
        await refreshProfile()
        setLoading(false)
        return
      }
    }
    await refreshProfile()
    setLoading(false)
  }

  // ── Sign Up: User ──
  const handleUserSignUp = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null)
    if (submittingRef.current) return
    if (!fullName.trim()) { setError('Full name is required'); return }
    const phoneDigits = phone.replace(/\D/g, '')
    if (phoneDigits.length < 10) { setError('Please enter a valid 10-digit mobile number'); return }
    if (pincode.length !== 6) { setError('Please enter a 6-digit pincode'); return }
    if (!pincodeStatus?.served) { setError('Sorry, we do not operate in this area yet.'); return }
    if (!email.trim() || !email.includes('@')) { setError('Please enter a valid email address'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }

    submittingRef.current = true
    setLoading(true)
    const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('phone', phoneDigits)
    if ((count ?? 0) > 0) { setError('This mobile number is already registered.'); setLoading(false); submittingRef.current = false; return }

    const emailBlocked = await checkEmailAvailable(email, 'user')
    if (emailBlocked) { setError(emailBlocked); setLoading(false); submittingRef.current = false; return }

    const { data: pinData } = await supabase.from('pincodes').select('city_id').eq('pincode', pincode).limit(1).maybeSingle()
    let cityName: string | null = null
    if (pinData?.city_id) {
      const { data: cityData } = await supabase.from('cities').select('name').eq('id', pinData.city_id).maybeSingle()
      cityName = cityData?.name || null
    }

    const { data: signupData, error: signupError } = await supabase.functions.invoke('signup-user', {
      body: {
        email: email.trim(), password, role: 'user', full_name: fullName.trim(),
        phone: phoneDigits, pincode, city: cityName,
      },
    })
    if (signupError || !signupData?.success) {
      const msg = signupError?.message || signupData?.error || 'Failed to create account.'
      if (msg.includes('already') || msg.includes('duplicate')) setError('An account with this email already exists.')
      else setError(msg)
      setLoading(false); submittingRef.current = false; return
    }

    try {
      await supabase.functions.invoke('send-email', { body: { to: email.trim(), type: 'welcome', data: { name: fullName.trim(), role: 'user' } } })
    } catch { /* best effort */ }

    setLoading(false)
    submittingRef.current = false
    setMode('signup_success')
  }

  // ── Sign Up: DP steps ──
  const handleDpStep1 = (e: React.FormEvent) => {
    e.preventDefault(); setError(null)
    if (!fullName.trim()) { setError('Full name is required'); return }
    const phoneDigits = phone.replace(/\D/g, '')
    if (phoneDigits.length < 10) { setError('Please enter a valid 10-digit phone number'); return }
    if (pincode.length !== 6) { setError('Please enter a 6-digit pincode'); return }
    if (!pincodeStatus?.served) { setError('Sorry, we do not operate in this area yet.'); return }
    if (!email.trim() || !email.includes('@')) { setError('Please enter a valid email'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    setDpStep(2)
  }

  const handleDpStep2 = (e: React.FormEvent) => {
    e.preventDefault(); setError(null)
    if (!vehicleType) { setError('Please select a vehicle type'); return }
    if (aadhaarNumber.length !== 12) { setError('Aadhaar number must be exactly 12 digits'); return }
    if (!emergencyContact.trim()) { setError('Emergency contact is required'); return }
    setDpStep(3)
  }

  const handleDpStep3 = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null)
    if (submittingRef.current) return
    if (!photoFile) { setError('Profile photo is required'); return }
    if (!aadhaarFile) { setError('Aadhaar document is required'); return }
    if (needsLicense && !licenseFile) { setError('Driving licence is required for your vehicle type'); return }

    submittingRef.current = true
    setLoading(true)
    try {
      const phoneDigits = phone.replace(/\D/g, '')
      const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('phone', phoneDigits)
      if ((count ?? 0) > 0) { setError('This mobile number is already registered.'); setLoading(false); submittingRef.current = false; return }

      const emailBlocked = await checkEmailAvailable(email, 'dp')
      if (emailBlocked) { setError(emailBlocked); setLoading(false); submittingRef.current = false; return }

      const { data: signupData, error: signupError } = await supabase.functions.invoke('signup-user', {
        body: {
          email: email.trim(), password, role: 'dp', full_name: fullName.trim(),
          phone: phoneDigits, pincode,
          vehicle_type: vehicleType, aadhaar_number: aadhaarNumber, emergency_contact: emergencyContact,
        },
      })
      if (signupError || !signupData?.success) {
        const msg = signupError?.message || signupData?.error || 'Failed to create account.'
        if (msg.includes('already') || msg.includes('duplicate')) setError('An account with this email already exists.')
        else setError(msg)
        setLoading(false); submittingRef.current = false; return
      }

      const userId = signupData.user_id

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

      setMode('dp_success')
    } catch (err: any) {
      setError(err.message || 'Failed to complete signup')
    } finally {
      setLoading(false)
      submittingRef.current = false
    }
  }

  // ── Google ──
  const handleGoogle = async () => {
    setError(null); setLoading(true)
    sessionStorage.setItem('pingget_oauth_mode', mode === 'signup' ? 'signup' : 'signin')
    const { error: googleError } = await signInWithGoogle(role)
    if (googleError) { setError(googleError); setLoading(false) }
  }

  // ── Forgot password ──
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null)
    if (!resetEmail.trim()) { setError('Please enter your email address'); return }
    setLoading(true)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), { redirectTo: `${window.location.origin}/reset-password` })
      if (resetError) {
        try { await supabase.functions.invoke('send-email', { body: { to: resetEmail.trim(), type: 'password_reset', data: { name: '', reset_url: `${window.location.origin}/reset-password` } } }) } catch { /* fallback */ }
      }
    } catch { /* best effort */ }
    setLoading(false); setResetSent(true)
  }

  // ── Role dropdown component ──
  const RoleDropdown = () => (
    <div className="relative">
      <button type="button" onClick={() => setRoleDropdownOpen(!roleDropdownOpen)} className="input flex items-center justify-between w-full">
        <span className="flex items-center gap-2">
          {role === 'user' ? <User size={16} /> : <Bike size={16} />}
          {role === 'user' ? 'User' : 'Delivery Partner'}
        </span>
        <ChevronDown size={16} className={`transition-transform ${roleDropdownOpen ? 'rotate-180' : ''}`} style={{ color: 'rgba(255,255,255,0.5)' }} />
      </button>
      {roleDropdownOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setRoleDropdownOpen(false)} />
          <div className="absolute z-20 mt-1 w-full rounded-xl border border-white/10 overflow-hidden animate-fade-in" style={{ background: '#1c2a14' }}>
            <button type="button" onClick={() => { setRole('user'); setRoleDropdownOpen(false); setError(null); resetAllSignupFields() }} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors">
              <User size={18} className="mt-0.5 shrink-0" style={{ color: '#808000' }} />
              <div><p className="text-sm font-semibold text-white">User</p><p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Order groceries, medicines, parcels & more</p></div>
            </button>
            <button type="button" onClick={() => { setRole('dp'); setRoleDropdownOpen(false); setError(null); resetAllSignupFields() }} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors border-t border-white/5">
              <Bike size={18} className="mt-0.5 shrink-0" style={{ color: '#808000' }} />
              <div><p className="text-sm font-semibold text-white">Delivery Partner</p><p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Earn money delivering in your area</p></div>
            </button>
          </div>
        </>
      )}
    </div>
  )

  // ── Google button ──
  const GoogleButton = ({ label }: { label: string }) => (
    <button type="button" onClick={handleGoogle} disabled={loading} className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-semibold text-white transition-all active:scale-95 hover:bg-white/10">
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      {loading ? 'Connecting...' : label}
    </button>
  )

  // ── Pincode status badge ──
  const PincodeBadge = () => {
    if (pincodeChecking) return <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Checking service area...</p>
    if (!pincodeStatus) return null
    return (
      <div className={`mt-1.5 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${pincodeStatus.served ? 'text-green-300' : 'text-red-300'}`}
        style={{ background: pincodeStatus.served ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${pincodeStatus.served ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
        {pincodeStatus.served
          ? <><CheckCircle size={13} /> We serve {pincodeStatus.area}{pincodeStatus.city ? `, ${pincodeStatus.city}` : ''}!</>
          : <><XCircle size={13} /> Sorry, we don't serve this area yet.</>}
      </div>
    )
  }

  // ═══════════════════════════════════════════════
  // FORGOT PASSWORD
  // ═══════════════════════════════════════════════
  if (mode === 'forgot') {
    return (
      <AuthLayout showBrand={false}>
        <div className="card p-6 animate-fade-in">
          <button onClick={() => { setMode('signin'); setError(null); setResetSent(false) }} className="text-sm mb-4 flex items-center gap-1" style={{ color: '#808000' }}>← Back to Sign In</button>
          <h2 className="text-xl font-bold text-white mb-1">Forgot Password</h2>
          <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.55)' }}>Enter your email and we'll send a reset link.</p>
          {resetSent ? (
            <div className="rounded-xl px-4 py-3 text-sm text-white glass-dark">
              <div className="flex items-center gap-2"><CheckCircle size={16} className="shrink-0 text-green-400" /> Reset link sent! Check your inbox.</div>
            </div>
          ) : (
            <form onSubmit={handleForgot} className="space-y-4">
              <div>
                <label className="label flex items-center gap-1.5"><Mail size={14} /> Email</label>
                <input type="email" className="input" value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="you@example.com" required />
              </div>
              {error && <ErrorBanner message={error} />}
              <button type="submit" disabled={loading} className="btn-primary w-full"><KeyRound size={16} /> {loading ? 'Sending...' : 'Send Reset Link'}</button>
            </form>
          )}
        </div>
      </AuthLayout>
    )
  }

  // ═══════════════════════════════════════════════
  // USER SIGNUP SUCCESS
  // ═══════════════════════════════════════════════
  if (mode === 'signup_success') {
    return (
      <AuthLayout showBrand={false}>
        <div className="card p-8 text-center animate-fade-in">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: 'linear-gradient(135deg, #808000, #484800)' }}>
            <CheckCircle size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Welcome aboard!</h2>
          <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.6)' }}>Your account is ready. Sign in to start ordering.</p>
          <button onClick={() => { setMode('signin'); setRole('user') }} className="btn-primary w-full">Sign In Now <ArrowRight size={16} /></button>
        </div>
      </AuthLayout>
    )
  }

  // ═══════════════════════════════════════════════
  // DP SIGNUP SUCCESS
  // ═══════════════════════════════════════════════
  if (mode === 'dp_success') {
    return <DpSuccessScreen onContinue={() => { setMode('signin'); setRole('dp') }} />
  }

  // ═══════════════════════════════════════════════
  // SIGN UP PAGE
  // ═══════════════════════════════════════════════
  if (mode === 'signup') {
    return (
      <AuthLayout>
        <div className="mb-3 text-center animate-fade-in">
          <h2 className="text-xl font-bold text-white">Create New Account</h2>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Select your role and fill in your details</p>
        </div>

        <div className="card p-5">
          {/* Role dropdown */}
          <div className="mb-4">
            <label className="label flex items-center gap-1.5"><Shield size={13} /> I am a...</label>
            <RoleDropdown />
          </div>

          {/* ── User signup form ── */}
          {role === 'user' && (
            <form onSubmit={handleUserSignUp} className="space-y-3">
              <div><label className="label flex items-center gap-1.5"><User size={13} /> Full Name *</label><input className="input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" required /></div>
              <div><label className="label flex items-center gap-1.5"><Phone size={13} /> Mobile Number *</label><input className="input" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile number" maxLength={10} required /></div>
              <div>
                <label className="label flex items-center gap-1.5"><MapPin size={13} /> Area Pincode *</label>
                <div className="relative">
                  <input className="input" value={pincode} onChange={e => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder={autoDetecting ? 'Detecting your location...' : '6-digit pincode'} maxLength={6} required />
                  {autoDetecting && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Loader2 size={16} className="animate-spin" style={{ color: '#808000' }} /></div>}
                </div>
                <PincodeBadge />
                {autoDetecting && <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Detecting pincode from your location...</p>}
              </div>
              <div><label className="label flex items-center gap-1.5"><Mail size={13} /> Email *</label><input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required /></div>
              <div>
                <label className="label flex items-center gap-1.5"><Lock size={13} /> Password *</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} className="input pr-10" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.45)' }}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </div>
              <div>
                <label className="label flex items-center gap-1.5"><Lock size={13} /> Confirm Password *</label>
                <input type={showPassword ? 'text' : 'password'} className="input" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter your password" required />
                {confirmPassword && password !== confirmPassword && <p className="mt-1 text-xs text-red-400">Passwords do not match</p>}
              </div>
              {error && <ErrorBanner message={error} />}
              <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? 'Creating account...' : 'Create Account'} <ArrowRight size={16} /></button>
            </form>
          )}

          {/* ── DP signup multi-step ── */}
          {role === 'dp' && (
            <div>
              {/* Progress */}
              <div className="mb-4 flex items-center gap-2">
                {[1, 2, 3].map(s => (
                  <div key={s} className="flex flex-1 items-center gap-2">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${s <= dpStep ? 'text-white' : 'bg-white/20 text-white/60'}`} style={s <= dpStep ? { backgroundColor: '#808000' } : {}}>
                      {s < dpStep ? <CheckCircle size={14} /> : s}
                    </div>
                    {s < 3 && <div className="flex-1 h-0.5 rounded-full" style={{ background: s < dpStep ? '#808000' : 'rgba(255,255,255,0.2)' }} />}
                  </div>
                ))}
              </div>

              {dpStep === 1 && (
                <form onSubmit={handleDpStep1} className="space-y-3">
                  <h3 className="text-sm font-bold text-white">Basic Information</h3>
                  <div><label className="label flex items-center gap-1.5"><User size={13} /> Full Name *</label><input className="input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" required /></div>
                  <div><label className="label flex items-center gap-1.5"><Phone size={13} /> Phone Number *</label><input className="input" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile number" maxLength={10} required /></div>
                  <div>
                    <label className="label flex items-center gap-1.5"><MapPin size={13} /> Area Pincode *</label>
                    <div className="relative">
                      <input className="input" value={pincode} onChange={e => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder={autoDetecting ? 'Detecting your location...' : '6-digit pincode'} maxLength={6} required />
                      {autoDetecting && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Loader2 size={16} className="animate-spin" style={{ color: '#808000' }} /></div>}
                    </div>
                    <PincodeBadge />
                    {autoDetecting && <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Detecting pincode from your location...</p>}
                  </div>
                  <div><label className="label flex items-center gap-1.5"><Mail size={13} /> Email *</label><input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required /></div>
                  <div>
                    <label className="label flex items-center gap-1.5"><Lock size={13} /> Password *</label>
                    <div className="relative">
                      <input type={showPassword ? 'text' : 'password'} className="input pr-10" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.45)' }}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                    </div>
                  </div>
                  <div>
                    <label className="label flex items-center gap-1.5"><Lock size={13} /> Confirm Password *</label>
                    <input type={showPassword ? 'text' : 'password'} className="input" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter your password" required />
                    {confirmPassword && password !== confirmPassword && <p className="mt-1 text-xs text-red-400">Passwords do not match</p>}
                  </div>
                  {error && <ErrorBanner message={error} />}
                  <button type="submit" className="btn-primary w-full">Continue <ArrowRight size={16} /></button>
                </form>
              )}

              {dpStep === 2 && (
                <form onSubmit={handleDpStep2} className="space-y-3">
                  <h3 className="text-sm font-bold text-white">Vehicle & Identity</h3>
                  <div>
                    <label className="label flex items-center gap-1.5"><Truck size={13} /> Vehicle Type *</label>
                    <div className="grid grid-cols-3 gap-2">
                      {VEHICLE_TYPES.map(v => (
                        <button key={v} type="button" onClick={() => setVehicleType(v)} className={`rounded-xl border-2 py-2.5 text-sm font-medium transition-all ${vehicleType === v ? 'text-white' : 'border-white/15 text-white/40'}`} style={vehicleType === v ? { backgroundColor: '#808000', borderColor: '#808000' } : {}}>{v}</button>
                      ))}
                    </div>
                    {vehicleType && <p className={`mt-2 text-xs font-medium ${needsLicense ? 'text-yellow-400' : 'text-green-400'}`}>{needsLicense ? 'Driving licence required for this vehicle type' : 'No driving licence required for bicycle'}</p>}
                  </div>
                  <div>
                    <label className="label flex items-center gap-1.5"><FileText size={13} /> Aadhaar Number *</label>
                    <input className="input" value={aadhaarNumber} onChange={e => setAadhaarNumber(e.target.value.replace(/\D/g, '').slice(0, 12))} placeholder="12-digit Aadhaar number" maxLength={12} required />
                    {aadhaarNumber.length > 0 && aadhaarNumber.length < 12 && <p className="mt-1 text-xs text-red-400">{12 - aadhaarNumber.length} more digits needed</p>}
                  </div>
                  <div><label className="label flex items-center gap-1.5"><Phone size={13} /> Emergency Contact *</label><input className="input" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} placeholder="+91 98765 43210" required /></div>
                  {error && <ErrorBanner message={error} />}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setDpStep(1); setError(null) }} className="btn-ghost flex-1">Back</button>
                    <button type="submit" className="btn-primary flex-1">Continue <ArrowRight size={16} /></button>
                  </div>
                </form>
              )}

              {dpStep === 3 && (
                <form onSubmit={handleDpStep3} className="space-y-4">
                  <h3 className="text-sm font-bold text-white">Documents & Photo</h3>
                  <div>
                    <label className="label flex items-center gap-1.5"><Camera size={13} /> Profile Photo *</label>
                    <input ref={photoInputRef} type="file" className="hidden" accept="image/*" capture="user" onChange={e => e.target.files?.[0] && pickDpFile(e.target.files[0], 'photo')} />
                    {photoPreview ? (
                      <div className="relative">
                        <img src={photoPreview} alt="Profile" className="h-28 w-28 rounded-2xl object-cover" />
                        <button type="button" onClick={() => photoInputRef.current?.click()} className="absolute bottom-1 right-1 rounded-full p-1.5 text-white shadow" style={{ backgroundColor: '#808000' }}><Camera size={14} /></button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => photoInputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 text-white/50"><Camera size={20} style={{ color: '#808000' }} /> Take Photo or Upload *</button>
                    )}
                  </div>
                  <div>
                    <label className="label flex items-center gap-1.5"><Upload size={13} /> Aadhaar Proof *</label>
                    <input ref={aadhaarInputRef} type="file" className="hidden" accept="image/*,application/pdf" onChange={e => e.target.files?.[0] && pickDpFile(e.target.files[0], 'aadhaar')} />
                    {aadhaarPreview ? (
                      <div className="flex items-center gap-3 rounded-xl border p-3">
                        {aadhaarFile?.type.startsWith('image') ? <img src={aadhaarPreview} alt="Aadhaar" className="h-14 w-14 rounded-lg object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-lg"><FileText size={24} className="text-green-400" /></div>}
                        <div className="flex-1 min-w-0"><p className="truncate text-sm font-medium text-white">{aadhaarFile?.name}</p><p className="text-xs text-green-400">Aadhaar uploaded</p></div>
                        <button type="button" onClick={() => aadhaarInputRef.current?.click()} className="btn-ghost p-2"><Upload size={16} /></button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => aadhaarInputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 text-white/50"><Upload size={20} style={{ color: '#808000' }} /> Upload Aadhaar *</button>
                    )}
                  </div>
                  {needsLicense && (
                    <div>
                      <label className="label flex items-center gap-1.5"><FileText size={13} /> Driving Licence *</label>
                      <input ref={licenseInputRef} type="file" className="hidden" accept="image/*,application/pdf" onChange={e => e.target.files?.[0] && pickDpFile(e.target.files[0], 'license')} />
                      {licensePreview ? (
                        <div className="flex items-center gap-3 rounded-xl border p-3">
                          {licenseFile?.type.startsWith('image') ? <img src={licensePreview} alt="Licence" className="h-14 w-14 rounded-lg object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-lg"><FileText size={24} className="text-green-400" /></div>}
                          <div className="flex-1 min-w-0"><p className="truncate text-sm font-medium text-white">{licenseFile?.name}</p><p className="text-xs text-green-400">Licence uploaded</p></div>
                          <button type="button" onClick={() => licenseInputRef.current?.click()} className="btn-ghost p-2"><Upload size={16} /></button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => licenseInputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 text-white/50"><Upload size={20} className="text-yellow-400" /> Upload Driving Licence *</button>
                      )}
                    </div>
                  )}
                  {error && <ErrorBanner message={error} />}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setDpStep(2); setError(null) }} className="btn-ghost flex-1">Back</button>
                    <button type="submit" disabled={loading} className="btn-primary flex-1">{loading ? 'Submitting...' : 'Submit Application'}</button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Create account / Sign in link */}
          <p className="mt-4 text-center text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Already have an account?{' '}
            <button onClick={switchToSignIn} className="font-semibold hover:underline" style={{ color: '#808000' }}>Sign in here</button>
          </p>
        </div>
      </AuthLayout>
    )
  }

  // ═══════════════════════════════════════════════
  // SIGN IN PAGE (default)
  // ═══════════════════════════════════════════════
  return (
    <AuthLayout>
      <div className="mb-3 text-center animate-fade-in">
        <h2 className="text-xl font-bold text-white">Sign In</h2>
        <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Select your role and enter your credentials</p>
      </div>

      <div className="card p-5">
        <form onSubmit={handleSignIn} className="space-y-4">
          {/* Role dropdown */}
          <div>
            <label className="label flex items-center gap-1.5"><Shield size={13} /> I am a...</label>
            <RoleDropdown />
          </div>
          <div>
            <label className="label flex items-center gap-1.5"><Mail size={13} /> Email</label>
            <input type="email" className="input" value={signInEmail} onChange={e => setSignInEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
          </div>
          <div>
            <label className="label flex items-center gap-1.5"><Lock size={13} /> Password</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} className="input pr-10" value={signInPassword} onChange={e => setSignInPassword(e.target.value)} placeholder="Your password" autoComplete="current-password" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.45)' }}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
            <div className="mt-1.5 text-right">
              <button type="button" onClick={() => { setMode('forgot'); setError(null) }} className="text-xs hover:underline" style={{ color: '#808000' }}>Forgot password?</button>
            </div>
          </div>
          {error && <ErrorBanner message={error} />}
          <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? 'Signing in...' : 'Sign In'} <ArrowRight size={16} /></button>
        </form>

        {/* Divider */}
        <div className="my-4 flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>or</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
        </div>

        <GoogleButton label="Sign in with Google" />

        {/* Create account link */}
        <p className="mt-4 text-center text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Don't have an account?{' '}
          <button onClick={switchToSignUp} className="font-semibold hover:underline" style={{ color: '#808000' }}>Create new account</button>
        </p>

      </div>
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
      <div className="card p-8 text-center animate-bounce-in">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: 'linear-gradient(135deg, #808000, #484800)' }}>
          <CheckCircle size={32} className="text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Application Submitted!</h2>
        <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.6)' }}>Your delivery partner application is now under review. You'll be notified once an admin approves it.</p>
        <div className="rounded-xl border p-4 mb-4" style={{ borderColor: 'rgba(143,169,100,0.3)', background: 'rgba(143,169,100,0.08)' }}>
          <p className="text-sm font-medium" style={{ color: '#808000' }}>Awaiting Admin Approval</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Redirecting to sign in page in {countdown}s...</p>
        </div>
        <button onClick={onContinue} className="btn-primary w-full">Go to Sign In Now</button>
      </div>
    </AuthLayout>
  )
}
