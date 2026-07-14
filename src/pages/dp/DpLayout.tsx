import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context'
import { Chrome as Home, ClipboardList, Wallet, User, LogOut, TriangleAlert as AlertTriangle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase, DeliveryPartner } from '../../lib/supabase'
import { FullScreenLoader } from '../../components/ui'
import { formatCurrency } from '../../lib/utils'
import Brand from '../../components/Brand'
import Watermark from '../../components/Watermark'

export default function DpLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [dp, setDp] = useState<DeliveryPartner | null>(null)
  const [dpLoaded, setDpLoaded] = useState(false)
  const [commissionOwed, setCommissionOwed] = useState(0)
  const [submittedPending, setSubmittedPending] = useState(false)
  const [receiptRejected, setReceiptRejected] = useState(false)

  useEffect(() => {
    const fetchDp = async () => {
      const { data } = await supabase
        .from('delivery_partners')
        .select('*')
        .eq('user_id', profile!.id)
        .maybeSingle()
      setDp(data as DeliveryPartner | null)
      setDpLoaded(true)
    }
    fetchDp()
  }, [profile])

  // After dp loads, calculate outstanding commission from completed orders vs confirmed receipts
  useEffect(() => {
    if (!dpLoaded || !profile) return
    const checkCommission = async () => {
      const [ordersRes, confirmedRes, submittedRes, rejectedRes] = await Promise.all([
        supabase.from('orders').select('commission_amount').eq('dp_id', profile.id).eq('status', 'completed'),
        supabase.from('dp_commission_receipts').select('amount').eq('dp_user_id', profile.id).eq('status', 'confirmed'),
        supabase.from('dp_commission_receipts').select('id').eq('dp_user_id', profile.id).eq('status', 'submitted').limit(1),
        supabase.from('dp_commission_receipts').select('id').eq('dp_user_id', profile.id).eq('status', 'rejected').order('submitted_at', { ascending: false }).limit(1),
      ])
      const totalOwed = (ordersRes.data || []).reduce((s: number, o: any) => s + Number(o.commission_amount || 0), 0)
      const totalPaid = (confirmedRes.data || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0)
      setCommissionOwed(Math.max(0, totalOwed - totalPaid))
      setSubmittedPending((submittedRes.data?.length ?? 0) > 0)
      setReceiptRejected((rejectedRes.data?.length ?? 0) > 0 && (submittedRes.data?.length ?? 0) === 0)
    }
    checkCommission()
  }, [dpLoaded, profile])

  if (!dpLoaded) return <FullScreenLoader />
  if (!dp || dp.status === 'pending') return <DpPendingApproval />
  if (dp.status === 'rejected' || dp.status === 'suspended') return <DpBlocked status={dp.status} />

  const navItems = [
    { path: '/dp', label: 'Requests', icon: Home },
    { path: '/dp/orders', label: 'Orders', icon: ClipboardList },
    { path: '/dp/wallet', label: 'Wallet', icon: Wallet },
    { path: '/dp/profile', label: 'Profile', icon: User },
  ]
  const isActive = (path: string) => location.pathname === path

  const handleToggleOnline = async () => {
    if (!dp) return
    // Commission gate: block going online when commission is owed and not yet confirmed
    if (!dp.is_online && commissionOwed > 0) {
      navigate('/dp/wallet')
      return
    }
    const newVal = !dp.is_online
    await supabase.from('delivery_partners').update({ is_online: newVal }).eq('id', dp.id)
    setDp({ ...dp, is_online: newVal })
  }

  return (
    <div className="relative flex h-screen flex-col bg-gray-50/95 dark:bg-gray-950/95">
      <Watermark />
      <header className="border-b border-gray-100 px-4 py-3 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brand size="sm" showTagline={false} />
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleToggleOnline}
              title={commissionOwed > 0 ? `Pay ₹${commissionOwed} commission to go online` : undefined}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                dp.is_online
                  ? 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300'
                  : commissionOwed > 0
                    ? 'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${
                dp.is_online ? 'bg-success-500 animate-pulse-soft' : commissionOwed > 0 ? 'bg-warning-500' : 'bg-gray-400'
              }`} />
              {dp.is_online ? 'Online' : commissionOwed > 0 ? 'Pay Due' : 'Offline'}
            </button>
            <button onClick={() => signOut()} className="p-2 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Commission warning banner */}
        {commissionOwed > 0 && !dp.is_online && (
          <div className="mt-2 flex items-start gap-2 rounded-xl bg-warning-50 px-3 py-2 text-xs text-warning-800 dark:bg-warning-900/30 dark:text-warning-300">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              {receiptRejected
                ? `Your payment receipt was rejected. Resubmit a valid receipt for ${formatCurrency(commissionOwed)} to go online.`
                : submittedPending
                ? `Payment of ${formatCurrency(commissionOwed)} submitted — waiting for admin to confirm.`
                : `You owe ${formatCurrency(commissionOwed)} commission. Pay admin via UPI to go online.`}
              {!submittedPending && (
                <button onClick={() => navigate('/dp/wallet')} className="ml-1 underline font-semibold">
                  {receiptRejected ? 'Resubmit' : 'Pay now'}
                </button>
              )}
            </span>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-10 border-t border-gray-100 bg-white/90 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/90">
        <div className="mx-auto flex max-w-md items-center justify-around px-2 py-2">
          {navItems.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors ${isActive(item.path) ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`}
              >
                <Icon size={22} />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

function DpPendingApproval() {
  const { signOut } = useAuth()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6 text-center dark:bg-gray-950">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-accent-100 dark:bg-accent-900/40">
        <span className="text-4xl">⏳</span>
      </div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">Approval Pending</h1>
      <p className="mt-2 max-w-xs text-sm text-gray-500 dark:text-gray-400">
        Your delivery partner account is under review. An admin will approve it shortly.
      </p>
      <button onClick={() => signOut()} className="btn-secondary mt-6">Sign Out</button>
    </div>
  )
}

function DpBlocked({ status }: { status: string }) {
  const { signOut } = useAuth()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6 text-center dark:bg-gray-950">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-error-100 dark:bg-error-900/40">
        <span className="text-4xl">🚫</span>
      </div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">Account {status === 'suspended' ? 'Suspended' : 'Rejected'}</h1>
      <p className="mt-2 max-w-xs text-sm text-gray-500 dark:text-gray-400">
        {status === 'suspended'
          ? 'Your account has been temporarily suspended. Contact support.'
          : 'Your delivery partner application was not approved. Contact support.'}
      </p>
      <button onClick={() => signOut()} className="btn-secondary mt-6">Sign Out</button>
    </div>
  )
}
