import { Routes, Route, Navigate } from 'react-router-dom'
import UserLayout from './UserLayout'
import UserHome from './UserHome'
import CreateRequest from './CreateRequest'
import UserOrders from './UserOrders'
import ChatScreen from '../shared/ChatScreen'
import UserProfile from './UserProfile'
import UserNotifications from './UserNotifications'

export default function UserApp() {
  return (
    <Routes>
      <Route element={<UserLayout />}>
        <Route path="/" element={<UserHome />} />
        <Route path="/create" element={<CreateRequest />} />
        <Route path="/orders" element={<UserOrders />} />
        <Route path="/notifications" element={<UserNotifications />} />
        <Route path="/profile" element={<UserProfile />} />
      </Route>
      <Route path="/chat/:roomId" element={<ChatScreen />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}
