import { Routes, Route, Navigate } from 'react-router-dom'
import AdminLayout from './AdminLayout'
import AdminDashboard from './AdminDashboard'
import AdminDps from './AdminDps'
import AdminCities from './AdminCities'
import AdminOrders from './AdminOrders'
import AdminPayments from './AdminPayments'
import AdminUsers from './AdminUsers'

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
      </Route>
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}
