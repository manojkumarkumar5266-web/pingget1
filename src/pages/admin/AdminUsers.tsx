import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../../context'
import { supabase, Profile } from '../../lib/supabase'
import { Avatar, EmptyState } from '../../components/ui'
import { formatTime } from '../../lib/utils'
import { Users, ShieldOff, Ban, CheckCircle, AlertTriangle, Download, Search } from 'lucide-react'
import * as XLSX from 'xlsx'

type StatusFilter = 'all' | 'active' | 'suspended' | 'banned'

const STATUS_CONFIG = {
  active:    { label: 'Active',    badge: 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300' },
  suspended: { label: 'Suspended', badge: 'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-300' },
  banned:    { label: 'Banned',    badge: 'bg-error-100 text-error-700 dark:bg-error-900/40 dark:text-error-300' },
}

export default function AdminUsers() {
  const { profile: adminProfile } = useAuth()
  const [users, setUsers] = useState<Profile[]>([])
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [selected, setSelected] = useState<Profile | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('profiles').select('*').in('role', ['user', 'dp'])
    if (filter !== 'all') query = query.eq('status', filter)
    const { data } = await query.order('created_at', { ascending: false })
    setUsers((data as Profile[]) || [])
    setLoading(false)
  }, [filter])

  useEffect(() => { fetchUsers() }, [fetchUsers])

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
      'Joined On': formatTime(u.created_at),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Users')
    XLSX.writeFile(wb, `users-${filter}.xlsx`)
  }

  const filters: StatusFilter[] = ['all', 'active', 'suspended', 'banned']

  return (
    <div className="p-4 md:p-8">
      <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">Users</h1>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 overflow-x-auto">
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold capitalize transition-all ${
                filter === f ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <button onClick={exportUsers} className="btn-secondary shrink-0 text-sm">
          <Download size={16} /> Export
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, phone, or city..."
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-primary-600"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Users size={48} />} title={`No ${filter} users`} />
      ) : (
        <div className="space-y-2">
          {filtered.map(u => {
            const cfg = STATUS_CONFIG[u.status] || STATUS_CONFIG.active
            return (
              <div
                key={u.id}
                onClick={() => setSelected(u)}
                className="card cursor-pointer p-4 transition-all active:bg-gray-50 dark:active:bg-gray-800"
              >
                <div className="flex items-center gap-3">
                  <Avatar url={u.photo_url} name={u.full_name || 'User'} size={44} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">{u.full_name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{u.phone || 'No phone'}</p>
                    <p className="text-xs text-gray-400">{u.city || 'No city'} · {u.role.toUpperCase()} · {formatTime(u.created_at)}</p>
                  </div>
                  <span className={`badge shrink-0 ${cfg.badge}`}>{cfg.label}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selected && (
        <UserActionDrawer
          user={selected}
          updating={updating === selected.id}
          onClose={() => setSelected(null)}
          onUpdateStatus={(status) => updateStatus(selected, status)}
        />
      )}
    </div>
  )
}

function UserActionDrawer({
  user, updating, onClose, onUpdateStatus,
}: {
  user: Profile
  updating: boolean
  onClose: () => void
  onUpdateStatus: (status: 'active' | 'suspended' | 'banned') => void
}) {
  const cfg = STATUS_CONFIG[user.status] || STATUS_CONFIG.active

  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
      <div
        className="absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto rounded-t-3xl bg-white dark:bg-gray-900"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="px-5 pb-8 pt-2">
          <div className="mb-5 flex items-center gap-4">
            <Avatar url={user.photo_url} name={user.full_name || 'User'} size={56} />
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{user.full_name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{user.phone}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">{user.role}</span>
                <span className={`badge ${cfg.badge}`}>{cfg.label}</span>
              </div>
            </div>
          </div>

          <div className="mb-5 rounded-2xl border border-gray-100 p-4 dark:border-gray-800 space-y-2">
            <InfoRow label="City" value={user.city || 'Not set'} />
            <InfoRow label="Address" value={user.address || 'Not set'} />
            <InfoRow label="Joined" value={formatTime(user.created_at)} />
          </div>

          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Account Actions</p>
          <div className="space-y-2">
            {user.status !== 'active' && (
              <button
                onClick={() => onUpdateStatus('active')}
                disabled={updating}
                className="flex w-full items-center gap-3 rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm font-semibold text-success-700 transition-all active:scale-[0.98] disabled:opacity-60 dark:border-success-800 dark:bg-success-900/20 dark:text-success-300"
              >
                <CheckCircle size={18} /> Reinstate Account
              </button>
            )}
            {user.status !== 'suspended' && (
              <button
                onClick={() => onUpdateStatus('suspended')}
                disabled={updating}
                className="flex w-full items-center gap-3 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm font-semibold text-warning-700 transition-all active:scale-[0.98] disabled:opacity-60 dark:border-warning-800 dark:bg-warning-900/20 dark:text-warning-300"
              >
                <ShieldOff size={18} /> Suspend Account
              </button>
            )}
            {user.status !== 'banned' && (
              <button
                onClick={() => onUpdateStatus('banned')}
                disabled={updating}
                className="flex w-full items-center gap-3 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm font-semibold text-error-700 transition-all active:scale-[0.98] disabled:opacity-60 dark:border-error-800 dark:bg-error-900/20 dark:text-error-300"
              >
                <Ban size={18} /> Ban Account
              </button>
            )}
          </div>

          {(user.status === 'suspended' || user.status === 'banned') && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-warning-50 px-3 py-2.5 dark:bg-warning-950/30">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warning-600 dark:text-warning-400" />
              <p className="text-xs text-warning-700 dark:text-warning-300">
                This user is blocked from signing in. They will see an error message if they attempt to log in.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900 dark:text-white text-right">{value}</span>
    </div>
  )
}
