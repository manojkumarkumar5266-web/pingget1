import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Eye, EyeOff, CheckCircle, KeyRound } from 'lucide-react'
import { useAuth } from '../context'
import { ErrorBanner } from '../components/ui'
import AuthLayout from '../components/AuthLayout'

export default function ResetPassword() {
  const navigate = useNavigate()
  const { updatePassword } = useAuth()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }

    setLoading(true)
    const { error } = await updatePassword(password)
    setLoading(false)

    if (error) { setError(error); return }
    setSuccess(true)
    setTimeout(() => navigate('/auth'), 2500)
  }

  if (success) {
    return (
      <AuthLayout showBrand={false}>
        <div className="card p-6 text-center animate-bounce-in">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-100 dark:bg-success-900/40">
              <CheckCircle size={32} className="text-success-600 dark:text-success-400" />
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/40">
            <KeyRound size={20} className="text-primary-600 dark:text-primary-400" />
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-gray-600">
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
              <p className="mt-1 text-xs text-error-600">Passwords do not match</p>
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
