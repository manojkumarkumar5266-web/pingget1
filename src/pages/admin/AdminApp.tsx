import { Routes, Route, Navigate } from 'react-router-dom'
import AdminLayout from './AdminLayout'
import AdminDashboard from './AdminDashboard'
import AdminDps from './AdminDps'
import AdminCities from './AdminCities'
import AdminOrders from './AdminOrders'
import AdminPayments from './AdminPayments'
import AdminUsers from './AdminUsers'
import AdminNotifications from './AdminNotifications'
import AdminOperationsMap from './AdminOperationsMap'
import AdminCategories from './AdminCategories'

export default function AdminApp() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route path="/" element={<AdminDashboard />} />
        <Route path="/dps" element={<AdminDps />} />
        <Route path="/users" element={<AdminUsers />} />
        <Route path="/cities" element={<AdminCities />} />
        <Route path="/orders" element={<AdminOrders />} />
        <Route path="/payments" element={<AdminPayments />} />
        <Route path="/notifications" element={<AdminNotifications />} />
        <Route path="/categories" element={<AdminCategories />} />
      </Route>
      <Route path="/operations" element={<AdminOperationsMap />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}
