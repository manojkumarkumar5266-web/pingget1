import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context'
import { FullScreenLoader } from './components/ui'
import AuthScreen from './pages/AuthScreen'
import DpSignup from './pages/DpSignup'
import UserApp from './pages/user/UserApp'
import DpApp from './pages/dp/DpApp'
import AdminApp from './pages/admin/AdminApp'
import CompleteProfile from './pages/CompleteProfile'

// Lazy-loaded only in dev — tree-shaken out of production bundles
const DevAdminSetup = import.meta.env.DEV
  ? (await import('./pages/DevAdminSetup')).default
  : null

export default function App() {
  const { session, profile, loading, passwordRecovery } = useAuth()
  const location = useLocation()

  // Dev-only admin setup page — accessible regardless of auth state
  if (import.meta.env.DEV && location.pathname === '/admin-setup') {
    return (
      <Routes>
        <Route path="/admin-setup" element={DevAdminSetup ? <DevAdminSetup /> : null} />
      </Routes>
    )
  }

  if (location.pathname === '/dp-signup') {
    return (
      <Routes>
        <Route path="/dp-signup" element={<DpSignup />} />
      </Routes>
    )
  }

  if (loading) return <FullScreenLoader />

  // Show auth screen for password reset flow even if session exists
  if (!session || passwordRecovery) {
    return (
      <Routes>
        <Route path="/auth" element={<AuthScreen />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    )
  }

  if (!profile) {
    return (
      <Routes>
        <Route path="/complete-profile" element={<CompleteProfile />} />
        <Route path="*" element={<Navigate to="/complete-profile" replace />} />
      </Routes>
    )
  }

  if (profile.role === 'admin') {
    return (
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    )
  }

  if (profile.role === 'dp') {
    return (
      <Routes>
        <Route path="/dp/*" element={<DpApp />} />
        <Route path="/complete-profile" element={<CompleteProfile />} />
        <Route path="*" element={<Navigate to="/dp" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/app/*" element={<UserApp />} />
      <Route path="/complete-profile" element={<CompleteProfile />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}
