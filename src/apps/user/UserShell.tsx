import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../../context'
import { FullScreenLoader } from '../../components/ui'
import AuthScreen from '../../pages/AuthScreen'
import ResetPassword from '../../pages/ResetPassword'
import UserApp from '../../pages/user/UserApp'
import LandingPage, { landingDoneKey } from '../../pages/LandingPage'
import PermissionOnboarding from '../../components/PermissionOnboarding'
import Watermark from '../../components/Watermark'

const ONBOARDING_KEY = 'pingget_permissions_done'

/**
 * Customer shell.
 * First open: permissions → Get Started (once).
 * After Get Started or any sign-in: never show welcome again — auth or app only.
 */
export default function UserShell() {
  const { session, profile, loading, passwordRecovery, oauthResolving, signOut } = useAuth()
  const location = useLocation()
  const [showPermissions, setShowPermissions] = useState(() => {
    if (typeof window === 'undefined') return false
    return !localStorage.getItem(ONBOARDING_KEY)
  })
  const [roleError, setRoleError] = useState<string | null>(null)
  const landingDone = typeof window !== 'undefined' && !!localStorage.getItem(landingDoneKey(false))

  useEffect(() => {
    if (!loading && session && !profile && !passwordRecovery && !oauthResolving) {
      signOut()
    }
  }, [loading, session, profile, signOut, passwordRecovery, oauthResolving])

  useEffect(() => {
    if (!loading && profile && profile.role !== 'user') {
      setRoleError('This app is for customers only. Please use the Partner or Admin app.')
      signOut()
    }
  }, [loading, profile, signOut])

  // Signed-in users never see welcome/landing again
  useEffect(() => {
    if (session) {
      localStorage.setItem(ONBOARDING_KEY, '1')
      localStorage.setItem(landingDoneKey(false), '1')
      setShowPermissions(false)
    }
  }, [session])

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
    const defaultPath = landingDone ? '/auth' : '/landing'
    return (
      <>
        <Watermark />
        {roleError && (
          <div className="fixed top-4 left-4 right-4 z-50 rounded-xl bg-red-500/20 border border-red-500/40 px-4 py-3 text-sm text-red-200 text-center">
            {roleError}
          </div>
        )}
        <Routes>
          <Route path="/auth" element={<AuthScreen fixedRole="user" />} />
          <Route path="/landing" element={landingDone ? <Navigate to="/auth" replace /> : <LandingPage />} />
          <Route path="*" element={<Navigate to={defaultPath} replace />} />
        </Routes>
      </>
    )
  }

  if (!profile) return <FullScreenLoader />
  if (profile.role !== 'user') return <FullScreenLoader />

  return (
    <>
      <Watermark />
      <Routes>
        <Route path="/app/*" element={<UserApp />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </>
  )
}
