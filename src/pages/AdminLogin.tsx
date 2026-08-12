import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context'
import { supabase } from '../lib/supabase'
import { ErrorBanner } from '../components/ui'
import AuthLayout from '../components/AuthLayout'
import { pg } from '../design/tokens'
import { CTA } from '../design/primitives'
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

    setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setError('Authentication failed.'); setLoading(false); return }
      const { data: userProfile } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle()
      if (!userProfile || userProfile.role !== 'admin') {
        await supabase.auth.signOut()
        setError('Access denied. This login is for administrators only.')
        setEmail(''); setPassword(''); setLoading(false)
      }
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
      <AuthLayout title="Forgot Password" subtitle="Enter your email and we'll send you a reset link.">
        <button type="button" onClick={() => { setView('login'); setError(null); setResetSent(false) }}
          className="mb-5 flex items-center gap-1 text-sm font-bold" style={{ color: pg.lime }}>
          ← Back to Admin Login
        </button>
        {resetSent ? (
          <div className="rounded-2xl px-4 py-4 text-sm" style={{ background: pg.surface2, color: pg.ink, border: `1px solid ${pg.line}` }}>
            <div className="flex items-center gap-2 text-[#F5F7F6]">
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
            <CTA type="submit" disabled={loading} className="w-full">
              <KeyRound size={16} /> {loading ? 'Sending...' : 'Send Reset Link'}
            </CTA>
          </form>
        )}
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Admin Login" subtitle="Restricted access — administrators only">
      <div className="mb-6 flex justify-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: pg.limeDim, border: `1px solid rgba(196,214,0,0.28)` }}>
          <ShieldCheck size={26} style={{ color: pg.lime }} />
        </div>
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
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: pg.text3 }}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div className="text-right">
          <button type="button" onClick={() => { setView('forgot'); setError(null) }}
            className="text-xs font-bold hover:underline" style={{ color: pg.lime }}>
            Forgot password?
          </button>
        </div>
        <CTA type="submit" disabled={loading} className="w-full">
          {loading ? 'Signing in...' : 'Sign In as Admin'}
        </CTA>
      </form>
      <div className="mt-5 text-center">
        <button type="button" onClick={() => navigate('/auth')} className="text-xs hover:underline" style={{ color: pg.text3 }}>
          ← Back to user login
        </button>
      </div>
    </AuthLayout>
  )
}
