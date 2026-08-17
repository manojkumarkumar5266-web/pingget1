import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context'
import { supabase } from '../lib/supabase'
import { invokeEdgeFunction } from '../lib/invokeEdgeFunction'
import { uploadDpSignupDocuments } from '../lib/uploadDpSignupDocs'
import { ErrorBanner } from '../components/ui'
import AuthLayout from '../components/AuthLayout'
import { pg } from '../design/tokens'
import { CTA } from '../design/primitives'
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

type AuthScreenProps = {
  /** When set, this screen is locked to one app (User or DP). No role switcher. */
  fixedRole?: Role
}

export default function AuthScreen({ fixedRole }: AuthScreenProps) {
  const { signInWithEmail, signInWithGoogle, refreshProfile, oauthError, clearOauthError } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('signin')
  const [role, setRole] = useState<Role>(fixedRole || 'user')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submittingRef = useRef(false)
  const [showPassword, setShowPassword] = useState(false)
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false)
  const roleLocked = !!fixedRole

  useEffect(() => {
    if (fixedRole) setRole(fixedRole)
  }, [fixedRole])

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
  const [waitlistBusy, setWaitlistBusy] = useState(false)
  const [waitlistDone, setWaitlistDone] = useState(false)
  const [waitlistErr, setWaitlistErr] = useState<string | null>(null)
  const [detectedRole, setDetectedRole] = useState<Role | null>(null)
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
    if (pincode.length !== 6) { setPincodeStatus(null); setWaitlistDone(false); return }
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

  // Auto-detect is disabled — users must enter their pincode manually

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

  // Detect role from email as user types on sign-in (skip when app is role-locked)
  useEffect(() => {
    if (roleLocked) {
      setDetectedRole(fixedRole || null)
      return
    }
    if (mode !== 'signin' || signInEmail.length < 5 || !signInEmail.includes('@')) return
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select('role').ilike('email', signInEmail.trim()).maybeSingle()
      if (data?.role === 'dp') { setDetectedRole('dp'); setRole('dp') }
      else if (data?.role === 'user') { setDetectedRole('user'); setRole('user') }
      else { setDetectedRole(null) }
    }, 600)
    return () => clearTimeout(timer)
  }, [signInEmail, mode, roleLocked, fixedRole])

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
    // Separate apps: reject wrong role for this build
    if (fixedRole && userProfile.role !== fixedRole) {
      await supabase.auth.signOut()
      const msg =
        fixedRole === 'user'
          ? 'This is the Customer app. Delivery partners should use the Partner app.'
          : 'This is the Partner app. Customers should use the Customer app.'
      setError(msg)
      setSignInEmail(''); setSignInPassword(''); setLoading(false)
      return
    }
    if (userProfile.role === 'admin' && !fixedRole) {
      await refreshProfile()
      setLoading(false)
      return
    }
    if (userProfile.role === 'dp') {
      const { data: dp } = await supabase.from('delivery_partners').select('status').eq('user_id', session.user.id).maybeSingle()
      if (dp?.status === 'pending') {
        await refreshProfile()
        setLoading(false)
        return
      }
      if (dp?.status === 'rejected' || dp?.status === 'suspended' || dp?.status === 'deleted') {
        await refreshProfile()
        setLoading(false)
        return
      }
      if (dp?.status !== 'approved') {
        await supabase.auth.signOut()
        setError('Your delivery partner account is not yet approved. Please wait for admin approval.')
        setSignInEmail(''); setSignInPassword(''); setLoading(false); return
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
    if (!pincodeStatus?.served) { setError('We will serve in your area soon. Thanks for your patience. You can tap Notify me by email below.'); return }
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

    const { data: signupData, error: signupError } = await invokeEdgeFunction<{ success?: boolean; user_id?: string; error?: string }>(
      'signup-user',
      {
        email: email.trim(), password, role: 'user', full_name: fullName.trim(),
        phone: phoneDigits, pincode, city: cityName,
      },
      { useAnonAuth: true },
    )

    if (signupError || !signupData?.success) {
      // The edge function may have failed AFTER creating the account.
      // Check if the profile actually exists — if so, treat as success.
      const { data: existingProfile } = await supabase
        .from('profiles').select('id, role').ilike('email', email.trim()).maybeSingle()
      if (existingProfile) {
        // Account was created — don't treat the edge function error as a signup failure
        invokeEdgeFunction('send-email', { to: email.trim(), type: 'welcome', data: { name: fullName.trim(), role: 'user' } })
          .catch(() => {})
        setLoading(false); submittingRef.current = false
        setMode('signup_success')
        return
      }
      const msg = signupError?.message || signupData?.error || 'Failed to create account.'
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('duplicate')) {
        setError('An account with this email already exists.')
      } else {
        setError(msg)
      }
      setLoading(false); submittingRef.current = false; return
    }

    // Welcome email is best-effort — never block signup success on it
    invokeEdgeFunction('send-email', { to: email.trim(), type: 'welcome', data: { name: fullName.trim(), role: 'user' } })
      .catch(() => {})

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
    if (!pincodeStatus?.served) { setError('We will serve in your area soon. Thanks for your patience. You can tap Notify me by email below.'); return }
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

      const { data: signupData, error: signupError } = await invokeEdgeFunction<{ success?: boolean; user_id?: string; error?: string }>(
        'signup-user',
        {
          email: email.trim(), password, role: 'dp', full_name: fullName.trim(),
          phone: phoneDigits, pincode,
          vehicle_type: vehicleType, aadhaar_number: aadhaarNumber, emergency_contact: emergencyContact,
        },
        { useAnonAuth: true },
      )

      if (signupError || !signupData?.success) {
        // The edge function may have failed AFTER creating the account.
        // Check if the profile actually exists — if so, treat as success.
        const { data: existingProfile } = await supabase
          .from('profiles').select('id, role').ilike('email', email.trim()).maybeSingle()
        if (existingProfile) {
          const up = await uploadDpSignupDocuments({
            email, password, userId: existingProfile.id,
            photoFile, aadhaarFile, licenseFile, needsLicense,
          })
          if (!up.ok) {
            setError(up.error || 'Account created but documents failed to upload.')
            setLoading(false); submittingRef.current = false; return
          }
          setMode('dp_success')
          return
        }
        const msg = signupError?.message || signupData?.error || 'Failed to create account.'
        if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('duplicate')) {
          setError('An account with this email already exists.')
        } else {
          setError(msg)
        }
        setLoading(false); submittingRef.current = false; return
      }

      const userId = signupData.user_id!
      const up = await uploadDpSignupDocuments({
        email, password, userId,
        photoFile, aadhaarFile, licenseFile, needsLicense,
      })
      if (!up.ok) {
        setError(up.error || 'Account created but documents failed to upload.')
        setLoading(false); submittingRef.current = false; return
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
      const resetRedirect = window.location.pathname.startsWith('/dp')
        ? `${window.location.origin}/dp/reset-password`
        : `${window.location.origin}/reset-password`
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), { redirectTo: resetRedirect })
      if (resetError) {
        setError(resetError.message)
        setLoading(false)
        return
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email')
      setLoading(false)
      return
    }
    setLoading(false); setResetSent(true)
  }

  // ── Role dropdown component ──
  const RoleDropdown = () => (
    <div className="relative">
      <button type="button" onClick={() => setRoleDropdownOpen(!roleDropdownOpen)} className="input flex items-center justify-between w-full">
        <span className="flex items-center gap-2">
          {role === 'user' ? <User size={16} style={{ color: pg.lime }} /> : <Bike size={16} style={{ color: pg.lime }} />}
          {role === 'user' ? 'User' : 'Delivery Partner'}
        </span>
        <ChevronDown size={16} className={`transition-transform ${roleDropdownOpen ? 'rotate-180' : ''}`} style={{ color: pg.text3 }} />
      </button>
      {roleDropdownOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setRoleDropdownOpen(false)} />
          <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl animate-fade-in" style={{ background: pg.surface2, color: pg.ink, border: `1px solid ${pg.lineStrong}` }}>
            <button type="button" onClick={() => { setRole('user'); setRoleDropdownOpen(false); setError(null); resetAllSignupFields() }} className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-black/5">
              <User size={18} className="mt-0.5 shrink-0" style={{ color: pg.lime }} />
              <div><p className="text-sm font-extrabold text-[#F5F7F6]">User</p><p className="text-xs" style={{ color: pg.text3 }}>Order groceries, medicines, parcels & more</p></div>
            </button>
            <button type="button" onClick={() => { setRole('dp'); setRoleDropdownOpen(false); setError(null); resetAllSignupFields() }} className="flex w-full items-start gap-3 border-t px-4 py-3.5 text-left transition-colors hover:bg-black/5" style={{ borderColor: pg.line }}>
              <Bike size={18} className="mt-0.5 shrink-0" style={{ color: pg.lime }} />
              <div><p className="text-sm font-extrabold text-[#F5F7F6]">Delivery Partner</p><p className="text-xs" style={{ color: pg.text3 }}>Earn money delivering in your area</p></div>
            </button>
          </div>
        </>
      )}
    </div>
  )

  // ── Google button ──
  const GoogleButton = ({ label }: { label: string }) => (
    <button type="button" onClick={handleGoogle} disabled={loading}
      className="w-full flex items-center justify-center gap-2.5 rounded-2xl py-3.5 text-sm font-extrabold transition-all active:scale-95"
      style={{ background: pg.surface2, border: `1px solid ${pg.lineStrong}`, color: pg.text }}>
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
    if (pincodeChecking) return <p className="mt-1.5 text-xs" style={{ color: pg.text3 }}>Checking service area...</p>
    if (!pincodeStatus) return null
    if (pincodeStatus.served) {
      return (
        <div className="mt-2 flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-green-300"
          style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}>
          <CheckCircle size={13} /> We serve {pincodeStatus.area}{pincodeStatus.city ? `, ${pincodeStatus.city}` : ''}!
        </div>
      )
    }
    return (
      <div className="mt-2 space-y-2 rounded-xl px-3 py-2.5 text-xs"
        style={{ background: 'rgba(255,159,67,0.12)', border: '1px solid rgba(255,159,67,0.25)', color: '#FDBA74' }}>
        <div className="flex items-start gap-1.5 font-bold">
          <XCircle size={13} className="mt-0.5 shrink-0" />
          <span>We will serve in your area soon. Thanks for your patience.</span>
        </div>
        {waitlistDone ? (
          <p className="font-bold text-green-300">You&apos;re on the notify list — we&apos;ll email you when we launch.</p>
        ) : (
          <button
            type="button"
            disabled={waitlistBusy || !email.trim()}
            onClick={async () => {
              setWaitlistErr(null)
              setWaitlistBusy(true)
              const { submitServiceAreaWaitlist } = await import('../lib/serviceArea')
              const res = await submitServiceAreaWaitlist({
                email: email || signInEmail,
                pincode,
                areaName: pincodeStatus.area || null,
                cityName: pincodeStatus.city || null,
                source: 'auth_signup',
              })
              setWaitlistBusy(false)
              if (res.error) { setWaitlistErr(res.error); return }
              setWaitlistDone(true)
            }}
            className="rounded-xl px-3 py-1.5 text-[11px] font-extrabold disabled:opacity-50"
            style={{ background: pg.lime, color: pg.limeText }}
          >
            {waitlistBusy ? 'Saving…' : 'Notify me by email'}
          </button>
        )}
        {waitlistErr && <p className="font-bold text-red-300">{waitlistErr}</p>}
        {!email.trim() && !waitlistDone && (
          <p style={{ color: pg.text4 }}>Enter your email above, then tap Notify me.</p>
        )}
      </div>
    )
  }

  // ═══════════════════════════════════════════════
  // FORGOT PASSWORD
  // ═══════════════════════════════════════════════
  if (mode === 'forgot') {
    return (
      <AuthLayout title="Forgot Password" subtitle="Enter your email and we'll send a reset link.">
        <button type="button" onClick={() => { setMode('signin'); setError(null); setResetSent(false) }} className="mb-5 flex items-center gap-1 text-sm font-bold" style={{ color: pg.lime }}>← Back to Sign In</button>
        {resetSent ? (
          <div className="rounded-2xl px-4 py-4 text-sm" style={{ background: pg.surface2, color: pg.ink, border: `1px solid ${pg.line}` }}>
            <div className="flex items-center gap-2 text-[#F5F7F6]"><CheckCircle size={16} className="shrink-0 text-green-400" /> Reset link sent! Check your inbox.</div>
          </div>
        ) : (
          <form onSubmit={handleForgot} className="space-y-4">
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

  // ═══════════════════════════════════════════════
  // USER SIGNUP SUCCESS
  // ═══════════════════════════════════════════════
  if (mode === 'signup_success') {
    return (
      <AuthLayout title="Welcome aboard!" subtitle="Your account is ready. Sign in to start ordering.">
        <div className="flex flex-col items-center py-2 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: pg.lime, boxShadow: '0 12px 32px rgba(196,214,0,0.35)' }}>
            <CheckCircle size={32} style={{ color: pg.limeText }} />
          </div>
          <CTA onClick={() => { setMode('signin'); setRole('user') }} className="w-full">Sign In Now <ArrowRight size={16} /></CTA>
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
    const signupSubtitle = roleLocked
      ? (fixedRole === 'dp' ? 'Register as a delivery partner' : 'Register as a customer')
      : 'Select your role and fill in your details'
    return (
      <AuthLayout title="Create Account" subtitle={signupSubtitle}>
        <div className="space-y-4">
          {!roleLocked && (
            <div>
              <label className="label flex items-center gap-1.5"><Shield size={13} /> I am a...</label>
              <RoleDropdown />
            </div>
          )}

          {role === 'user' && (
            <form onSubmit={handleUserSignUp} className="space-y-3">
              <div><label className="label flex items-center gap-1.5"><User size={13} /> Full Name *</label><input className="input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" required /></div>
              <div><label className="label flex items-center gap-1.5"><Phone size={13} /> Mobile Number *</label><input className="input" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile number" maxLength={10} required /></div>
              <div>
                <label className="label flex items-center gap-1.5"><MapPin size={13} /> Area Pincode *</label>
                <div className="relative">
                  <input className="input" value={pincode} onChange={e => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter your 6-digit area pincode" maxLength={6} required />
                </div>
                <PincodeBadge />
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
              <CTA type="submit" disabled={loading} className="w-full">{loading ? 'Creating account...' : 'Create Account'} <ArrowRight size={16} /></CTA>
            </form>
          )}

          {role === 'dp' && (
            <div>
              <div className="mb-5 flex items-center gap-2">
                {[1, 2, 3].map(s => (
                  <div key={s} className="flex flex-1 items-center gap-2">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-extrabold transition-all ${s <= dpStep ? '' : ''}`}
                      style={s <= dpStep ? { background: pg.lime, color: pg.limeText } : { background: pg.surface2, color: pg.text3 }}>
                      {s < dpStep ? <CheckCircle size={14} /> : s}
                    </div>
                    {s < 3 && <div className="h-0.5 flex-1 rounded-full" style={{ background: s < dpStep ? pg.lime : pg.line }} />}
                  </div>
                ))}
              </div>

              {dpStep === 1 && (
                <form onSubmit={handleDpStep1} className="space-y-3">
                  <h3 className="text-sm font-extrabold text-[#F5F7F6]">Basic Information</h3>
                  <div><label className="label flex items-center gap-1.5"><User size={13} /> Full Name *</label><input className="input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" required /></div>
                  <div><label className="label flex items-center gap-1.5"><Phone size={13} /> Phone Number *</label><input className="input" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile number" maxLength={10} required /></div>
                  <div>
                    <label className="label flex items-center gap-1.5"><MapPin size={13} /> Area Pincode *</label>
                    <div className="relative">
                      <input className="input" value={pincode} onChange={e => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter your 6-digit area pincode" maxLength={6} required />
                    </div>
                    <PincodeBadge />
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
                  <CTA type="submit" className="w-full">Continue <ArrowRight size={16} /></CTA>
                </form>
              )}

              {dpStep === 2 && (
                <form onSubmit={handleDpStep2} className="space-y-3">
                  <h3 className="text-sm font-extrabold text-[#F5F7F6]">Vehicle & Identity</h3>
                  <div>
                    <label className="label flex items-center gap-1.5"><Truck size={13} /> Vehicle Type *</label>
                    <div className="grid grid-cols-3 gap-2">
                      {VEHICLE_TYPES.map(v => (
                        <button key={v} type="button" onClick={() => setVehicleType(v)}
                          className="rounded-2xl border-2 py-2.5 text-sm font-bold transition-all active:scale-95"
                          style={vehicleType === v
                            ? { background: pg.lime, borderColor: pg.lime, color: pg.limeText }
                            : { borderColor: pg.line, color: pg.text3 }}>
                          {v}
                        </button>
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
                    <CTA type="button" variant="secondary" onClick={() => { setDpStep(1); setError(null) }} className="flex-1">Back</CTA>
                    <CTA type="submit" className="flex-1">Continue <ArrowRight size={16} /></CTA>
                  </div>
                </form>
              )}

              {dpStep === 3 && (
                <form onSubmit={handleDpStep3} className="space-y-4">
                  <h3 className="text-sm font-extrabold text-[#F5F7F6]">Documents & Photo</h3>
                  <div>
                    <label className="label flex items-center gap-1.5"><Camera size={13} /> Profile Photo *</label>
                    <input ref={photoInputRef} type="file" className="hidden" accept="image/*" capture="user" onChange={e => e.target.files?.[0] && pickDpFile(e.target.files[0], 'photo')} />
                    {photoPreview ? (
                      <div className="relative">
                        <img src={photoPreview} alt="Profile" className="h-28 w-28 rounded-2xl object-cover" />
                        <button type="button" onClick={() => photoInputRef.current?.click()} className="absolute bottom-1 right-1 rounded-full p-1.5 shadow" style={{ background: pg.lime, color: pg.limeText }}><Camera size={14} /></button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => photoInputRef.current?.click()} className="flex w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed py-6" style={{ borderColor: pg.line, color: pg.text3 }}>
                        <Camera size={28} style={{ color: pg.lime }} />
                        <span className="text-sm font-medium">Take Live Photo *</span>
                        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Camera only — uploads not allowed</span>
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="label flex items-center gap-1.5"><Upload size={13} /> Aadhaar Proof *</label>
                    <input ref={aadhaarInputRef} type="file" className="hidden" accept="image/*,application/pdf" onChange={e => e.target.files?.[0] && pickDpFile(e.target.files[0], 'aadhaar')} />
                    {aadhaarPreview ? (
                      <div className="flex items-center gap-3 rounded-2xl p-3" style={{ background: pg.surface2, color: pg.ink, border: `1px solid ${pg.line}` }}>
                        {aadhaarFile?.type.startsWith('image') ? <img src={aadhaarPreview} alt="Aadhaar" className="h-14 w-14 rounded-lg object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-lg"><FileText size={24} className="text-green-400" /></div>}
                        <div className="flex-1 min-w-0"><p className="truncate text-sm font-medium text-[#F5F7F6]">{aadhaarFile?.name}</p><p className="text-xs text-green-400">Aadhaar uploaded</p></div>
                        <button type="button" onClick={() => aadhaarInputRef.current?.click()} className="btn-ghost p-2"><Upload size={16} /></button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => aadhaarInputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-4" style={{ borderColor: pg.line, color: pg.text3 }}><Upload size={20} style={{ color: pg.lime }} /> Upload Aadhaar *</button>
                    )}
                  </div>
                  {needsLicense && (
                    <div>
                      <label className="label flex items-center gap-1.5"><FileText size={13} /> Driving Licence *</label>
                      <input ref={licenseInputRef} type="file" className="hidden" accept="image/*,application/pdf" onChange={e => e.target.files?.[0] && pickDpFile(e.target.files[0], 'license')} />
                      {licensePreview ? (
                        <div className="flex items-center gap-3 rounded-2xl p-3" style={{ background: pg.surface2, color: pg.ink, border: `1px solid ${pg.line}` }}>
                          {licenseFile?.type.startsWith('image') ? <img src={licensePreview} alt="Licence" className="h-14 w-14 rounded-lg object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-lg"><FileText size={24} className="text-green-400" /></div>}
                          <div className="flex-1 min-w-0"><p className="truncate text-sm font-medium text-[#F5F7F6]">{licenseFile?.name}</p><p className="text-xs text-green-400">Licence uploaded</p></div>
                          <button type="button" onClick={() => licenseInputRef.current?.click()} className="btn-ghost p-2"><Upload size={16} /></button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => licenseInputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-4" style={{ borderColor: pg.line, color: pg.text3 }}><Upload size={20} className="text-yellow-400" /> Upload Driving Licence *</button>
                      )}
                    </div>
                  )}
                  {error && <ErrorBanner message={error} />}
                  <div className="flex gap-2">
                    <CTA type="button" variant="secondary" onClick={() => { setDpStep(2); setError(null) }} className="flex-1">Back</CTA>
                    <CTA type="submit" disabled={loading} className="flex-1">{loading ? 'Submitting...' : 'Submit Application'}</CTA>
                  </div>
                </form>
              )}
            </div>
          )}

          <p className="text-center text-sm" style={{ color: pg.text3 }}>
            Already have an account?{' '}
            <button type="button" onClick={switchToSignIn} className="font-extrabold hover:underline" style={{ color: pg.lime }}>Sign in here</button>
          </p>
        </div>
      </AuthLayout>
    )
  }

  // ═══════════════════════════════════════════════
  // SIGN IN PAGE (default)
  // ═══════════════════════════════════════════════
  const signInSubtitle = roleLocked
    ? (fixedRole === 'dp' ? 'Delivery partner sign in' : 'Customer sign in')
    : 'Enter your credentials'
  return (
    <AuthLayout title="Sign In" subtitle={signInSubtitle}>
      <form onSubmit={handleSignIn} className="space-y-4">
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
              <button type="button" onClick={() => { setMode('forgot'); setError(null) }} className="text-xs font-bold hover:underline" style={{ color: pg.lime }}>Forgot password?</button>
            </div>
          </div>
          {roleLocked && (
            <div className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-xs font-bold" style={{ background: pg.limeDim, border: `1px solid rgba(196,214,0,0.28)`, color: pg.lime }}>
              {fixedRole === 'dp' ? <Bike size={13} /> : <User size={13} />}
              {fixedRole === 'dp' ? 'Partner app' : 'Customer app'}
            </div>
          )}
          {!roleLocked && detectedRole && (
            <div className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-xs font-bold" style={{ background: pg.limeDim, border: `1px solid rgba(196,214,0,0.28)`, color: pg.lime }}>
              {detectedRole === 'dp' ? <Bike size={13} /> : <User size={13} />}
              Signing in as <strong>{detectedRole === 'dp' ? 'Delivery Partner' : 'User'}</strong>
            </div>
          )}
          {error && <ErrorBanner message={error} />}
          <CTA type="submit" disabled={loading} className="w-full">{loading ? 'Signing in...' : 'Sign In'} <ArrowRight size={16} /></CTA>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1" style={{ background: pg.line }} />
          <span className="text-xs font-bold" style={{ color: pg.text4 }}>or</span>
          <div className="h-px flex-1" style={{ background: pg.line }} />
        </div>

        <GoogleButton label="Sign in with Google" />

        <p className="mt-5 text-center text-sm" style={{ color: pg.text3 }}>
          Don't have an account?{' '}
          <button type="button" onClick={switchToSignUp} className="font-extrabold hover:underline" style={{ color: pg.lime }}>Create new account</button>
        </p>
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
    <AuthLayout title="Application Submitted!" subtitle="Your delivery partner application is now under review.">
      <div className="flex flex-col items-center py-2 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: pg.lime, boxShadow: '0 12px 32px rgba(196,214,0,0.35)' }}>
          <CheckCircle size={32} style={{ color: pg.limeText }} />
        </div>
        <div className="mb-5 w-full rounded-2xl p-4" style={{ background: pg.limeDim, border: `1px solid rgba(196,214,0,0.28)` }}>
          <p className="text-sm font-extrabold" style={{ color: pg.lime }}>Awaiting Admin Approval</p>
          <p className="mt-1 text-xs" style={{ color: pg.text3 }}>Redirecting to sign in page in {countdown}s...</p>
        </div>
        <CTA onClick={onContinue} className="w-full">Go to Sign In Now</CTA>
      </div>
    </AuthLayout>
  )
}
