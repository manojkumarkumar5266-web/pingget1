import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../../context'
import { FullScreenLoader } from '../../components/ui'
import AuthScreen from '../../pages/AuthScreen'
import ResetPassword from '../../pages/ResetPassword'
import DpApp from '../../pages/dp/DpApp'
import LandingPage, { landingDoneKey } from '../../pages/LandingPage'
import PermissionOnboarding from '../../components/PermissionOnboarding'
import Watermark from '../../components/Watermark'
import { Clock, XCircle, ArrowLeft } from 'lucide-react'

const ONBOARDING_KEY = 'pingget_dp_permissions_done'

/** Keep Partner URLs under /dp/* so resolveAppTarget() stays on the DP shell. */
const DP_LANDING = '/dp/landing'
const DP_AUTH = '/dp/auth'
const DP_RESET = '/dp/reset-password'

function DpPendingScreen() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const handleBack = async () => {
    await signOut()
    navigate(DP_AUTH, { replace: true })
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
    navigate(DP_AUTH, { replace: true })
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
 * Partner shell — all unauthenticated routes stay under /dp/* so the unified
 * web router keeps resolving this shell (not the Customer app).
 */
export default function DpShell() {
  const { session, profile, loading, passwordRecovery, oauthResolving, signOut } = useAuth()
  const location = useLocation()
  const [showPermissions, setShowPermissions] = useState(() => {
    if (typeof window === 'undefined') return false
    return !localStorage.getItem(ONBOARDING_KEY)
  })
  const [roleError, setRoleError] = useState<string | null>(null)
  const landingDone = typeof window !== 'undefined' && !!localStorage.getItem(landingDoneKey(true))

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

  useEffect(() => {
    if (session) {
      localStorage.setItem(ONBOARDING_KEY, '1')
      localStorage.setItem(landingDoneKey(true), '1')
      setShowPermissions(false)
    }
  }, [session])

  if (passwordRecovery || location.pathname === DP_RESET || location.pathname === '/reset-password') {
    return (
      <>
        <Watermark />
        <Routes>
          <Route path={DP_RESET} element={<ResetPassword />} />
          <Route path="/reset-password" element={<Navigate to={DP_RESET} replace />} />
          <Route path="*" element={<Navigate to={DP_RESET} replace />} />
        </Routes>
      </>
    )
  }

  if (loading) return <FullScreenLoader />

  if (showPermissions && !session) {
    return (
      <PermissionOnboarding
        onComplete={() => {
          localStorage.setItem(ONBOARDING_KEY, '1')
          setShowPermissions(false)
        }}
      />
    )
  }

  if (!session) {
    const defaultPath = landingDone ? DP_AUTH : DP_LANDING
    return (
      <>
        <Watermark />
        {roleError && (
          <div className="fixed top-4 left-4 right-4 z-50 rounded-xl bg-red-500/20 border border-red-500/40 px-4 py-3 text-sm text-red-200 text-center">
            {roleError}
          </div>
        )}
        <Routes>
          <Route path={DP_AUTH} element={<AuthScreen fixedRole="dp" />} />
          <Route path={DP_LANDING} element={landingDone ? <Navigate to={DP_AUTH} replace /> : <LandingPage />} />
          {/* Legacy absolute paths → keep under /dp */}
          <Route path="/auth" element={<Navigate to={DP_AUTH} replace />} />
          <Route path="/landing" element={<Navigate to={DP_LANDING} replace />} />
          <Route path="*" element={<Navigate to={defaultPath} replace />} />
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
      <DpApp />
    </>
  )
}
