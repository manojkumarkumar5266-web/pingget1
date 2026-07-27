import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Eye, EyeOff, CheckCircle, KeyRound, Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '../context'
import { ErrorBanner } from '../components/ui'
import AuthLayout from '../components/AuthLayout'

export default function ResetPassword() {
  const navigate = useNavigate()
  const { updatePassword, passwordRecovery, loading: authLoading } = useAuth()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  // Wait up to 8s for the PASSWORD_RECOVERY event before declaring expired
  const [waited, setWaited] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 8000)
    return () => clearTimeout(t)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }

    if (!passwordRecovery) {
      setError('Your reset link has expired. Please request a new password reset link.')
      return
    }

    setLoading(true)
    const { error } = await updatePassword(password)
    setLoading(false)
    if (error) { setError(error); return }
    setSuccess(true)
    setTimeout(() => navigate('/auth'), 2500)
  }

  // Still waiting for auth state
  if (authLoading || (!passwordRecovery && !waited)) {
    return (
      <AuthLayout showBrand={false}>
        <div className="card p-8 text-center animate-fade-in">
          <Loader2 size={32} className="mx-auto mb-4 animate-spin" style={{ color: '#808000' }} />
          <p className="text-sm text-white/50">Verifying your reset link...</p>
        </div>
      </AuthLayout>
    )
  }

  // No recovery session found after waiting
  if (!passwordRecovery) {
    return (
      <AuthLayout showBrand={false}>
        <div className="card p-6 text-center animate-fade-in">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: 'rgba(239,68,68,0.15)' }}>
              <AlertCircle size={32} className="text-red-400" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Reset Link Expired</h2>
          <p className="text-sm text-white/50 mb-6">This password reset link is invalid or has expired. Please request a new one.</p>
          <button onClick={() => navigate('/auth')} className="btn-primary w-full">Back to Sign In</button>
        </div>
      </AuthLayout>
    )
  }

  if (success) {
    return (
      <AuthLayout showBrand={false}>
        <div className="card p-6 text-center animate-bounce-in">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: 'linear-gradient(135deg, #808000, #484800)' }}>
              <CheckCircle size={32} className="text-white" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-white">Password Updated!</h2>
          <p className="mt-2 text-sm text-white/50">
            Your password has been changed successfully. Redirecting to sign in...
          </p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout showBrand={false}>
      <div className="card p-6 animate-slide-up">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(128,128,0,0.15)' }}>
            <KeyRound size={20} style={{ color: '#808000' }} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Reset Password</h2>
            <p className="text-sm text-white/50">Enter your new password</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label flex items-center gap-1.5"><Lock size={14} /> New Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="input pr-10"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="label flex items-center gap-1.5"><Lock size={14} /> Confirm Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              className="input"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              required
            />
            {confirmPassword && password !== confirmPassword && (
              <p className="mt-1 text-xs text-red-400">Passwords do not match</p>
            )}
          </div>

          {error && <ErrorBanner message={error} />}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </AuthLayout>
  )
}
