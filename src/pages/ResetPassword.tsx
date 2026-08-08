import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Eye, EyeOff, CheckCircle, KeyRound, Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '../context'
import { ErrorBanner } from '../components/ui'
import AuthLayout from '../components/AuthLayout'
import { pg } from '../design/tokens'
import { CTA } from '../design/primitives'

export default function ResetPassword() {
  const navigate = useNavigate()
  const { updatePassword, passwordRecovery, loading: authLoading } = useAuth()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
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
    setTimeout(() => {
      const dest = window.location.pathname.startsWith('/dp') ? '/dp/auth' : '/auth'
      navigate(dest)
    }, 2500)
  }

  if (success) {
    return (
      <AuthLayout showBrand={false}>
        <div className="text-center animate-bounce-in">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: pg.lime }}>
              <CheckCircle size={32} style={{ color: pg.limeText }} />
            </div>
          </div>
          <h2 className="text-lg font-extrabold">Password Updated!</h2>
          <p className="mt-2 text-sm" style={{ color: pg.text3 }}>
            Your password has been changed successfully. Redirecting to sign in...
          </p>
        </div>
      </AuthLayout>
    )
  }

  if (authLoading || (!passwordRecovery && !waited)) {
    return (
      <AuthLayout showBrand={false}>
        <div className="py-4 text-center animate-fade-in">
          <Loader2 size={32} className="mx-auto mb-4 animate-spin" style={{ color: pg.lime }} />
          <p className="text-sm" style={{ color: pg.text3 }}>Verifying your reset link...</p>
        </div>
      </AuthLayout>
    )
  }

  if (!passwordRecovery) {
    return (
      <AuthLayout showBrand={false}>
        <div className="text-center animate-fade-in">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: 'rgba(255,77,79,0.15)' }}>
              <AlertCircle size={32} style={{ color: pg.danger }} />
            </div>
          </div>
          <h2 className="mb-2 text-xl font-extrabold">Reset Link Expired</h2>
          <p className="mb-6 text-sm" style={{ color: pg.text3 }}>This password reset link is invalid or has expired. Please request a new one.</p>
          <CTA onClick={() => navigate('/auth')} className="w-full">Back to Sign In</CTA>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout showBrand={false}>
      <div className="animate-slide-up">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: pg.limeDim }}>
            <KeyRound size={20} style={{ color: pg.lime }} />
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">Reset Password</h2>
            <p className="text-sm" style={{ color: pg.text3 }}>Enter your new password</p>
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
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: pg.text3 }}
              >
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
              <p className="mt-1 text-xs" style={{ color: pg.danger }}>Passwords do not match</p>
            )}
          </div>

          {error && <ErrorBanner message={error} />}

          <CTA type="submit" disabled={loading} className="w-full">
            {loading ? 'Updating...' : 'Update Password'}
          </CTA>
        </form>
      </div>
    </AuthLayout>
  )
}
