import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context'
import { supabase } from '../lib/supabase'
import { ErrorBanner } from '../components/ui'
import AuthLayout from '../components/AuthLayout'
import { Mail, Lock, Eye, EyeOff, ShieldCheck, KeyRound, CircleCheck as CheckCircle } from 'lucide-react'

type View = 'login' | 'forgot'

export default function AdminLogin() {
  const { signInWithEmail } = useAuth()
  const navigate = useNavigate()

  const [view, setView] = useState<View>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) { setError('Please enter your email and password'); return }
    setLoading(true)

    const { error: signInError } = await signInWithEmail(email.trim(), password)
    if (signInError) { setError(signInError); setEmail(''); setPassword(''); setLoading(false); return }

    // AuthContext onAuthStateChange will load profile and App.tsx will redirect by role
    // Just wait briefly for the redirect to happen
    // If not admin, the AuthContext profile check will show an error
    setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setError('Authentication failed.'); setLoading(false); return }
      const { data: userProfile } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle()
      if (!userProfile || userProfile.role !== 'admin') {
        await supabase.auth.signOut()
        setError('Access denied. This login is for administrators only.')
        setEmail(''); setPassword(''); setLoading(false)
      }
      // If admin, App.tsx will redirect — nothing to do here
    }, 1500)
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!resetEmail.trim()) { setError('Please enter your email address'); return }
    setLoading(true)
    try {
      await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: window.location.origin + '/reset-password',
      })
    } catch { /* best effort */ }
    setLoading(false)
    setResetSent(true)
  }

  if (view === 'forgot') {
    return (
      <AuthLayout showBrand={false}>
        <div className="card p-6 animate-fade-in">
          <button onClick={() => { setView('login'); setError(null); setResetSent(false) }}
            className="text-sm mb-4 flex items-center gap-1" style={{ color: '#8fa964' }}>
            ← Back to Admin Login
          </button>
          <h2 className="text-xl font-bold text-white mb-1">Forgot Password</h2>
          <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Enter your email and we'll send you a reset link.
          </p>
          {resetSent ? (
            <div className="rounded-xl px-4 py-3 text-sm text-white glass-dark">
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="shrink-0 text-green-400" />
                Reset link sent! Check your email.
              </div>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="label flex items-center gap-1.5"><Mail size={14} /> Email</label>
                <input type="email" className="input" value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="admin@pingget.com" required />
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

  return (
    <AuthLayout>
      <div className="card p-6 animate-fade-in">
        <div className="mb-6 text-center">
          <div className="mb-3 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'linear-gradient(135deg, #6e8c45, #374524)' }}>
              <ShieldCheck size={24} className="text-white" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-white">Admin Login</h2>
          <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Restricted access — administrators only</p>
        </div>
        {error && <ErrorBanner message={error} />}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="label flex items-center gap-1.5"><Mail size={14} /> Email</label>
            <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@pingget.com" required />
          </div>
          <div>
            <label className="label flex items-center gap-1.5"><Lock size={14} /> Password</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} className="input pr-10" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="text-right">
            <button type="button" onClick={() => { setView('forgot'); setError(null) }}
              className="text-xs hover:underline" style={{ color: '#8fa964' }}>
              Forgot password?
            </button>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Signing in...' : 'Sign In as Admin'}
          </button>
        </form>
        <div className="mt-5 text-center">
          <button onClick={() => navigate('/auth')} className="text-xs hover:underline" style={{ color: 'rgba(255,255,255,0.4)' }}>
            ← Back to user login
          </button>
        </div>
      </div>
    </AuthLayout>
  )
}
