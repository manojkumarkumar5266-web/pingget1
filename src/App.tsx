import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from './context'
import { FullScreenLoader } from './components/ui'
import AuthScreen from './pages/AuthScreen'
import DpSignup from './pages/DpSignup'
import AdminLogin from './pages/AdminLogin'
import ResetPassword from './pages/ResetPassword'
import UserApp from './pages/user/UserApp'
import DpApp from './pages/dp/DpApp'
import AdminApp from './pages/admin/AdminApp'
import CompleteProfile from './pages/CompleteProfile'
import SetupAdmin from './pages/SetupAdmin'
import LandingPage from './pages/LandingPage'
import Welcome from './components/Welcome'
import PermissionOnboarding from './components/PermissionOnboarding'
import Watermark from './components/Watermark'

const ONBOARDING_KEY = 'pingget_permissions_done'
const WELCOME_KEY = 'pingget_welcomed'

export default function App() {
  const { session, profile, loading, passwordRecovery } = useAuth()
  const location = useLocation()
  const [showWelcome, setShowWelcome] = useState(() => !sessionStorage.getItem(WELCOME_KEY))
  const [showPermissions, setShowPermissions] = useState(() => {
    if (typeof window === 'undefined') return false
    return !localStorage.getItem(ONBOARDING_KEY) && !sessionStorage.getItem(WELCOME_KEY)
  })

  const handleWelcomeDone = () => {
    sessionStorage.setItem(WELCOME_KEY, '1')
    setShowWelcome(false)
  }

  const handlePermissionsDone = () => {
    localStorage.setItem(ONBOARDING_KEY, '1')
    setShowPermissions(false)
  }

  if (showWelcome) {
    return <Welcome onDone={handleWelcomeDone} />
  }

  if (showPermissions) {
    return <PermissionOnboarding onComplete={handlePermissionsDone} />
  }

  // Public routes that don't require auth
  const isPublicRoute = ['/setup-admin', '/admin/login', '/dp-signup', '/reset-password', '/landing'].includes(location.pathname)

  if (isPublicRoute && !session) {
    return (
      <>
        <Watermark />
        <Routes>
          <Route path="/setup-admin" element={<SetupAdmin />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/dp-signup" element={<DpSignup />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="*" element={<Navigate to="/landing" replace />} />
        </Routes>
      </>
    )
  }

  if (loading) return <FullScreenLoader />

  if (passwordRecovery || location.pathname === "/reset-password") {
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

  if (!session) {
    return (
      <>
        <Watermark />
        <Routes>
          <Route path="/auth" element={<AuthScreen />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="*" element={<Navigate to="/landing" replace />} />
        </Routes>
      </>
    )
  }

  if (!profile) {
    return (
      <>
        <Watermark />
        <Routes>
          <Route path="/complete-profile" element={<CompleteProfile />} />
          <Route path="*" element={<Navigate to="/complete-profile" replace />} />
        </Routes>
      </>
    )
  }

  if (profile.role === 'admin') {
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

  if (profile.role === 'dp') {
    return (
      <>
        <Watermark />
        <Routes>
          <Route path="/dp/*" element={<DpApp />} />
          <Route path="/complete-profile" element={<CompleteProfile />} />
          <Route path="*" element={<Navigate to="/dp" replace />} />
        </Routes>
      </>
    )
  }

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
