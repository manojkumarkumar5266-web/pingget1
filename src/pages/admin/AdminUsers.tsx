import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../../context'
import { supabase, Profile } from '../../lib/supabase'
import { kickPushDelivery } from '../../lib/notify'
import { Avatar, EmptyState, SkeletonCard } from '../../components/ui'
import { formatTime } from '../../lib/utils'
import { Users, ShieldOff, Ban, CheckCircle, AlertTriangle, Download, Search, MapPin, LogIn } from 'lucide-react'
import * as XLSX from 'xlsx'
import { AdminShell, AdminHeader, FilterPills, AdminSearch, StatusPill, DrawerShell, ActionBtn, InfoPanel } from './adminChrome'
import { pg } from '../../design/tokens'

type StatusFilter = 'all' | 'active' | 'suspended' | 'banned'

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  active:    { label: 'Active',    badge: 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300' },
  pending:   { label: 'Pending',   badge: 'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-300' },
  rejected:  { label: 'Rejected',  badge: 'bg-error-100 text-error-700 dark:bg-error-900/40 dark:text-error-300' },
  suspended: { label: 'Suspended', badge: 'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-300' },
  banned:    { label: 'Banned',    badge: 'bg-error-100 text-error-700 dark:bg-error-900/40 dark:text-error-300' },
}

export default function AdminUsers() {
  const { profile: adminProfile } = useAuth()
  const [impersonating, setImpersonating] = useState(false)
  const [users, setUsers] = useState<Profile[]>([])
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [selected, setSelected] = useState<Profile | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('profiles').select('*').eq('role', 'user')
    if (filter !== 'all') query = query.eq('status', filter)
    const { data } = await query.order('created_at', { ascending: false })
    setUsers((data as Profile[]) || [])
    setLoading(false)
  }, [filter])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  // Realtime: listen for profile status changes (new users, suspensions, etc.)
  useEffect(() => {
    const channel = supabase.channel('admin-users-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchUsers())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchUsers])

  const updateStatus = async (user: Profile, newStatus: 'active' | 'suspended' | 'banned') => {
    setUpdating(user.id)
    const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', user.id)
    if (!error) {
      await supabase.from('admin_logs').insert({
        admin_id: adminProfile!.id,
        action: `user_${newStatus}`,
        target_id: user.id,
        details: `User ${user.full_name} (${user.role}) -> ${newStatus}`,
      })

      const notifMessages: Record<string, { title: string; body: string }> = {
        suspended: { title: 'Account Suspended', body: 'Your account has been suspended. Please contact support for details.' },
        banned:    { title: 'Account Banned',    body: 'Your account has been permanently banned due to policy violations.' },
        active:    { title: 'Account Reinstated', body: 'Your account has been reinstated and is now active.' },
      }
      if (notifMessages[newStatus]) {
        await supabase.from('notifications').insert({
          user_id: user.id,
          title: notifMessages[newStatus].title,
          body: notifMessages[newStatus].body,
          type: 'account_status',
        })
        kickPushDelivery()
      }
      setSelected(null)
      fetchUsers()
    }
    setUpdating(null)
  }

  const filtered = users.filter(u =>
    !search ||
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.phone?.includes(search) ||
    u.city?.toLowerCase().includes(search.toLowerCase())
  )

  const exportUsers = () => {
    const rows = filtered.map(u => ({
      Name: u.full_name || '',
      Phone: u.phone || '',
      Role: u.role,
      City: u.city || '',
      Status: u.status,
      GPS: u.gps_lat && u.gps_lng ? `${u.gps_lat},${u.gps_lng}` : 'N/A',
      'Joined On': formatTime(u.created_at),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Users')
    XLSX.writeFile(wb, `users-${filter}.xlsx`)
  }

  const filters: StatusFilter[] = ['all', 'active', 'suspended', 'banned']

  return (
    <AdminShell>
      <AdminHeader title="Users" action={
        <button onClick={exportUsers} className="btn-secondary shrink-0 text-sm">
          <Download size={16} /> Export
        </button>
      } />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterPills options={filters} value={filter} onChange={setFilter} />
      </div>

      <div className="mb-4">
        <AdminSearch value={search} onChange={setSearch} placeholder="Search by name, phone, or city..." />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <SkeletonCard key={i} lines={3} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Users size={48} />} title={`No ${filter} users`} />
      ) : (
        <div className="space-y-2">
          {filtered.map(u => (
              <div
                key={u.id}
                onClick={() => setSelected(u)}
                className="card cursor-pointer p-4 transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <Avatar url={u.photo_url} name={u.full_name || 'User'} size={44} />
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-white truncate">{u.full_name}</p>
                    <p className="text-sm" style={{ color: pg.text3 }}>{u.phone || 'No phone'}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs" style={{ color: pg.text4 }}>{u.city || 'No city'} · {u.role.toUpperCase()} · {formatTime(u.created_at)}</p>
                      {u.gps_lat && u.gps_lng && (
                        <span className="flex items-center gap-0.5 text-xs" style={{ color: pg.lime }}>
                          <MapPin size={10} /> GPS
                        </span>
                      )}
                    </div>
                  </div>
                  <StatusPill status={u.status} />
                </div>
              </div>
            ))}
        </div>
      )}

      {selected && (
        <UserActionDrawer
          user={selected}
          updating={updating === selected.id}
          impersonating={impersonating}
          onClose={() => setSelected(null)}
          onUpdateStatus={(status) => updateStatus(selected, status)}
          onImpersonate={async () => {
            setImpersonating(true)
            try {
              const { data, error } = await supabase.functions.invoke('impersonate-user', {
                body: { user_id: selected.id },
              })
              if (error || !data?.url) throw new Error(error?.message || 'Failed to generate login link')
              window.open(data.url, '_blank')
            } catch (err: any) {
              alert('Could not log in as user: ' + (err.message || err))
            } finally {
              setImpersonating(false)
            }
          }}
        />
      )}
    </AdminShell>
  )
}

function UserActionDrawer({
  user, updating, impersonating, onClose, onUpdateStatus, onImpersonate,
}: {
  user: Profile
  updating: boolean
  impersonating: boolean
  onClose: () => void
  onUpdateStatus: (status: 'active' | 'suspended' | 'banned') => void
  onImpersonate: () => void
}) {
  const [orders, setOrders] = useState<Array<{ id: string; status: string; created_at: string }>>([])
  const [ordersLoading, setOrdersLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('requests')
      .select('id, description, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => { setOrders(data || []); setOrdersLoading(false) })
  }, [user.id])

  const mapUrl = user.gps_lat && user.gps_lng
    ? `https://www.google.com/maps?q=${user.gps_lat},${user.gps_lng}&z=15`
    : null

  return (
    <DrawerShell onClose={onClose}>
          <div className="mb-5 flex items-center gap-4">
            <Avatar url={user.photo_url} name={user.full_name || 'User'} size={56} />
            <div>
              <p className="text-lg font-extrabold text-white">{user.full_name}</p>
              <p className="text-sm" style={{ color: pg.text3 }}>{user.phone}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded-full px-2 py-0.5 text-xs font-extrabold uppercase" style={{ background: pg.surface2, color: pg.text3 }}>{user.role}</span>
                <StatusPill status={user.status} />
              </div>
            </div>
          </div>

          <InfoPanel className="mb-4">
            <InfoRow label="City" value={user.city || 'Not set'} />
            <InfoRow label="Address" value={user.address || 'Not set'} />
            <InfoRow label="Preferred Language" value={(user as any).preferred_language || 'en'} />
            <InfoRow label="Joined" value={formatTime(user.created_at)} />
            {user.gps_lat && user.gps_lng ? (
              <div className="space-y-1">
                <InfoRow label="GPS Location" value={`${user.gps_lat.toFixed(4)}, ${user.gps_lng!.toFixed(4)}`} />
                <a href={mapUrl!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold" style={{ background: pg.limeDim, border: `1px solid rgba(196,214,0,0.28)`, color: pg.lime }}>
                  <MapPin size={14} /> View on Google Maps
                </a>
              </div>
            ) : (
              <InfoRow label="GPS Location" value="Not set" />
            )}
          </InfoPanel>

          <div className="mb-5">
            <p className="mb-2 text-xs font-extrabold uppercase tracking-wide" style={{ color: pg.text4 }}>Recent Requests ({orders.length})</p>
            {ordersLoading ? (
              <div className="space-y-2">
                {[1,2].map(i => <div key={i} className="h-10 animate-pulse rounded-xl glass" />)}
              </div>
            ) : orders.length === 0 ? (
              <p className="text-sm text-white/40 italic">No requests yet.</p>
            ) : (
              <div className="space-y-1.5">
                {orders.map(o => (
                  <div key={o.id} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: pg.surface2 }}>
                    <p className="text-sm font-medium text-white truncate max-w-[60%]">{(o as any).description?.split('\n')[0]?.trim() || 'Request'}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusPill status={o.status} />
                      <span className="text-[10px] text-white/40">{formatTime(o.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="mb-3 text-xs font-extrabold uppercase tracking-wide" style={{ color: pg.text4 }}>Account Actions</p>
          <div className="space-y-2">
            <ActionBtn onClick={onImpersonate} disabled={impersonating} tone="lime">
              <LogIn size={18} /> {impersonating ? 'Opening login...' : 'Login as this User'}
            </ActionBtn>
            {user.status !== 'active' && (
              <ActionBtn onClick={() => onUpdateStatus('active')} disabled={updating} tone="success">
                <CheckCircle size={18} /> Reinstate Account
              </ActionBtn>
            )}
            {user.status !== 'suspended' && (
              <ActionBtn onClick={() => onUpdateStatus('suspended')} disabled={updating} tone="warn">
                <ShieldOff size={18} /> Suspend Account
              </ActionBtn>
            )}
            {user.status !== 'banned' && (
              <ActionBtn onClick={() => onUpdateStatus('banned')} disabled={updating} tone="danger">
                <Ban size={18} /> Ban Account
              </ActionBtn>
            )}
          </div>

          {(user.status === 'suspended' || user.status === 'banned') && (
            <div className="mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5" style={{ background: 'rgba(245,165,36,0.12)', border: '1px solid rgba(245,165,36,0.25)' }}>
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-yellow-400" />
              <p className="text-xs text-yellow-300">This user is blocked from signing in.</p>
            </div>
          )}
    </DrawerShell>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-sm text-white/50 shrink-0">{label}</span>
      <span className="text-sm font-medium text-white text-right">{value}</span>
    </div>
  )
}
