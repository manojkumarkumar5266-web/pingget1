import { lazy, Suspense, type ReactNode } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import UserLayout from './UserLayout'
import { FullScreenLoader } from '../../components/ui'

const UserHome = lazy(() => import('./UserHome'))
const CreateRequest = lazy(() => import('./CreateRequest'))
const CreateAdvanceRequest = lazy(() => import('./CreateAdvanceRequest'))
const ScanningPage = lazy(() => import('./ScanningPage'))
const LiveTrackingPage = lazy(() => import('./LiveTrackingPage'))
const UserOrders = lazy(() => import('./UserOrders'))
const ChatScreen = lazy(() => import('../shared/ChatScreen'))
const FullOrderDetails = lazy(() => import('../shared/FullOrderDetails'))
const UserProfile = lazy(() => import('./UserProfile'))
const UserNotifications = lazy(() => import('./UserNotifications'))
const OfferDetailPage = lazy(() => import('../shared/OfferDetailPage'))

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<FullScreenLoader />}>{children}</Suspense>
}

export default function UserApp() {
  return (
    <Routes>
      <Route element={<UserLayout />}>
        <Route path="/" element={<Lazy><UserHome /></Lazy>} />
        <Route path="/create" element={<Lazy><CreateRequest /></Lazy>} />
        <Route path="/create-advance" element={<Lazy><CreateAdvanceRequest /></Lazy>} />
        <Route path="/scanning/:requestId" element={<Lazy><ScanningPage /></Lazy>} />
        <Route path="/track/:requestId" element={<Lazy><LiveTrackingPage /></Lazy>} />
        <Route path="/orders" element={<Lazy><UserOrders /></Lazy>} />
        <Route path="/notifications" element={<Lazy><UserNotifications /></Lazy>} />
        <Route path="/offers/:offerId" element={<Lazy><OfferDetailPage basePath="/app" /></Lazy>} />
        <Route path="/profile" element={<Lazy><UserProfile /></Lazy>} />
      </Route>
      <Route path="/chat/:roomId" element={<Lazy><ChatScreen /></Lazy>} />
      <Route path="/chat/:roomId/order" element={<Lazy><FullOrderDetails /></Lazy>} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}
