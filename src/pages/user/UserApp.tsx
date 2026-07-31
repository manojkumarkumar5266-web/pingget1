import { Routes, Route, Navigate } from 'react-router-dom'
import UserLayout from './UserLayout'
import UserHome from './UserHome'
import CreateRequest from './CreateRequest'
import ScanningPage from './ScanningPage'
import LiveTrackingPage from './LiveTrackingPage'
import UserOrders from './UserOrders'
import ChatScreen from '../shared/ChatScreen'
import FullOrderDetails from '../shared/FullOrderDetails'
import UserProfile from './UserProfile'
import UserNotifications from './UserNotifications'

export default function UserApp() {
  return (
    <Routes>
      <Route element={<UserLayout />}>
        <Route path="/" element={<UserHome />} />
        <Route path="/create" element={<CreateRequest />} />
        <Route path="/scanning/:requestId" element={<ScanningPage />} />
        <Route path="/track/:requestId" element={<LiveTrackingPage />} />
        <Route path="/orders" element={<UserOrders />} />
        <Route path="/notifications" element={<UserNotifications />} />
        <Route path="/profile" element={<UserProfile />} />
      </Route>
      <Route path="/chat/:roomId" element={<ChatScreen />} />
      <Route path="/chat/:roomId/order" element={<FullOrderDetails />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}
