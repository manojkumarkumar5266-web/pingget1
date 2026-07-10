import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context'
import { supabase } from '../lib/supabase'
import { ErrorBanner } from '../components/ui'
import AuthLayout from '../components/AuthLayout'
import { User, Phone, Chrome as Home, MapPin, Mail, Lock, Eye, EyeOff, Bike, CircleCheck as CheckCircle, Circle as XCircle, ArrowRight, KeyRound, ShieldAlert } from 'lucide-react'

type Mode = 'main' | 'signup' | 'signup_success' | 'forgot'
type SignInRole = 'user' | 'dp'

type PincodeStatus = { served: boolean; area?: string; city?: string } | null

export default function AuthScreen() {
  const { signInWithEmail, signUpWithEmail, passwordRecovery, clearPasswordRecovery } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('main')
  const [signInRole, setSignInRole] = useState<SignInRole>('user')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  // Sign-in fields
  const [signInEmail, setSignInEmail] = useState('')
  const [signInPassword, setSignInPassword] = useState('')

  // Sign-up fields
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [pincode, setPincode] = useState('')
  const [pincodeStatus, setPincodeStatus] = useState<PincodeStatus>(null)
  const [pincodeChecking, setPincodeChecking] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Forgot password
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)

  useEffect(() => {
    if (passwordRecovery) {
      clearPasswordRecovery()
    }
  }, [passwordRecovery, clearPasswordRecovery])

  // Pincode validation
  useEffect(() => {
    if (pincode.length !== 6) {
      setPincodeStatus(null)
      return
    }
    const timer = setTimeout(async () => {
      setPincodeChecking(true)
      const { data: pins } = await supabase
        .from('pincodes')
        .select('area_name, city_id')
        .eq('pincode', pincode)
        .eq('is_active', true)
        .limit(1)
      const pin = pins?.[0]
      if (!pin) {
        setPincodeChecking(false)
        setPincodeStatus({ served: false })
        return
      }
      const { data: city } = await supabase
        .from('cities')
        .select('name, is_active')
        .eq('id', pin.city_id)
        .maybeSingle()
      setPincodeChecking(false)
      if (city?.is_active) {
        setPincodeStatus({ served: true, area: pin.area_name || '', city: city.name })
      } else {
        setPincodeStatus({ served: false })
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [pincode])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!signInEmail.trim() || !signInPassword) {
      setError('Please enter your email and password')
      return
    }
    setLoading(true)
    const { error: signInError } = await signInWithEmail(signInEmail.trim(), signInPassword)
    if (signInError) {
      setError(signInError)
      setLoading(false)
      return
    }

    // After sign-in, check the profile role matches the selected toggle
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      setError('Authentication failed. Please try again.')
      setLoading(false)
      return
    }

    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle()

    if (!userProfile) {
      setError('Account not found. Please sign up first.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    // Role mismatch check — single user can have both user and DP creds
    if (signInRole === 'dp' && userProfile.role !== 'dp') {
      await supabase.auth.signOut()
      setError('You don\'t have a Delivery Partner account. Please select "User" to sign in, or sign up as a Delivery Partner.')
      setLoading(false)
      return
    }
    if (signInRole === 'user' && userProfile.role === 'dp') {
      await supabase.auth.signOut()
      setError('This account is a Delivery Partner. Please select "DP" to sign in to your DP dashboard.')
      setLoading(false)
      return
    }

    // Role matches — redirect happens via onAuthStateChange → App.tsx
  }

  const checkPhoneUnique = async (phoneValue: string): Promise<boolean> => {
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('phone', phoneValue)
    return (count ?? 0) === 0
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!fullName.trim()) { setError('Full name is required'); return }
    const phoneDigits = phone.replace(/\D/g, '')
    if (phoneDigits.length < 10) { setError('Please enter a valid 10-digit mobile number'); return }
    if (!address.trim()) { setError('Address is required'); return }
    if (pincode.length !== 6) { setError('Please enter a 6-digit pincode'); return }
    if (!pincodeStatus?.served) { setError('Sorry, we do not operate in this area yet.'); return }
    if (!email.trim() || !email.includes('@')) { setError('Please enter a valid email address'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }

    setLoading(true)

    const isPhoneUnique = await checkPhoneUnique(phoneDigits)
    if (!isPhoneUnique) {
      setError('This mobile number is already registered. Please use a different number.')
      setLoading(false)
      return
    }

    const { error: signUpError } = await signUpWithEmail(email.trim(), password)
    if (signUpError) {
      setError(signUpError)
      setLoading(false)
      return
    }

    const {
  data: { session },
  error: sessionError,
} = await supabase.auth.getSession()

console.log("SESSION:", session)
console.log("SESSION ERROR:", sessionError)

if (!session?.user) {
  setError(
    sessionError?.message ||
      "No session created. Check your email confirmation settings."
  )
  setLoading(false)
  return
}

    const { error: profileError } = await supabase.from('profiles').insert({
      id: session.user.id,
      role: 'user',
      full_name: fullName.trim(),
      phone: phoneDigits,
      address: address.trim(),
      pincode: pincode,
      status: 'active',
    })

    if (profileError) {
      if (profileError.message.includes('profiles_phone_unique')) {
        setError('This mobile number is already registered. Please use a different number.')
      } else if (profileError.message.includes('duplicate')) {
        setError('An account with this email already exists. Please sign in instead.')
      } else {
        setError(profileError.message)
      }
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    setLoading(false)
    setMode('signup_success')
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!resetEmail.trim()) { setError('Please enter your email address'); return }
    setLoading(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: window.location.origin + '/auth',
    })
    setLoading(false)
    if (resetError) { setError(resetError.message); return }
    setResetSent(true)
  }

  // ---- SIGNUP SUCCESS ----
  if (mode === 'signup_success') {
    return (
      <AuthLayout showBrand={false}>
        <div className="card p-6 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-100 dark:bg-success-900/40">
              <CheckCircle size={32} className="text-success-600 dark:text-success-400" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Account Created!</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Your account has been created successfully. You can now sign in.
          </p>
          <button
            onClick={() => {
              setMode('main')
              setFullName(''); setPhone(''); setAddress(''); setPincode('')
              setEmail(''); setPassword(''); setConfirmPassword('')
              setSignInEmail(email)
            }}
            className="btn-primary mt-5 w-full"
          >
            Continue to Sign In
          </button>
        </div>
      </AuthLayout>
    )
  }

  // ---- FORGOT PASSWORD ----
  if (mode === 'forgot') {
    return (
      <AuthLayout showBrand={false}>
        <div className="card p-6">
          <button onClick={() => { setMode('main'); setError(null); setResetSent(false) }} className="text-sm text-primary-600 dark:text-primary-400 mb-4">
            ← Back to Sign In
          </button>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Forgot Password</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Enter your email and we&apos;ll send you a reset link.</p>
          {resetSent ? (
            <div className="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-800 dark:bg-success-900/30 dark:text-success-300">
              <div className="flex items-center gap-2"><CheckCircle size={16} className="shrink-0" /> Reset link sent! Check your email inbox.</div>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="label flex items-center gap-1.5"><Mail size={14} /> Email Address</label>
                <input type="email" className="input" value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="you@example.com" required />
              </div>
              {error && <ErrorBanner message={error} />}
              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                <KeyRound size={16} /> {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          )}
        </div>
      </AuthLayout>
    )
  }

  // ---- SIGN UP ----
  if (mode === 'signup') {
    return (
      <AuthLayout showBrand={false}>
        <div className="card p-6">
          <button onClick={() => { setMode('main'); setError(null) }} className="text-sm text-primary-600 dark:text-primary-400 mb-4">
            ← Back
          </button>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Sign Up as User</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Fill in your details to get started</p>
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className="label flex items-center gap-1.5"><User size={14} /> Full Name *</label>
              <input className="input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" required />
            </div>
            <div>
              <label className="label flex items-center gap-1.5"><Phone size={14} /> Mobile Number *</label>
              <input className="input" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile number" maxLength={10} required />
            </div>
            <div>
              <label className="label flex items-center gap-1.5"><Home size={14} /> Address *</label>
              <input className="input" value={address} onChange={e => setAddress(e.target.value)} placeholder="Your full address" required />
            </div>
            <div>
              <label className="label flex items-center gap-1.5"><MapPin size={14} /> Area Pincode *</label>
              <input className="input" value={pincode} onChange={e => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit pincode" maxLength={6} required />
              {pincodeChecking && <p className="mt-1.5 text-xs text-gray-400">Checking service area...</p>}
              {!pincodeChecking && pincodeStatus && (
                <div className={`mt-1.5 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${pincodeStatus.served ? 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300' : 'bg-error-50 text-error-700 dark:bg-error-900/30 dark:text-error-300'}`}>
                  {pincodeStatus.served ? <><CheckCircle size={13} /> We serve {pincodeStatus.area}{pincodeStatus.city ? `, ${pincodeStatus.city}` : ''}!</> : <><XCircle size={13} /> Sorry, we don&apos;t serve this area yet.</>}
                </div>
              )}
            </div>
            <div>
              <label className="label flex items-center gap-1.5"><Mail size={14} /> Email *</label>
              <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div>
              <label className="label flex items-center gap-1.5"><Lock size={14} /> Password *</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} className="input pr-10" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="label flex items-center gap-1.5"><Lock size={14} /> Confirm Password *</label>
              <input type={showPassword ? 'text' : 'password'} className="input" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter your password" required />
              {confirmPassword && password !== confirmPassword && <p className="mt-1 text-xs text-error-600">Passwords do not match</p>}
            </div>
            {error && <ErrorBanner message={error} />}
            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? 'Creating account...' : 'Create Account'} <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </AuthLayout>
    )
  }

  // ---- MAIN: Sign In with User/DP toggle ----
  return (
    <AuthLayout>
      <div className="card p-6">
        <h2 className="text-center text-xl font-bold text-gray-900 dark:text-white mb-1">Sign In</h2>
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-5">Select your role and enter your credentials</p>

        {/* User / DP Toggle */}
        <div className="mb-5 flex rounded-xl border border-gray-200 p-1 dark:border-gray-700">
          <button
            type="button"
            onClick={() => { setSignInRole('user'); setError(null) }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${
              signInRole === 'user'
                ? 'text-white'
                : 'text-gray-500 dark:text-gray-400'
            }`}
            style={signInRole === 'user' ? { backgroundColor: '#808000' } : {}}
          >
            <User size={16} /> User
          </button>
          <button
            type="button"
            onClick={() => { setSignInRole('dp'); setError(null) }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${
              signInRole === 'dp'
                ? 'text-white'
                : 'text-gray-500 dark:text-gray-400'
            }`}
            style={signInRole === 'dp' ? { backgroundColor: '#808000' } : {}}
          >
            <Bike size={16} /> Delivery Partner
          </button>
        </div>

        {error && <ErrorBanner message={error} />}

        <form onSubmit={handleSignIn} className="space-y-4">
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
            <button type="button" onClick={() => { setMode('forgot'); setError(null); setResetSent(false) }} className="text-xs text-primary-600 dark:text-primary-400 hover:underline">
              Forgot password?
            </button>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Signing in...' : `Sign In as ${signInRole === 'dp' ? 'Delivery Partner' : 'User'}`}
          </button>
        </form>

        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white dark:bg-gray-900 px-2 text-gray-500">or</span>
          </div>
        </div>

        <button onClick={() => { setMode('signup'); setError(null) }} className="btn-secondary w-full mb-3">
          <User size={18} /> Sign Up as User
        </button>
        <button onClick={() => navigate('/dp-signup')} className="btn-secondary w-full">
          <Bike size={18} /> Sign Up as Delivery Partner
        </button>

        {signInRole === 'dp' && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-accent-50 p-3 text-xs text-accent-700 dark:bg-accent-950/40 dark:text-accent-300">
            <ShieldAlert size={14} className="mt-0.5 shrink-0" />
            <span>Delivery Partner accounts need admin approval before they can sign in. If you don&apos;t have a DP account yet, tap &quot;Sign Up as Delivery Partner&quot;.</span>
          </div>
        )}
      </div>
    </AuthLayout>
  )
}
