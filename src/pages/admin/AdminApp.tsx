import { lazy, Suspense, type ReactNode } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AdminLayout from './AdminLayout'
import { FullScreenLoader } from '../../components/ui'

const AdminDashboard = lazy(() => import('./AdminDashboard'))
const AdminDps = lazy(() => import('./AdminDps'))
const AdminCities = lazy(() => import('./AdminCities'))
const AdminServiceWaitlist = lazy(() => import('./AdminServiceWaitlist'))
const AdminOrders = lazy(() => import('./AdminOrders'))
const AdminAdvanceRequests = lazy(() => import('./AdminAdvanceRequests'))
const AdminAdvanceSettings = lazy(() => import('./AdminAdvanceSettings'))
const AdminPayments = lazy(() => import('./AdminPayments'))
const AdminUsers = lazy(() => import('./AdminUsers'))
const AdminNotifications = lazy(() => import('./AdminNotifications'))
const AdminOperationsMap = lazy(() => import('./AdminOperationsMap'))

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<FullScreenLoader />}>{children}</Suspense>
}

export default function AdminApp() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route path="/" element={<Lazy><AdminDashboard /></Lazy>} />
        <Route path="/dps" element={<Lazy><AdminDps /></Lazy>} />
        <Route path="/users" element={<Lazy><AdminUsers /></Lazy>} />
        <Route path="/cities" element={<Lazy><AdminCities /></Lazy>} />
        <Route path="/waitlist" element={<Lazy><AdminServiceWaitlist /></Lazy>} />
        <Route path="/orders" element={<Lazy><AdminOrders /></Lazy>} />
        <Route path="/advance-requests" element={<Lazy><AdminAdvanceRequests /></Lazy>} />
        <Route path="/advance-settings" element={<Lazy><AdminAdvanceSettings /></Lazy>} />
        <Route path="/payments" element={<Lazy><AdminPayments /></Lazy>} />
        <Route path="/notifications" element={<Lazy><AdminNotifications /></Lazy>} />
      </Route>
      <Route path="/operations" element={<Lazy><AdminOperationsMap /></Lazy>} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}
