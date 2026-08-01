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

export default function DpApp() {
  return (
    <Routes>
      <Route element={<DpLayout />}>
        <Route path="/" element={<DpHome />} />
        <Route path="/orders" element={<DpOrders />} />
        <Route path="/wallet" element={<DpWallet />} />
        <Route path="/profile" element={<DpProfile />} />
        <Route path="/notifications" element={<DpNotifications />} />
      </Route>
      <Route path="/chat/:roomId" element={<ChatScreen />} />
      <Route path="/chat/:roomId/order" element={<FullOrderDetails />} />
      <Route path="/navigate/:requestId" element={<DpNavigationPage />} />
      <Route path="*" element={<Navigate to="/dp" replace />} />
    </Routes>
  )
}
