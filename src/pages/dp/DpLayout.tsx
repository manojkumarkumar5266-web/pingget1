import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context'
import { Home, ClipboardList, Wallet, User, LogOut, AlertTriangle, Bell } from 'lucide-react'
import { useEffect, useState, startTransition } from 'react'
import { supabase, DeliveryPartner } from '../../lib/supabase'
import { FullScreenLoader } from '../../components/ui'
import { formatCurrency } from '../../lib/utils'
import { useGps } from '../../hooks/useGps'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { BrandWordmark } from '../../components/Brand'
import { Dock, DockItem, CTA } from '../../design/primitives'
import { pg } from '../../design/tokens'
import { fetchDpCommissionBreakdown } from '../../lib/commission'

/** Completely rebuilt Partner shell */
export default function DpLayout() {
  const { profile, signOut } = useAuth()
  useGps(profile?.id, !!profile)
  usePushNotifications()
  const navigate = useNavigate()
  const location = useLocation()
  const [dp, setDp] = useState<DeliveryPartner | null>(null)
  const [dpLoaded, setDpLoaded] = useState(false)
  const [commissionDueNow, setCommissionDueNow] = useState(0)
  const [dueTomorrow, setDueTomorrow] = useState(0)
  const [submittedPending, setSubmittedPending] = useState(false)
  const [receiptRejected, setReceiptRejected] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

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
      const br = await fetchDpCommissionBreakdown(profile.id)
      setCommissionDueNow(br.dueNow)
      setDueTomorrow(br.dueTomorrow)
      const [submittedRes, rejectedRes] = await Promise.all([
        supabase.from('dp_commission_receipts').select('id').eq('dp_user_id', profile.id).eq('status', 'submitted').limit(1),
        supabase.from('dp_commission_receipts').select('id').eq('dp_user_id', profile.id).eq('status', 'rejected').order('submitted_at', { ascending: false }).limit(1),
      ])
      setSubmittedPending((submittedRes.data?.length ?? 0) > 0)
      setReceiptRejected((rejectedRes.data?.length ?? 0) > 0)
      if (br.dueNow > 0) {
        await supabase.from('delivery_partners').update({ is_online: false }).eq('user_id', profile.id)
      }
    }
    checkCommission()
    const channel = supabase.channel(`dp-commission-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dp_commission_receipts', filter: `dp_user_id=eq.${profile.id}` }, () => checkCommission())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [dpLoaded, profile])

  useEffect(() => {
    if (!profile) return
    const fetchUnread = async () => {
      const { count } = await supabase.from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id).eq('is_read', false).is('deleted_at', null)
      setUnreadCount(count || 0)
    }
    fetchUnread()
    const channel = supabase.channel(`dp-unread-${profile.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, fetchUnread)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, fetchUnread)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, fetchUnread)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile])

  if (!dpLoaded) return <FullScreenLoader />
  if (!dp) return <Blocked title="Setup incomplete" body="Your partner profile is being prepared. Contact admin." onSignOut={signOut} />
  if (dp.status === 'pending') return <Blocked title="Approval pending" body="An admin will review your partner account shortly." onSignOut={signOut} />
  if (dp.status === 'rejected' || dp.status === 'suspended' || dp.status === 'deleted') {
    return <Blocked title={`Account ${dp.status}`} body="Contact support for help with your partner account." onSignOut={signOut} />
  }

  const isActive = (path: string) => location.pathname === path
  const hideDock = location.pathname.startsWith('/dp/chat') || location.pathname.startsWith('/dp/navigate')
  const go = (path: string) => startTransition(() => navigate(path))

  const handleToggleOnline = async () => {
    if (!dp.is_online && commissionDueNow > 0) { go('/dp/wallet'); return }
    const newVal = !dp.is_online
    await supabase.from('delivery_partners').update({ is_online: newVal }).eq('id', dp.id)
    setDp({ ...dp, is_online: newVal })
  }

  return (
    <div className="relative flex h-[100dvh] flex-col" style={{ background: pg.bg }}>
      <div className="relative mx-auto flex h-full w-full max-w-lg flex-col">
      <header
        className="z-10 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))]"
        style={{ background: pg.header, borderBottom: `1px solid ${pg.headerBorder}`, boxShadow: '0 8px 24px rgba(12,138,62,0.12)' }}
      >
        <div className="flex items-center justify-between gap-3">
          <BrandWordmark size="xs" showTagline align="left" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleOnline}
              className="rounded-full px-3.5 py-2 text-xs font-extrabold active:scale-95"
              style={dp.is_online
                ? { background: pg.oliveDim, color: pg.olive, border: `1px solid rgba(143,174,62,0.4)` }
                : commissionDueNow > 0
                ? { background: 'rgba(245,165,36,0.16)', color: '#FCD34D', border: '1px solid rgba(245,165,36,0.35)' }
                : { background: pg.surface2, color: pg.text3, border: `1px solid ${pg.line}` }}
            >
              <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${dp.is_online ? 'animate-pulse' : 'bg-black/30'}`} style={dp.is_online ? { background: pg.olive } : undefined} />
              {dp.is_online ? 'Online' : commissionDueNow > 0 ? 'Pay due' : 'Go online'}
            </button>
            <button type="button" onClick={() => signOut()} className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: pg.surface2, color: pg.text3 }}>
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {(commissionDueNow > 0 || dueTomorrow > 0) && !dp.is_online && (
          <div className="mt-3 flex items-start gap-2 rounded-2xl px-3 py-2.5 text-xs" style={{ background: 'rgba(245,165,36,0.12)', color: '#FCD34D', border: '1px solid rgba(245,165,36,0.25)' }}>
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span className="leading-relaxed">
              {commissionDueNow > 0
                ? (receiptRejected
                  ? `Receipt rejected. Resubmit ${formatCurrency(commissionDueNow)} before going online.`
                  : submittedPending
                    ? `${formatCurrency(commissionDueNow)} submitted — waiting for admin.`
                    : `Commission due ${formatCurrency(commissionDueNow)}. Pay after 12 AM before accepting orders.`)
                : `Today’s commission ${formatCurrency(dueTomorrow)} is due after 12 AM.`}
              {commissionDueNow > 0 && !submittedPending && (
                <button type="button" onClick={() => go('/dp/wallet')} className="ml-1 font-extrabold underline">
                  {receiptRejected ? 'Resubmit' : 'Pay now'}
                </button>
              )}
            </span>
          </div>
        )}
      </header>

      <main className={`flex-1 overflow-y-auto ${hideDock ? '' : 'pb-28'}`}>
        <Outlet />
      </main>

      {!hideDock && (
        <Dock>
          <DockItem label="Requests" icon={<Home size={20} />} active={isActive('/dp')} onClick={() => go('/dp')} />
          <DockItem label="Orders" icon={<ClipboardList size={20} />} active={isActive('/dp/orders')} onClick={() => go('/dp/orders')} />
          <DockItem label="Alerts" icon={<Bell size={20} />} active={isActive('/dp/notifications')} badge={unreadCount} onClick={() => { setUnreadCount(0); go('/dp/notifications') }} />
          <DockItem label="Wallet" icon={<Wallet size={20} />} active={isActive('/dp/wallet')} onClick={() => go('/dp/wallet')} />
          <DockItem label="You" icon={<User size={20} />} active={isActive('/dp/profile')} onClick={() => go('/dp/profile')} />
        </Dock>
      )}
      </div>
    </div>
  )
}

function Blocked({ title, body, onSignOut }: { title: string; body: string; onSignOut: () => void }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center" style={{ background: pg.bg }}>
      <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.18em]" style={{ color: pg.lime }}>Partner</p>
      <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-xs text-sm" style={{ color: pg.text3 }}>{body}</p>
      <CTA variant="secondary" className="mt-6" onClick={onSignOut}>Sign out</CTA>
    </div>
  )
}
