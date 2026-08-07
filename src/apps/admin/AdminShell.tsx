import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from '../../context'
import { FullScreenLoader } from '../../components/ui'
import AdminLogin from '../../pages/AdminLogin'
import AdminApp from '../../pages/admin/AdminApp'
import ResetPassword from '../../pages/ResetPassword'
import SetupAdmin from '../../pages/SetupAdmin'
import Watermark from '../../components/Watermark'

/**
 * Admin web console shell (browser only — not packaged as a mobile app).
 * Only allows role=admin. Shares the same Supabase project as User + DP apps.
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
        <Routes>
          <Route path="/setup-admin" element={<SetupAdmin />} />
          <Route path="/login" element={<AdminLogin />} />
          <Route path="/auth" element={<AdminLogin />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
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
