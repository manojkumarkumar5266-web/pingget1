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

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setError('Authentication failed. Please try again.'); setEmail(''); setPassword(''); setLoading(false); return }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle()
    if (profile?.role !== 'admin') {
      await supabase.auth.signOut()
      setError('Access denied. This login is for administrators only.')
      setEmail(''); setPassword(''); setLoading(false)
      return
    }
    // Admin confirmed — App.tsx redirects to /admin
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!resetEmail.trim()) { setError('Please enter your email address'); return }
    setLoading(true)

    // Validate email exists in the database before sending reset link
    const { data: checkData, error: checkError } = await supabase.functions.invoke('check-email', {
      body: { email: resetEmail.trim() },
    })
    if (checkError || !checkData?.exists) {
      setError('No account found with this email address.')
      setLoading(false)
      return
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      resetEmail.trim(),
      { redirectTo: window.location.origin + '/reset-password' }
    )
    if (resetError) {
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

  if (view === 'forgot') {
    return (
      <AuthLayout showBrand={false}>
        <div className="card p-6">
          <button onClick={() => { setView('login'); setError(null); setResetSent(false) }} className="text-sm text-primary-600 dark:text-primary-400 mb-4">← Back to Admin Login</button>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Forgot Password</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Enter your email and we&apos;ll send you a reset link.</p>
          {resetSent ? (
            <div className="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-800 dark:bg-success-900/30 dark:text-success-300">
              <div className="flex items-center gap-2"><CheckCircle size={16} className="shrink-0" /> Reset link sent! Check your email.</div>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div><label className="label flex items-center gap-1.5"><Mail size={14} /> Email</label><input type="email" className="input" value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="admin@pingget.com" required /></div>
              {error && <ErrorBanner message={error} />}
              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2"><KeyRound size={16} /> {loading ? 'Sending...' : 'Send Reset Link'}</button>
            </form>
          )}
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="card p-6">
        <div className="mb-6 text-center">
          <div className="mb-3 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: '#808000' }}>
              <ShieldCheck size={24} className="text-white" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Admin Login</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Restricted access — administrators only</p>
        </div>
        {error && <ErrorBanner message={error} />}
        <form onSubmit={handleLogin} className="space-y-4">
          <div><label className="label flex items-center gap-1.5"><Mail size={14} /> Email</label><input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@pingget.com" required /></div>
          <div>
            <label className="label flex items-center gap-1.5"><Lock size={14} /> Password</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} className="input pr-10" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
          </div>
          <div className="text-right"><button type="button" onClick={() => { setView('forgot'); setError(null); setResetSent(false) }} className="text-xs text-primary-600 dark:text-primary-400 hover:underline">Forgot password?</button></div>
          <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? 'Signing in...' : 'Sign In as Admin'}</button>
        </form>
        <div className="mt-5 text-center"><button onClick={() => navigate('/auth')} className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">← Back to user login</button></div>
      </div>
    </AuthLayout>
  )
}
