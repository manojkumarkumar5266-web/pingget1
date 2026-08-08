import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../../context'
import { FullScreenLoader } from '../../components/ui'
import AuthScreen from '../../pages/AuthScreen'
import ResetPassword from '../../pages/ResetPassword'
import DpApp from '../../pages/dp/DpApp'
import LandingPage from '../../pages/LandingPage'
import Welcome from '../../components/Welcome'
import PermissionOnboarding from '../../components/PermissionOnboarding'
import Watermark from '../../components/Watermark'
import { Clock, XCircle, ArrowLeft } from 'lucide-react'

const ONBOARDING_KEY = 'pingget_dp_permissions_done'
const WELCOME_KEY = 'pingget_dp_welcomed'

function DpPendingScreen() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const handleBack = async () => {
    await signOut()
    navigate('/auth', { replace: true })
  }
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl glass">
        <Clock size={48} className="text-yellow-400" />
      </div>
      <h1 className="mb-2 text-2xl font-bold text-white">Awaiting Approval</h1>
      <p className="mb-6 max-w-sm text-sm text-white/60">
        Your delivery partner application is under review. You will be notified once an admin approves it.
      </p>
      <button onClick={handleBack} className="btn-primary inline-flex items-center gap-2">
        <ArrowLeft size={16} /> Back to Sign In
      </button>
    </div>
  )
}

function DpRejectedScreen() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const handleBack = async () => {
    await signOut()
    navigate('/auth', { replace: true })
  }
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl glass">
        <XCircle size={48} className="text-red-400" />
      </div>
      <h1 className="mb-2 text-2xl font-bold text-white">Application Not Approved</h1>
      <p className="mb-6 max-w-sm text-sm text-white/60">
        Your delivery partner application was not approved. Please contact support for more details.
      </p>
      <button onClick={handleBack} className="btn-primary inline-flex items-center gap-2">
        <ArrowLeft size={16} /> Back to Sign In
      </button>
    </div>
  )
}

/**
 * Delivery Partner mobile app shell.
 * Only allows role=dp. Customer/admin accounts are signed out.
 */
export default function DpShell() {
  const { session, profile, loading, passwordRecovery, oauthResolving, signOut } = useAuth()
  const location = useLocation()
  const [showWelcome, setShowWelcome] = useState(() => !sessionStorage.getItem(WELCOME_KEY))
  const [showPermissions, setShowPermissions] = useState(() => {
    if (typeof window === 'undefined') return false
    return !localStorage.getItem(ONBOARDING_KEY) && !sessionStorage.getItem(WELCOME_KEY)
  })
  const [roleError, setRoleError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && session && !profile && !passwordRecovery && !oauthResolving) {
      signOut()
    }
  }, [loading, session, profile, signOut, passwordRecovery, oauthResolving])

  useEffect(() => {
    if (!loading && profile && profile.role !== 'dp') {
      setRoleError('This app is for delivery partners only. Please use the Customer app.')
      signOut()
    }
  }, [loading, profile, signOut])

  const isRecoveryRoute = location.pathname === '/reset-password' || passwordRecovery

  if (!isRecoveryRoute && showWelcome) {
    return (
      <Welcome
        onDone={() => {
          sessionStorage.setItem(WELCOME_KEY, '1')
          setShowWelcome(false)
        }}
      />
    )
  }
  if (!isRecoveryRoute && showPermissions) {
    return (
      <PermissionOnboarding
        onComplete={() => {
          localStorage.setItem(ONBOARDING_KEY, '1')
          setShowPermissions(false)
        }}
      />
    )
  }

  if (passwordRecovery || location.pathname === '/reset-password') {
    return (
      <>
        <Watermark />
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<Navigate to="/reset-password" replace />} />
        </Routes>
      </>
    )
  }

  if (loading) return <FullScreenLoader />

  if (!session) {
    return (
      <>
        <Watermark />
        {roleError && (
          <div className="fixed top-4 left-4 right-4 z-50 rounded-xl bg-red-500/20 border border-red-500/40 px-4 py-3 text-sm text-red-200 text-center">
            {roleError}
          </div>
        )}
        <Routes>
          <Route path="/auth" element={<AuthScreen fixedRole="dp" />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="*" element={<Navigate to="/landing" replace />} />
        </Routes>
      </>
    )
  }

  if (!profile) return <FullScreenLoader />

  if (profile.role !== 'dp') return <FullScreenLoader />

  if (profile.status === 'pending') {
    return (
      <>
        <Watermark />
        <DpPendingScreen />
      </>
    )
  }

  if (profile.status === 'rejected' || profile.status === 'suspended' || profile.status === 'banned') {
    return (
      <>
        <Watermark />
        <DpRejectedScreen />
      </>
    )
  }

  return (
    <>
      <Watermark />
      <Routes>
        <Route path="/dp/*" element={<DpApp />} />
        <Route path="*" element={<Navigate to="/dp" replace />} />
      </Routes>
    </>
  )
}
