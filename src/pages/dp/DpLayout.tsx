import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context'
import { Chrome as Home, ClipboardList, Wallet, User, LogOut, TriangleAlert as AlertTriangle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase, DeliveryPartner } from '../../lib/supabase'
import { FullScreenLoader } from '../../components/ui'
import { formatCurrency } from '../../lib/utils'
import Brand from '../../components/Brand'
import Watermark from '../../components/Watermark'
import { useGps } from '../../hooks/useGps'
import { usePushNotifications } from '../../hooks/usePushNotifications'

export default function DpLayout() {
  const { profile, signOut } = useAuth()
  useGps(profile?.id, !!profile)
  usePushNotifications()
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
    const channel = supabase.channel(`dp-layout-${profile!.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_partners', filter: `user_id=eq.${profile!.id}` },
        (payload: any) => { if (payload.new) setDp(payload.new as DeliveryPartner) })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
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
    const channel = supabase.channel(`dp-commission-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dp_commission_receipts', filter: `dp_user_id=eq.${profile.id}` }, () => checkCommission())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [dpLoaded, profile])

  if (!dpLoaded) return <FullScreenLoader />
  if (!dp) return <DpSetupNeeded />
  if (dp.status === 'pending') return <DpPendingApproval />
  if (dp.status === 'rejected' || dp.status === 'suspended' || dp.status === 'deleted') return <DpBlocked status={dp.status} />

  const navItems = [
    { path: '/dp',          label: 'Requests', icon: Home },
    { path: '/dp/orders',   label: 'Orders',   icon: ClipboardList },
    { path: '/dp/wallet',   label: 'Wallet',   icon: Wallet },
    { path: '/dp/profile',  label: 'Profile',  icon: User },
  ]
  const isActive = (path: string) => location.pathname === path

  const handleToggleOnline = async () => {
    if (!dp) return
    if (!dp.is_online && commissionOwed > 0) { navigate('/dp/wallet'); return }
    const newVal = !dp.is_online
    await supabase.from('delivery_partners').update({ is_online: newVal }).eq('id', dp.id)
    setDp({ ...dp, is_online: newVal })
  }

  const isOnChat = location.pathname.startsWith('/dp/chat')
  const isOnNav = location.pathname.startsWith('/dp/navigate')

  return (
    <div className="relative flex h-screen flex-col bg-[#0B0B0B]">
      <Watermark />

      {/* Premium Header */}
      <header className="z-10 px-4 py-3" style={{ background: 'rgba(11,11,11,0.9)', borderBottom: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)' }}>
        <div className="flex items-center justify-between">
          <Brand size="sm" showTagline={false} />
          <div className="flex items-center gap-2">
            <button onClick={handleToggleOnline}
              title={commissionOwed > 0 ? `Pay ${formatCurrency(commissionOwed)} commission to go online` : undefined}
              className="flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold transition-all active:scale-95"
              style={dp.is_online
                ? { background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.35)', color: '#34d399' }
                : commissionOwed > 0
                ? { background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.35)', color: '#fbbf24' }
                : { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)' }}>
              <span className={`h-2 w-2 rounded-full ${dp.is_online ? 'bg-green-400 animate-pulse' : commissionOwed > 0 ? 'bg-yellow-400' : 'bg-white/30'}`} />
              {dp.is_online ? 'Online' : commissionOwed > 0 ? 'Pay Due' : 'Go Online'}
            </button>
            <button onClick={() => signOut()} className="flex h-9 w-9 items-center justify-center rounded-full transition-colors active:scale-90"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)' }}>
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {commissionOwed > 0 && !dp.is_online && (
          <div className="mt-2.5 flex items-start gap-2.5 rounded-2xl px-3.5 py-2.5 text-xs"
            style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)', color: '#fcd34d' }}>
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span className="leading-relaxed">
              {receiptRejected
                ? `Payment receipt rejected. Resubmit for ${formatCurrency(commissionOwed)} to go online.`
                : submittedPending
                ? `Payment of ${formatCurrency(commissionOwed)} submitted — waiting for admin.`
                : `You owe ${formatCurrency(commissionOwed)} commission. Pay via UPI to go online.`}
              {!submittedPending && (
                <button onClick={() => navigate('/dp/wallet')} className="ml-1.5 underline font-bold">
                  {receiptRejected ? 'Resubmit' : 'Pay now'}
                </button>
              )}
            </span>
          </div>
        )}
      </header>

      <main className={`flex-1 overflow-y-auto ${!isOnChat && !isOnNav ? 'pb-24' : ''}`}>
        <Outlet />
      </main>

      {/* Floating Bottom Navigation */}
      {!isOnChat && !isOnNav && (
        <nav className="fixed bottom-4 left-0 right-0 z-20 flex justify-center px-4">
          <div className="flex w-full max-w-xs items-center justify-around rounded-[28px] px-2 py-2 nav-island">
            {navItems.map(item => {
              const Icon = item.icon
              const active = isActive(item.path)
              return (
                <button key={item.path} onClick={() => navigate(item.path)}
                  className="relative flex flex-1 flex-col items-center gap-0.5 py-2 transition-all"
                  style={{ color: active ? '#A6B300' : 'rgba(255,255,255,0.4)' }}>
                  <Icon size={22} />
                  <span className="text-[10px] font-semibold">{item.label}</span>
                  {active && <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full" style={{ background: '#A6B300' }} />}
                </button>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}

function DpSetupNeeded() {
  const { signOut } = useAuth()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center bg-[#0B0B0B]">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl animate-bounce-in" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <span className="text-4xl">🛠️</span>
      </div>
      <h1 className="text-xl font-bold text-white">Setup Incomplete</h1>
      <p className="mt-2 max-w-xs text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Your delivery partner profile is being set up. Please contact admin.</p>
      <button onClick={() => signOut()} className="btn-secondary mt-6">Sign Out</button>
    </div>
  )
}

function DpPendingApproval() {
  const { signOut } = useAuth()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center bg-[#0B0B0B]">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl animate-float" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
        <span className="text-4xl">⏳</span>
      </div>
      <h1 className="text-xl font-bold text-white">Approval Pending</h1>
      <p className="mt-2 max-w-xs text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Your delivery partner account is under review. An admin will approve it shortly.</p>
      <button onClick={() => signOut()} className="btn-secondary mt-6">Sign Out</button>
    </div>
  )
}

function DpBlocked({ status }: { status: string }) {
  const { signOut } = useAuth()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center bg-[#0B0B0B]">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl animate-bounce-in" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
        <span className="text-4xl">🚫</span>
      </div>
      <h1 className="text-xl font-bold text-white">Account {status === 'suspended' ? 'Suspended' : 'Rejected'}</h1>
      <p className="mt-2 max-w-xs text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
        {status === 'suspended' ? 'Your account has been temporarily suspended. Contact support.' : 'Your application was not approved. Contact support.'}
      </p>
      <button onClick={() => signOut()} className="btn-secondary mt-6">Sign Out</button>
    </div>
  )
}
