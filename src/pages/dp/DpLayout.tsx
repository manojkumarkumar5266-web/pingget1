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
      const { data } = await supabase.from('delivery_partners').select('*').eq('user_id', profile!.id).maybeSingle()
      setDp(data as DeliveryPartner | null)
      setDpLoaded(true)
    }
    fetchDp()
  }, [profile])

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
      setReceiptRejected((rejectedRes.data?.length ?? 0) > 0)
    }
    checkCommission()
  }, [dpLoaded, profile])

  if (!dpLoaded) return <FullScreenLoader />
  if (!dp) return <DpSetupNeeded />
  if (dp.status === 'pending') return <DpPendingApproval />
  if (dp.status === 'rejected' || dp.status === 'suspended' || dp.status === 'deleted') return <DpBlocked status={dp.status} />

  const navItems = [
    { path: '/dp', label: 'Requests', icon: Home },
    { path: '/dp/orders', label: 'Orders', icon: ClipboardList },
    { path: '/dp/wallet', label: 'Wallet', icon: Wallet },
    { path: '/dp/profile', label: 'Profile', icon: User },
  ]
  const isActive = (path: string) => location.pathname === path

  const handleToggleOnline = async () => {
    if (!dp) return
    if (!dp.is_online && commissionOwed > 0) { navigate('/dp/wallet'); return }
    const newVal = !dp.is_online
    await supabase.from('delivery_partners').update({ is_online: newVal }).eq('id', dp.id)
    setDp({ ...dp, is_online: newVal })
  }

  return (
    <div className="relative flex h-screen flex-col">
      <Watermark />
      {/* Header */}
      <header className="glass z-10 px-4 py-3">
        <div className="flex items-center justify-between">
          <Brand size="sm" showTagline={false} />
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleOnline}
              title={commissionOwed > 0 ? `Pay ${formatCurrency(commissionOwed)} commission to go online` : undefined}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                dp.is_online ? 'text-green-300' : commissionOwed > 0 ? 'text-yellow-300' : 'text-white/60'
              }`}
              style={{
                background: dp.is_online
                  ? 'rgba(16,185,129,0.2)'
                  : commissionOwed > 0
                  ? 'rgba(245,158,11,0.2)'
                  : 'rgba(255,255,255,0.1)',
                border: `1px solid ${dp.is_online ? 'rgba(16,185,129,0.3)' : commissionOwed > 0 ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.1)'}`,
              }}
            >
              <span className={`h-2 w-2 rounded-full ${dp.is_online ? 'bg-green-400 animate-pulse' : commissionOwed > 0 ? 'bg-yellow-400' : 'bg-white/40'}`} />
              {dp.is_online ? 'Online' : commissionOwed > 0 ? 'Pay Due' : 'Offline'}
            </button>
            <button onClick={() => signOut()} className="p-2 transition-colors" style={{ color: 'rgba(255,255,255,0.5)' }}>
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {commissionOwed > 0 && !dp.is_online && (
          <div className="mt-2 flex items-start gap-2 rounded-xl px-3 py-2 text-xs"
            style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.25)', color: '#fcd34d' }}>
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              {receiptRejected
                ? `Your payment receipt was rejected. Resubmit for ${formatCurrency(commissionOwed)} to go online.`
                : submittedPending
                ? `Payment of ${formatCurrency(commissionOwed)} submitted — waiting for admin confirmation.`
                : `You owe ${formatCurrency(commissionOwed)} commission. Pay via UPI to go online.`}
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

      <nav className="fixed bottom-0 left-0 right-0 z-10 glass">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors ${isActive(item.path) ? 'text-primary-300' : ''}`}
                style={!isActive(item.path) ? { color: 'rgba(255,255,255,0.4)' } : undefined}
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

function DpSetupNeeded() {
  const { signOut } = useAuth()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full glass">
        <span className="text-4xl">&#x1F6E0;</span>
      </div>
      <h1 className="text-xl font-bold text-white">Setup Incomplete</h1>
      <p className="mt-2 max-w-xs text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
        Your delivery partner profile is being set up. Please contact admin.
      </p>
      <button onClick={() => signOut()} className="btn-secondary mt-6">Sign Out</button>
    </div>
  )
}

function DpPendingApproval() {
  const { signOut } = useAuth()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full glass">
        <span className="text-4xl">&#x23F3;</span>
      </div>
      <h1 className="text-xl font-bold text-white">Approval Pending</h1>
      <p className="mt-2 max-w-xs text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
        Your delivery partner account is under review. An admin will approve it shortly.
      </p>
      <button onClick={() => signOut()} className="btn-secondary mt-6">Sign Out</button>
    </div>
  )
}

function DpBlocked({ status }: { status: string }) {
  const { signOut } = useAuth()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full glass">
        <span className="text-4xl">&#x1F6AB;</span>
      </div>
      <h1 className="text-xl font-bold text-white">Account {status === 'suspended' ? 'Suspended' : 'Rejected'}</h1>
      <p className="mt-2 max-w-xs text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
        {status === 'suspended'
          ? 'Your account has been temporarily suspended. Contact support.'
          : 'Your delivery partner application was not approved. Contact support.'}
      </p>
      <button onClick={() => signOut()} className="btn-secondary mt-6">Sign Out</button>
    </div>
  )
}
