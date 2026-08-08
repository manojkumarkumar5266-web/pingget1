import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from '../../context'
import { FullScreenLoader } from '../../components/ui'
import AdminLogin from '../../pages/AdminLogin'
import AdminApp from '../../pages/admin/AdminApp'
import ResetPassword from '../../pages/ResetPassword'
import SetupAdmin from '../../pages/SetupAdmin'
import Watermark from '../../components/Watermark'

const ADMIN_LOGIN = '/admin/login'
const ADMIN_SETUP = '/admin/setup-admin'
const ADMIN_RESET = '/admin/reset-password'

/**
 * Admin web console shell.
 * Unauthenticated routes stay under /admin/* so unified web keeps this shell.
 */
export default function AdminShell() {
  const { session, profile, loading, passwordRecovery, oauthResolving, signOut } = useAuth()
  const location = useLocation()

  useEffect(() => {
    if (!loading && session && !profile && !passwordRecovery && !oauthResolving) {
      signOut()
    }
  }, [loading, session, profile, signOut, passwordRecovery, oauthResolving])

  useEffect(() => {
    if (!loading && profile && profile.role !== 'admin') {
      signOut()
    }
  }, [loading, profile, signOut])

  if (
    passwordRecovery ||
    location.pathname === ADMIN_RESET ||
    location.pathname === '/reset-password'
  ) {
    return (
      <>
        <Watermark />
        <Routes>
          <Route path={ADMIN_RESET} element={<ResetPassword />} />
          <Route path="/reset-password" element={<Navigate to={ADMIN_RESET} replace />} />
          <Route path="*" element={<Navigate to={ADMIN_RESET} replace />} />
        </Routes>
      </>
    )
  }

  if (loading) return <FullScreenLoader />

  if (!session) {
    return (
      <>
        <Watermark />
        <Routes>
          <Route path={ADMIN_SETUP} element={<SetupAdmin />} />
          <Route path={ADMIN_LOGIN} element={<AdminLogin />} />
          <Route path="/admin/auth" element={<AdminLogin />} />
          {/* Legacy absolute paths */}
          <Route path="/setup-admin" element={<Navigate to={ADMIN_SETUP} replace />} />
          <Route path="/login" element={<Navigate to={ADMIN_LOGIN} replace />} />
          <Route path="/auth" element={<Navigate to={ADMIN_LOGIN} replace />} />
          <Route path="*" element={<Navigate to={ADMIN_LOGIN} replace />} />
        </Routes>
      </>
    )
  }

  if (!profile) return <FullScreenLoader />

  if (profile.role !== 'admin') {
    return <FullScreenLoader />
  }

  return (
    <>
      <Watermark />
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </>
  )
}
