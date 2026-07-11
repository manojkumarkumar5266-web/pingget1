import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    const { error } = await updatePassword(password)

    setLoading(false)

    if (error) {
      setError(error)
      return
    }

    alert('Password updated successfully')

    navigate('/auth')
  }

  return (
    <AuthLayout showBrand={false}>
      <div className="card p-6">

        <h2 className="text-xl font-bold mb-2">
          Reset Password
        </h2>

        <p className="text-sm text-gray-500 mb-6">
          Enter your new password.
        </p>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >

          <div>
            <label className="label">
              New Password
            </label>

            <input
              type="password"
              className="input"
              value={password}
              onChange={(e)=>setPassword(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">
              Confirm Password
            </label>

            <input
              type="password"
              className="input"
              value={confirmPassword}
              onChange={(e)=>setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {error && <ErrorBanner message={error} />}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading
              ? 'Updating...'
              : 'Update Password'}
          </button>

        </form>

      </div>
    </AuthLayout>
  )
}