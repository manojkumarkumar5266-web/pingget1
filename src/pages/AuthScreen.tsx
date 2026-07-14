import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context'
import { supabase } from '../lib/supabase'
import { ErrorBanner } from '../components/ui'
import AuthLayout from '../components/AuthLayout'
import {
  User, Phone, Chrome as Home, MapPin, Mail, Lock, Eye, EyeOff,
  CircleCheck as CheckCircle, Circle as XCircle, ArrowRight, KeyRound,
  ChevronRight, Sparkles, Bike,
} from 'lucide-react'

type Mode = 'main' | 'signup' | 'signup_success' | 'forgot'
type SignInRole = 'user' | 'dp'
type PincodeStatus = { served: boolean; area?: string; city?: string } | null

export default function AuthScreen() {
  const { signInWithEmail, signUpWithEmail, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('main')
  const [signInRole, setSignInRole] = useState<SignInRole>('user')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const [signInEmail, setSignInEmail] = useState('')
  const [signInPassword, setSignInPassword] = useState('')

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [pincode, setPincode] = useState('')
  const [pincodeStatus, setPincodeStatus] = useState<PincodeStatus>(null)
  const [pincodeChecking, setPincodeChecking] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)

  useEffect(() => {
    if (pincode.length !== 6) { setPincodeStatus(null); return }
    const timer = setTimeout(async () => {
      setPincodeChecking(true)
      const { data: pins } = await supabase.from('pincodes').select('area_name, city_id').eq('pincode', pincode).eq('is_active', true).limit(1)
      const pin = pins?.[0]
      if (!pin) { setPincodeChecking(false); setPincodeStatus({ served: false }); return }
      const { data: city } = await supabase.from('cities').select('name, is_active').eq('id', pin.city_id).maybeSingle()
      setPincodeChecking(false)
      if (city?.is_active) setPincodeStatus({ served: true, area: pin.area_name || '', city: city.name })
      else setPincodeStatus({ served: false })
    }, 500)
    return () => clearTimeout(timer)
  }, [pincode])

  const clearSignInFields = () => { setSignInEmail(''); setSignInPassword('') }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null)
    if (!signInEmail.trim() || !signInPassword) { setError('Please enter your email and password'); return }
    setLoading(true)
    const { error: signInError } = await signInWithEmail(signInEmail.trim(), signInPassword)
    if (signInError) { setError(signInError); clearSignInFields(); setLoading(false); return }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setError('Authentication failed. Please try again.'); clearSignInFields(); setLoading(false); return }
    const { data: userProfile } = await supabase.from('profiles').select('role, status').eq('id', session.user.id).maybeSingle()
    if (!userProfile) { setError('Account not found. Please sign up first.'); await supabase.auth.signOut(); clearSignInFields(); setLoading(false); return }
    if (userProfile.status === 'banned' || userProfile.status === 'suspended') {
      await supabase.auth.signOut()
      setError(`Your account is ${userProfile.status}. Please contact support.`)
      clearSignInFields(); setLoading(false); return
    }
    if (signInRole === 'dp' && userProfile.role !== 'dp') {
      await supabase.auth.signOut()
      setError("You don't have a Delivery Partner account. Please select \"User\" to sign in.")
      clearSignInFields(); setLoading(false); return
    }
    if (signInRole === 'user' && userProfile.role === 'dp') {
      await supabase.auth.signOut()
      setError('This account is a Delivery Partner. Please select "DP" to sign in.')
      clearSignInFields(); setLoading(false); return
    }
    if (userProfile.role === 'admin') {
      await supabase.auth.signOut()
      setError('Admin accounts must use the Admin Login page.')
      clearSignInFields(); setLoading(false); return
    }
  }

  const checkPhoneUnique = async (phoneValue: string): Promise<boolean> => {
    const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('phone', phoneValue)
    return (count ?? 0) === 0
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null)
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
    if (!isPhoneUnique) { setError('This mobile number is already registered.'); setLoading(false); return }

    const { error: signUpError } = await signUpWithEmail(email.trim(), password)
    if (signUpError) { setError(signUpError); setLoading(false); return }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (!session?.user) { setError(sessionError?.message || 'Failed to create account.'); setLoading(false); return }

    const { data: pinData } = await supabase.from('pincodes').select('city_id').eq('pincode', pincode).limit(1).maybeSingle()
    let cityName: string | null = null
    if (pinData?.city_id) {
      const { data: cityData } = await supabase.from('cities').select('name').eq('id', pinData.city_id).maybeSingle()
      cityName = cityData?.name || null
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: session.user.id, role: 'user', full_name: fullName.trim(),
      phone: phoneDigits, address: address.trim(), pincode, city: cityName, status: 'active',
    })

    if (profileError) {
      if (profileError.message.includes('profiles_phone_unique')) setError('This mobile number is already registered.')
      else if (profileError.message.includes('duplicate')) setError('An account with this email already exists.')
      else setError(profileError.message)
      await supabase.auth.signOut()
      setLoading(false); return
    }

    try {
      await supabase.functions.invoke('send-email', {
        body: { to: email.trim(), type: 'welcome', data: { name: fullName.trim(), role: 'user' } },
      })
    } catch { /* best effort */ }

    await refreshProfile()
    setLoading(false)
    setMode('signup_success')
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null)
    if (!resetEmail.trim()) { setError('Please enter your email address'); return }
    setLoading(true)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        resetEmail.trim(),
        { redirectTo: `${window.location.origin}/reset-password` }
      )
      if (resetError) {
        try {
          await supabase.functions.invoke('send-email', {
            body: { to: resetEmail.trim(), type: 'password_reset', data: { name: '', reset_url: `${window.location.origin}/reset-password` } },
          })
        } catch { /* fallback also failed */ }
      }
    } catch { /* best effort */ }
    setLoading(false)
    setResetSent(true)
  }

  // ── Forgot Password ──────────────────────────────────────────────────────
  if (mode === 'forgot') {
    return (
      <AuthLayout showBrand={false}>
        <div className="card p-6 animate-fade-in">
          <button
            onClick={() => { setMode('main'); setError(null); setResetSent(false) }}
            className="text-sm mb-4 flex items-center gap-1"
            style={{ color: '#8fa964' }}
          >
            ← Back to Sign In
          </button>
          <h2 className="text-xl font-bold text-white mb-1">Forgot Password</h2>
          <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Enter your email and we'll send a reset link.
          </p>
          {resetSent ? (
            <div className="rounded-xl px-4 py-3 text-sm text-white glass-dark">
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="shrink-0 text-green-400" />
                Reset link sent! Check your inbox.
              </div>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="label flex items-center gap-1.5"><Mail size={14} /> Email</label>
                <input type="email" className="input" value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="you@example.com" required />
              </div>
              {error && <ErrorBanner message={error} />}
              <button type="submit" disabled={loading} className="btn-primary w-full">
                <KeyRound size={16} /> {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          )}
        </div>
      </AuthLayout>
    )
  }

  // ── Signup Success ───────────────────────────────────────────────────────
  if (mode === 'signup_success') {
    return (
      <AuthLayout showBrand={false}>
        <div className="card p-8 text-center animate-fade-in">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: 'linear-gradient(135deg, #6e8c45, #374524)' }}>
            <CheckCircle size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Welcome aboard!</h2>
          <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Your account is ready. Sign in to start ordering.
          </p>
          <button
            onClick={() => setMode('main')}
            className="btn-primary w-full"
          >
            Sign In Now <ArrowRight size={16} />
          </button>
        </div>
      </AuthLayout>
    )
  }

  // ── Signup Form ──────────────────────────────────────────────────────────
  if (mode === 'signup') {
    return (
      <AuthLayout showBrand>
        <div className="card p-5 animate-fade-in">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: 'linear-gradient(135deg, #6e8c45, #374524)' }}>
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Create Account</h2>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Join pinGGet as a User</p>
            </div>
          </div>

          <form onSubmit={handleSignUp} className="space-y-3">
            <div>
              <label className="label flex items-center gap-1.5"><User size={13} /> Full Name *</label>
              <input className="input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" required />
            </div>
            <div>
              <label className="label flex items-center gap-1.5"><Phone size={13} /> Mobile Number *</label>
              <input className="input" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile number" maxLength={10} required />
            </div>
            <div>
              <label className="label flex items-center gap-1.5"><Home size={13} /> Address *</label>
              <input className="input" value={address} onChange={e => setAddress(e.target.value)} placeholder="Your full address" required />
            </div>
            <div>
              <label className="label flex items-center gap-1.5"><MapPin size={13} /> Area Pincode *</label>
              <input className="input" value={pincode} onChange={e => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit pincode" maxLength={6} required />
              {pincodeChecking && <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Checking service area...</p>}
              {!pincodeChecking && pincodeStatus && (
                <div className={`mt-1.5 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${pincodeStatus.served ? 'text-green-300' : 'text-red-300'}`}
                  style={{ background: pincodeStatus.served ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${pincodeStatus.served ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
                  {pincodeStatus.served
                    ? <><CheckCircle size={13} /> We serve {pincodeStatus.area}{pincodeStatus.city ? `, ${pincodeStatus.city}` : ''}!</>
                    : <><XCircle size={13} /> Sorry, we don't serve this area yet.</>}
                </div>
              )}
            </div>
            <div>
              <label className="label flex items-center gap-1.5"><Mail size={13} /> Email *</label>
              <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div>
              <label className="label flex items-center gap-1.5"><Lock size={13} /> Password *</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} className="input pr-10" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="label flex items-center gap-1.5"><Lock size={13} /> Confirm Password *</label>
              <input type={showPassword ? 'text' : 'password'} className="input" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter your password" required />
              {confirmPassword && password !== confirmPassword && <p className="mt-1 text-xs text-red-400">Passwords do not match</p>}
            </div>
            {error && <ErrorBanner message={error} />}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Creating account...' : 'Create Account'} <ArrowRight size={16} />
            </button>
          </form>
          <button
            onClick={() => { setMode('main'); setError(null) }}
            className="mt-4 w-full text-center text-sm"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            Already have an account? Sign in
          </button>
        </div>
      </AuthLayout>
    )
  }

  // ── Main Sign In ─────────────────────────────────────────────────────────
  return (
    <AuthLayout>
      <div className="space-y-4 animate-fade-in">
        {/* Role toggle */}
        <div className="flex rounded-2xl p-1 glass">
          {(['user', 'dp'] as SignInRole[]).map(role => (
            <button
              key={role}
              onClick={() => { setSignInRole(role); setError(null) }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all ${signInRole === role ? 'text-white shadow-sm' : ''}`}
              style={signInRole === role ? { background: 'linear-gradient(135deg, #6e8c45, #42562a)' } : { color: 'rgba(255,255,255,0.5)' }}
            >
              {role === 'user' ? <User size={16} /> : <Bike size={16} />}
              {role === 'user' ? 'User Login' : 'DP Login'}
            </button>
          ))}
        </div>

        {/* Sign in card */}
        <div className="card p-5">
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="label flex items-center gap-1.5"><Mail size={13} /> Email</label>
              <input type="email" className="input" value={signInEmail} onChange={e => setSignInEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
            </div>
            <div>
              <label className="label flex items-center gap-1.5"><Lock size={13} /> Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} className="input pr-10" value={signInPassword} onChange={e => setSignInPassword(e.target.value)} placeholder="Your password" autoComplete="current-password" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="mt-1.5 text-right">
                <button type="button" onClick={() => { setMode('forgot'); setError(null) }} className="text-xs hover:underline" style={{ color: '#8fa964' }}>
                  Forgot password?
                </button>
              </div>
            </div>
            {error && <ErrorBanner message={error} />}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Signing in...' : `Sign In as ${signInRole === 'user' ? 'User' : 'Delivery Partner'}`}
              <ChevronRight size={16} />
            </button>
          </form>
        </div>

        {/* Signup links */}
        {signInRole === 'user' && (
          <button
            onClick={() => { setMode('signup'); setError(null) }}
            className="w-full card p-4 flex items-center justify-between group"
          >
            <div className="text-left">
              <p className="text-sm font-semibold text-white">New to pinGGet?</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Create a free user account</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: 'rgba(110,140,69,0.2)' }}>
              <ArrowRight size={16} style={{ color: '#8fa964' }} />
            </div>
          </button>
        )}

        {signInRole === 'dp' && (
          <button
            onClick={() => navigate('/dp-signup')}
            className="w-full card p-4 flex items-center justify-between group"
          >
            <div className="text-left">
              <p className="text-sm font-semibold text-white">New to pinGGet?</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Sign up as a Delivery Partner</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: 'rgba(110,140,69,0.2)' }}>
              <ArrowRight size={16} style={{ color: '#8fa964' }} />
            </div>
          </button>
        )}

        {/* Always show the other signup option */}
        <button
          onClick={() => navigate('/dp-signup')}
          className="w-full text-center text-xs hover:underline"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          Want to deliver? Become a Delivery Partner
        </button>
      </div>
    </AuthLayout>
  )
}
