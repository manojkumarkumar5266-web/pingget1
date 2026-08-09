import { Routes, Route, Navigate } from 'react-router-dom'
import DpLayout from './DpLayout'
import DpHome from './DpHome'
import DpOrders from './DpOrders'
import ChatScreen from '../shared/ChatScreen'
import FullOrderDetails from '../shared/FullOrderDetails'
import DpWallet from './DpWallet'
import DpProfile from './DpProfile'
import DpNavigationPage from './DpNavigationPage'
import DpNotifications from './DpNotifications'
import OfferDetailPage from '../shared/OfferDetailPage'

/**
 * Partner app routes — absolute /dp/* paths (no splat descendant matching).
 * Avoids blank screens when nested under /dp/* splat parents.
 */
export default function DpApp() {
  return (
    <Routes>
      <Route path="/dp" element={<DpLayout />}>
        <Route index element={<DpHome />} />
        <Route path="orders" element={<DpOrders />} />
        <Route path="wallet" element={<DpWallet />} />
        <Route path="profile" element={<DpProfile />} />
        <Route path="notifications" element={<DpNotifications />} />
        <Route path="offers/:offerId" element={<OfferDetailPage basePath="/dp" />} />
      </Route>
      <Route path="/dp/chat/:roomId" element={<ChatScreen />} />
      <Route path="/dp/chat/:roomId/order" element={<FullOrderDetails />} />
      <Route path="/dp/navigate/:requestId" element={<DpNavigationPage />} />
      <Route path="*" element={<Navigate to="/dp" replace />} />
    </Routes>
  )
}
