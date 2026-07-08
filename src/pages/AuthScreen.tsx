import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context'
import { supabase } from '../lib/supabase'
import { ErrorBanner } from '../components/ui'
import { MessageCircle, MapPin, ArrowRight, Bike, Package, CheckCircle, XCircle, ArrowLeft, KeyRound, Mail } from 'lucide-react'

type Mode = 'signin' | 'signup' | 'created' | 'forgot' | 'forgot_sent' | 'reset'

type PincodeStatus = { served: boolean; area?: string; city?: string } | null

export default function AuthScreen() {
  const { signIn, signUp, updatePassword, clearPasswordRecovery, passwordRecovery } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>(() => passwordRecovery ? 'reset' : 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [pincode, setPincode] = useState('')
  const [pincodeStatus, setPincodeStatus] = useState<PincodeStatus>(null)
  const [pincodeChecking, setPincodeChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (passwordRecovery) setMode('reset')
  }, [passwordRecovery])

  const goToMode = (m: Mode) => { setMode(m); setError(null) }

  useEffect(() => {
    if (pincode.length !== 6) { setPincodeStatus(null); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setPincodeChecking(true)
      const { data: pins } = await supabase
        .from('pincodes').select('area_name, city_id').eq('pincode', pincode).eq('is_active', true).limit(1)
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
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [pincode])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) setError(error)
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await signUp(email, password, 'user', fullName, phone, pincode || undefined)
    setLoading(false)
    if (error) { setError(error); return }
    goToMode('created')
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://your-project.vercel.app/auth',
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    goToMode('forgot_sent')
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return }
    setLoading(true)
    const { error } = await updatePassword(newPassword)
    setLoading(false)
    if (error) { setError(error); return }
    goToMode('signin')
  }

  const handleCancelReset = () => {
    clearPasswordRecovery()
    goToMode('signin')
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #1c2a14 0%, #2a3d1c 40%, #374524 100%)' }}>
      <div className="flex min-h-screen flex-col justify-between px-6 py-8">
        {/* Logo */}
        

        {/* Account created */}
        {mode === 'created' && (
          <div className="card p-6 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-100 dark:bg-success-900/40">
                <CheckCircle size={32} className="text-success-600 dark:text-success-400" />
              </div>
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Account Created!</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Your account is ready. Sign in with your email and password.
            </p>
            <button onClick={() => goToMode('signin')} className="btn-primary mt-5 w-full">
              Go to Sign In
            </button>
          </div>
        )}

        {/* Reset link sent */}
        {mode === 'forgot_sent' && (
          <div className="card p-6 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/40">
                <Mail size={32} className="text-primary-600 dark:text-primary-400" />
              </div>
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Check Your Email</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              A password reset link has been sent to{' '}
              <span className="font-semibold text-gray-700 dark:text-gray-300">{email}</span>.
              Click the link to set a new password.
            </p>
            <button onClick={() => goToMode('signin')} className="btn-secondary mt-5 w-full">
              Back to Sign In
            </button>
          </div>
        )}

        {/* Set new password (after clicking reset email link) */}
        {mode === 'reset' && (
          <div className="card p-6">
            <div className="mb-5 flex items-center gap-3">
              <button onClick={handleCancelReset} className="btn-ghost p-2 -ml-2">
                <ArrowLeft size={18} />
              </button>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Set New Password</h2>
                <p className="text-xs text-gray-500">Choose a strong password for your account</p>
              </div>
            </div>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="label">New Password</label>
                <input
                  type="password" className="input" value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters" required minLength={6}
                />
              </div>
              <div>
                <label className="label">Confirm New Password</label>
                <input
                  type="password" className="input" value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password" required minLength={6}
                />
              </div>
              {error && <ErrorBanner message={error} />}
              <button type="submit" disabled={loading} className="btn-primary w-full">
                <KeyRound size={16} />
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        )}

        {/* Forgot password form */}
        {mode === 'forgot' && (
          <div className="card p-6">
            <div className="mb-5 flex items-center gap-3">
              <button onClick={() => goToMode('signin')} className="btn-ghost p-2 -ml-2">
                <ArrowLeft size={18} />
              </button>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Forgot Password</h2>
                <p className="text-xs text-gray-500">Enter your email to receive a reset link</p>
              </div>
            </div>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="label">Email</label>
                <input
                  type="email" className="input" value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" required
                />
              </div>
              {error && <ErrorBanner message={error} />}
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          </div>
        )}

        {/* Sign in / Sign up */}
        {(mode === 'signin' || mode === 'signup') && (
  <div className="card p-6 max-w-xl w-full mx-auto my-auto">
            <div className="mb-5 flex rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
              <button
                onClick={() => goToMode('signin')}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${mode === 'signin' ? 'bg-white text-primary-600 shadow-sm dark:bg-gray-700 dark:text-primary-300' : 'text-gray-500'}`}
              >Sign In</button>
              <button
                onClick={() => goToMode('signup')}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${mode === 'signup' ? 'bg-white text-primary-600 shadow-sm dark:bg-gray-700 dark:text-primary-300' : 'text-gray-500'}`}
              >Sign Up</button>
            </div>

            {mode === 'signin' ? (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
                </div>
                <div>
                  <label className="label">Password</label>
                  <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
                </div>
                {error && <ErrorBanner message={error} />}
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
                <button type="button" onClick={() => goToMode('forgot')}
                  className="w-full text-center text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors">
                  Forgot password?
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label className="label">Full Name</label>
                  <input className="input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" required />
                </div>
                <div>
                  <label className="label">Phone Number</label>
                  <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" required />
                </div>
                <div>
                  <label className="label">Your Area Pincode</label>
                  <input
                    className="input" value={pincode}
                    onChange={e => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit pincode" maxLength={6} required
                  />
                  {pincodeChecking && <p className="mt-1.5 text-xs text-gray-400">Checking service area...</p>}
                  {!pincodeChecking && pincodeStatus && (
                    <div className={`mt-1.5 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                      pincodeStatus.served
                        ? 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300'
                        : 'bg-error-50 text-error-700 dark:bg-error-900/30 dark:text-error-300'
                    }`}>
                      {pincodeStatus.served
                        ? <><CheckCircle size={13} /> We serve {pincodeStatus.area}{pincodeStatus.city ? `, ${pincodeStatus.city}` : ''}!</>
                        : <><XCircle size={13} /> Sorry, we don&apos;t serve this area yet.</>}
                    </div>
                  )}
                </div>
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
                </div>
                <div>
                  <label className="label">Password</label>
                  <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" required minLength={6} />
                </div>
                {error && <ErrorBanner message={error} />}
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? 'Creating account...' : 'Create Account'}
                </button>
              </form>
            )}
          </div>
        )}

        {(mode === 'signin' || mode === 'signup') && (
          <button
            onClick={() => navigate('/dp-signup')}
            className="mt-4 flex items-center justify-between rounded-2xl border border-white/20 bg-white/10 px-5 py-4 text-left transition-colors hover:bg-white/15"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: 'rgba(143,169,100,0.25)' }}>
                <Bike size={20} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Become a Delivery Partner</p>
                <p className="text-xs text-white/60">Sign up to earn money delivering</p>
              </div>
            </div>
            <ArrowRight size={18} className="text-white/40" />
          </button>
        )}

        {(mode === 'signin' || mode === 'signup') && (
          <p className="mt-6 text-center text-xs text-white/40">
            By continuing you agree to our Terms &amp; Privacy Policy
          </p>
        )}

        {(mode === 'signin' || mode === 'signup') && (
          <div
  className="mt-auto overflow-hidden rounded-2xl border border-white/10"
  style={{ background: 'linear-gradient(135deg, #3a5228 0%, #4a6830 100%)' }}
>
            <div className="grid grid-cols-4">
              {[
                { icon: <MessageCircle size={22} />, title: 'CHAT', sub: 'Easy Conversation' },
                { icon: <MapPin size={22} />, title: 'LOCATION', sub: 'Live Tracking' },
                { icon: <Bike size={22} />, title: 'DELIVERY', sub: 'Fast & Reliable' },
                { icon: <Package size={22} />, title: 'GET IT', sub: 'At Your Doorstep' },
              ].map((f, i) => (
                <div key={i} className="flex flex-col items-center gap-1 px-1 py-4 text-center"
                  style={{ borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
                  <span className="text-white">{f.icon}</span>
                  <p className="mt-0.5 text-[10px] font-black tracking-wide text-white">{f.title}</p>
                  <p className="text-[8px] font-semibold leading-tight text-white/80">{f.sub}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
