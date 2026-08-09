import { Routes, Route, Navigate } from 'react-router-dom'
import AdminLayout from './AdminLayout'
import AdminDashboard from './AdminDashboard'
import AdminDps from './AdminDps'
import AdminCities from './AdminCities'
import AdminServiceWaitlist from './AdminServiceWaitlist'
import AdminOrders from './AdminOrders'
import AdminAdvanceRequests from './AdminAdvanceRequests'
import AdminAdvanceSettings from './AdminAdvanceSettings'
import AdminPayments from './AdminPayments'
import AdminUsers from './AdminUsers'
import AdminNotifications from './AdminNotifications'
import AdminOperationsMap from './AdminOperationsMap'

export default function AdminApp() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route path="/" element={<AdminDashboard />} />
        <Route path="/dps" element={<AdminDps />} />
        <Route path="/users" element={<AdminUsers />} />
        <Route path="/cities" element={<AdminCities />} />
        <Route path="/waitlist" element={<AdminServiceWaitlist />} />
        <Route path="/orders" element={<AdminOrders />} />
        <Route path="/advance-requests" element={<AdminAdvanceRequests />} />
        <Route path="/advance-settings" element={<AdminAdvanceSettings />} />
        <Route path="/payments" element={<AdminPayments />} />
        <Route path="/notifications" element={<AdminNotifications />} />
      </Route>
      <Route path="/operations" element={<AdminOperationsMap />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}
