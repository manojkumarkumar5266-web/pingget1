import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from './context'
import { FullScreenLoader } from './components/ui'
import AuthScreen from './pages/AuthScreen'
import ResetPassword from './pages/ResetPassword'
import UserApp from './pages/user/UserApp'
import DpApp from './pages/dp/DpApp'
import AdminApp from './pages/admin/AdminApp'
import SetupAdmin from './pages/SetupAdmin'
import LandingPage from './pages/LandingPage'
import Welcome from './components/Welcome'
import PermissionOnboarding from './components/PermissionOnboarding'
import Watermark from './components/Watermark'
import { Clock, XCircle, ArrowLeft } from 'lucide-react'

const ONBOARDING_KEY = 'pingget_permissions_done'
const WELCOME_KEY = 'pingget_welcomed'

function DpPendingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center animate-fade-in">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl glass animate-bounce-in">
        <Clock size={48} className="text-yellow-400" />
      </div>
      <h1 className="mb-2 text-2xl font-bold text-white">Awaiting Approval</h1>
      <p className="mb-6 max-w-sm text-sm text-white/60">
        Your delivery partner application is under review. You will be notified once an admin approves it.
      </p>
      <a href="/auth" className="btn-primary inline-flex items-center gap-2">
        <ArrowLeft size={16} /> Back to Sign In
      </a>
    </div>
  )
}

function DpRejectedScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center animate-fade-in">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl glass animate-bounce-in">
        <XCircle size={48} className="text-red-400" />
      </div>
      <h1 className="mb-2 text-2xl font-bold text-white">Application Not Approved</h1>
      <p className="mb-6 max-w-sm text-sm text-white/60">
        Your delivery partner application was not approved. Please contact support for more details.
      </p>
      <a href="/auth" className="btn-primary inline-flex items-center gap-2">
        <ArrowLeft size={16} /> Back to Sign In
      </a>
    </div>
  )
}

export default function App() {
  const { session, profile, loading, passwordRecovery, signOut } = useAuth()
  const location = useLocation()
  const [showWelcome, setShowWelcome] = useState(() => !sessionStorage.getItem(WELCOME_KEY))
  const [showPermissions, setShowPermissions] = useState(() => {
    if (typeof window === 'undefined') return false
    return !localStorage.getItem(ONBOARDING_KEY) && !sessionStorage.getItem(WELCOME_KEY)
  })

  // Handle missing profile in useEffect — never during render
  useEffect(() => {
    if (!loading && session && !profile) {
      console.warn('[Auth] Profile missing after loading completed — signing out')
      signOut()
    }
  }, [loading, session, profile, signOut])

  if (showWelcome) return <Welcome onDone={() => { sessionStorage.setItem(WELCOME_KEY, '1'); setShowWelcome(false) }} />
  if (showPermissions) return <PermissionOnboarding onComplete={() => { localStorage.setItem(ONBOARDING_KEY, '1'); setShowPermissions(false) }} />

  const isPublicRoute = ['/setup-admin', '/reset-password', '/landing'].includes(location.pathname)

  if (isPublicRoute && !session) {
    return (
      <>
        <Watermark />
        <Routes>
          <Route path="/setup-admin" element={<SetupAdmin />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="*" element={<Navigate to="/landing" replace />} />
        </Routes>
      </>
    )
  }

  if (loading) return <FullScreenLoader />

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

  // Signed in but profile still loading
  if (!profile) return <FullScreenLoader />

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

  // User role
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
