import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context'
import AuthLayout from '../components/AuthLayout'
import { ErrorBanner } from '../components/ui'
import { Lock, Eye, EyeOff, CircleCheck as CheckCircle, ShieldCheck } from 'lucide-react'

export default function ResetPassword() {
  const { updatePassword, profile } = useAuth()
  const navigate = useNavigate()

  // Capture role before sign-out clears the profile
  const savedRole = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (profile?.role) savedRole.current = profile.role
  }, [profile?.role])

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return }
    setLoading(true)
    const { error: updateError } = await updatePassword(newPassword)
    setLoading(false)
    if (updateError) { setError(updateError); return }
    setDone(true)
  }

  const handleContinue = () => {
    navigate(savedRole.current === 'admin' ? '/admin/login' : '/auth', { replace: true })
  }

  if (done) {
    return (
      <AuthLayout showBrand={false}>
        <div className="card p-6 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-100 dark:bg-success-900/40">
              <CheckCircle size={32} className="text-success-600 dark:text-success-400" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Password Updated!</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Your password has been reset successfully. You can now sign in with your new password.
          </p>
          <button onClick={handleContinue} className="btn-primary mt-5 w-full">
            Continue to Sign In
          </button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout showBrand={false}>
      <div className="card p-6">
        <div className="mb-6 text-center">
          <div className="mb-3 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: '#808000' }}>
              <ShieldCheck size={24} className="text-white" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Reset Password</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Enter your new password below</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label flex items-center gap-1.5">
              <Lock size={14} /> New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="input pr-10"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="label flex items-center gap-1.5">
              <Lock size={14} /> Re-enter New Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              className="input"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm your new password"
              required
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="mt-1 text-xs text-error-600">Passwords do not match</p>
            )}
          </div>

          {error && <ErrorBanner message={error} />}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Updating password...' : 'Update Password'}
          </button>
        </form>
      </div>
    </AuthLayout>
  )
}
