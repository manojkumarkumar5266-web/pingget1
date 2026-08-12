import { lazy, Suspense, type ReactNode } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import DpLayout from './DpLayout'
import { FullScreenLoader } from '../../components/ui'

const DpHome = lazy(() => import('./DpHome'))
const DpOrders = lazy(() => import('./DpOrders'))
const ChatScreen = lazy(() => import('../shared/ChatScreen'))
const FullOrderDetails = lazy(() => import('../shared/FullOrderDetails'))
const DpWallet = lazy(() => import('./DpWallet'))
const DpProfile = lazy(() => import('./DpProfile'))
const DpNavigationPage = lazy(() => import('./DpNavigationPage'))
const DpNotifications = lazy(() => import('./DpNotifications'))
const OfferDetailPage = lazy(() => import('../shared/OfferDetailPage'))

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<FullScreenLoader />}>{children}</Suspense>
}

/**
 * Partner app routes — absolute /dp/* paths (no splat descendant matching).
 * Avoids blank screens when nested under /dp/* splat parents.
 */
export default function DpApp() {
  return (
    <Routes>
      <Route path="/dp" element={<DpLayout />}>
        <Route index element={<Lazy><DpHome /></Lazy>} />
        <Route path="orders" element={<Lazy><DpOrders /></Lazy>} />
        <Route path="wallet" element={<Lazy><DpWallet /></Lazy>} />
        <Route path="profile" element={<Lazy><DpProfile /></Lazy>} />
        <Route path="notifications" element={<Lazy><DpNotifications /></Lazy>} />
        <Route path="offers/:offerId" element={<Lazy><OfferDetailPage basePath="/dp" /></Lazy>} />
      </Route>
      <Route path="/dp/chat/:roomId" element={<Lazy><ChatScreen /></Lazy>} />
      <Route path="/dp/chat/:roomId/order" element={<Lazy><FullOrderDetails /></Lazy>} />
      <Route path="/dp/navigate/:requestId" element={<Lazy><DpNavigationPage /></Lazy>} />
      <Route path="*" element={<Navigate to="/dp" replace />} />
    </Routes>
  )
}
