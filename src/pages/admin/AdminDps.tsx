import { useEffect, useState } from 'react'
import { useAuth } from '../../context'
import { supabase, DeliveryPartner, Profile } from '../../lib/supabase'
import { kickPushDelivery } from '../../lib/notify'
import { Avatar, EmptyState, SkeletonCard } from '../../components/ui'
import { formatTime } from '../../lib/utils'
import { Check, X, Shield, ChevronRight, ArrowLeft, FileText, Phone, Truck, CreditCard, AlertCircle, Download, MapPin } from 'lucide-react'
import * as XLSX from 'xlsx'
import { AdminShell, AdminHeader, FilterPills, StatusPill, DrawerShell } from './adminChrome'
import { pg } from '../../design/tokens'

type DpWithProfile = DeliveryPartner & { profile: Profile }
type Filter = 'pending' | 'approved' | 'rejected' | 'all'

export default function AdminDps() {
  const { profile: adminProfile } = useAuth()
  const [dps, setDps] = useState<DpWithProfile[]>([])
  const [filter, setFilter] = useState<Filter>('pending')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<DpWithProfile | null>(null)

  const fetchDps = async (f: Filter) => {
    setLoading(true)
    let query = supabase.from('delivery_partners').select('*')
    if (f !== 'all') query = query.eq('status', f)
    const { data: dpData } = await query.order('created_at', { ascending: false })
    if (!dpData) { setLoading(false); return }

    const userIds = dpData.map(d => d.user_id)
    const { data: profiles } = await supabase.from('profiles').select('*').in('id', userIds)
    const profileMap = new Map((profiles || []).map(p => [p.id, p as Profile]))
    setDps(dpData.map(d => ({ ...d, profile: profileMap.get(d.user_id)! })).filter(d => d.profile))
    setLoading(false)
  }

  useEffect(() => { fetchDps(filter) }, [filter])

  // Realtime: listen for new/updated delivery partners and profiles
  useEffect(() => {
    const channel = supabase.channel('admin-dps-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_partners' }, () => fetchDps(filter))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchDps(filter))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [filter])

  const updateStatus = async (dp: DpWithProfile, newStatus: 'approved' | 'rejected') => {
    const { error } = await supabase.from('delivery_partners').update({ status: newStatus }).eq('id', dp.id)
    if (!error) {
      await supabase.from('profiles').update({ status: newStatus }).eq('id', dp.user_id)
      await supabase.from('admin_notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('related_id', dp.user_id).eq('is_read', false)
      await supabase.from('admin_logs').insert({
        admin_id: adminProfile!.id, action: `dp_${newStatus}`, target_id: dp.user_id, details: `DP ${dp.id} -> ${newStatus}`,
      })
      await supabase.from('notifications').insert({
        user_id: dp.user_id,
        title: newStatus === 'approved' ? 'Account Approved!' : 'Application Rejected',
        body: newStatus === 'approved'
          ? 'Your delivery partner account has been approved. You can now accept requests.'
          : 'Your delivery partner application was not approved. Please contact support.',
        type: 'dp_status',
      })
      kickPushDelivery()
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            to: dp.user_id,
            type: newStatus === 'approved' ? 'dp_approved' : 'dp_rejected',
            data: { name: dp.profile?.full_name || 'Partner' },
          },
        })
      } catch { /* best effort */ }
      setSelected(null)
      fetchDps(filter)
    }
  }

  const exportDps = () => {
    const rows = dps.map(dp => ({
      Name: dp.profile?.full_name || '',
      Phone: dp.profile?.phone || '',
      Email: '',
      City: dp.profile?.city || '',
      'Vehicle Type': dp.vehicle_type || '',
      'Aadhaar Number': dp.aadhaar_number || '',
      'Emergency Contact': dp.emergency_contact || '',
      'UPI ID': dp.upi_id || '',
      'Bank Account': dp.bank_account || '',
      Status: dp.status,
      'Applied On': formatTime(dp.created_at),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Delivery Partners')
    XLSX.writeFile(wb, `delivery-partners-${filter}.xlsx`)
  }

  const filters: Filter[] = ['pending', 'approved', 'rejected', 'all']

  return (
    <AdminShell>
      <AdminHeader title="Delivery Partners" action={
        <button onClick={exportDps} className="btn-secondary shrink-0 text-sm"><Download size={16} /> Export</button>
      } />

      <div className="mb-4">
        <FilterPills options={filters} value={filter} onChange={setFilter} />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <SkeletonCard key={i} lines={3} />)}
        </div>
      ) : dps.length === 0 ? (
        <EmptyState icon={<Shield size={48} />} title={`No ${filter} delivery partners`} />
      ) : (
        <div className="space-y-3">
          {dps.map((dp, i) => (
            <div
              key={dp.id}
              onClick={() => setSelected(dp)}
              className='card card-hover p-4 cursor-pointer animate-slide-up'
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-center gap-3">
                <Avatar url={dp.profile?.photo_url} name={dp.profile?.full_name || 'DP'} size={48} />
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-[#F5F7F6] truncate">{dp.profile?.full_name}</p>
                  <p className="text-sm" style={{ color: pg.text3 }}>{dp.profile?.phone}</p>
                  <p className="text-xs" style={{ color: pg.text4 }}>{dp.vehicle_type || 'Vehicle not set'} • {formatTime(dp.created_at)}</p>
                  {dp.status === 'approved' && (
                    <p className="text-xs text-black/40">
                      Rating: {dp.rating_count > 0 ? `${dp.rating_avg} ★ (${dp.rating_count} reviews)` : 'No ratings yet'}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusPill status={dp.status} />
                  <ChevronRight size={16} style={{ color: pg.text4 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <DpDetailDrawer
          dp={selected}
          onClose={() => setSelected(null)}
          onApprove={() => updateStatus(selected, 'approved')}
          onReject={() => updateStatus(selected, 'rejected')}
        />
      )}
    </AdminShell>
  )
}

function DpDetailDrawer({ dp, onClose, onApprove, onReject }: {
  dp: DpWithProfile; onClose: () => void; onApprove: () => void; onReject: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 bg-[#000000]/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="absolute bottom-0 left-0 right-0 max-h-[92vh] overflow-y-auto rounded-t-3xl glass bottom-sheet"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1.5 w-12 rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="px-5 pb-8">
          <div className="mb-5 flex items-center gap-3">
            <button onClick={onClose} className="btn-ghost p-2 -ml-2"><ArrowLeft size={20} /></button>
            <h2 className="text-lg font-bold text-[#F5F7F6]">DP Application</h2>
          </div>

          <div className="mb-6 flex items-center gap-4">
            <Avatar url={dp.profile?.photo_url} name={dp.profile?.full_name || 'DP'} size={72} />
            <div>
              <p className="text-xl font-bold text-[#F5F7F6]">{dp.profile?.full_name}</p>
              <span className={`badge mt-1 ${dp.status==='approved' ? 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300' : dp.status==='rejected' ? 'bg-error-100 text-error-700 dark:bg-error-900/40 dark:text-error-300' : 'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-300'}`}>{dp.status === 'approved' ? 'Approved' : dp.status === 'rejected' ? 'Rejected' : 'Pending Approval'}</span>
            </div>
          </div>

          {/* Profile Photo */}
          {dp.profile?.photo_url && (
            <div className="mb-4 rounded-2xl border border-black/10 p-4 dark:border-gray-800">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-black/55"><FileText size={16} /> Profile Photo</div>
              <a href={dp.profile.photo_url} target="_blank" rel="noopener noreferrer">
                <img src={dp.profile.photo_url} alt="Profile" className="h-32 w-32 rounded-xl object-cover" />
              </a>
            </div>
          )}

          <div className="space-y-4">
            <Section title="Contact" icon={<Phone size={16} />}>
              <Row label="Phone" value={dp.profile?.phone || 'Not provided'} />
              <Row label="Email" value={(dp.profile as any)?.email || 'Not provided'} />
              <Row label="Pincode" value={(dp.profile as any)?.pincode || 'Not provided'} />
              <Row label="City" value={dp.profile?.city || 'Not provided'} />
              <Row label="Address" value={dp.profile?.address || 'Not provided'} />
              <Row label="Emergency Contact" value={dp.emergency_contact || 'Not provided'} />
              {dp.profile?.gps_lat && dp.profile?.gps_lng ? (
                <div className="space-y-1">
                  <Row label="GPS Location" value={`${dp.profile.gps_lat.toFixed(4)}, ${dp.profile.gps_lng.toFixed(4)}`} />
                  <a href={`https://www.google.com/maps?q=${dp.profile.gps_lat},${dp.profile.gps_lng}&z=15`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700 dark:border-primary-800 dark:bg-primary-900/30 dark:text-primary-300">
                    <MapPin size={14} /> View on Google Maps
                  </a>
                </div>
              ) : (
                <Row label="GPS Location" value="Not set" />
              )}
            </Section>
            <Section title="Vehicle" icon={<Truck size={16} />}>
              <Row label="Vehicle Type" value={dp.vehicle_type || 'Not specified'} />
            </Section>
            <Section title="Identity & documents" icon={<FileText size={16} />}>
              <Row label="Aadhaar Number" value={dp.aadhaar_number ? `****${dp.aadhaar_number.slice(-4)}` : 'Not provided'} />
              {(dp.aadhaar_url || (dp as any).aadhaar_url) ? (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-gray-500">Aadhaar Document (attachment)</p>
                  <a href={(dp.aadhaar_url || (dp as any).aadhaar_url)!} target="_blank" rel="noopener noreferrer" className="block">
                    <img
                      src={(dp.aadhaar_url || (dp as any).aadhaar_url)!}
                      alt="Aadhaar"
                      className="max-h-48 w-full rounded-xl object-contain"
                      style={{ background: '#111', border: '1px solid rgba(255,255,255,0.12)' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                    <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: pg.lime }}>
                      <FileText size={14} /> Open Aadhaar file
                    </span>
                  </a>
                </div>
              ) : (
                <Row label="Aadhaar Document" value="Not uploaded" />
              )}
              {dp.driving_license_url ? (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-gray-500">Driving Licence (attachment)</p>
                  <a href={dp.driving_license_url} target="_blank" rel="noopener noreferrer" className="block">
                    <img
                      src={dp.driving_license_url}
                      alt="Driving licence"
                      className="max-h-48 w-full rounded-xl object-contain"
                      style={{ background: '#111', border: '1px solid rgba(255,255,255,0.12)' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                    <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: pg.lime }}>
                      <FileText size={14} /> Open licence file
                    </span>
                  </a>
                </div>
              ) : (
                <Row label="Driving Licence" value="Not uploaded" />
              )}
            </Section>
            <Section title="Payment" icon={<CreditCard size={16} />}>
              <Row label="UPI ID" value={dp.upi_id || 'Not provided'} />
              <Row label="Bank Account" value={dp.bank_account || 'Not provided'} />
            </Section>
            <Section title="Application" icon={<AlertCircle size={16} />}>
              <Row label="Applied On" value={formatTime(dp.created_at)} />
              <Row label="Rating" value={`${dp.rating_avg?.toFixed?.(1) ?? '—'} (${dp.rating_count || 0} ratings)`} />
              <Row label="Online now" value={dp.is_online ? 'Yes' : 'No'} />
            </Section>
          </div>

          {dp.status === 'pending' && (
            <div className="mt-6 flex gap-3">
              <button
                onClick={onReject}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-error-300 bg-error-50 py-3 text-sm font-semibold text-error-700 transition-all active:scale-95 dark:border-error-700 dark:bg-error-900/30 dark:text-error-300"
              >
                <X size={18} /> Reject
              </button>
              <button
                onClick={onApprove}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-[#F5F7F6] transition-all active:scale-95"
                style={{ backgroundColor: '#22c55e' }}
              >
                <Check size={18} /> Approve
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: pg.surface2, color: pg.ink, border: `1px solid ${pg.line}` }}>
      <div className="mb-3 flex items-center gap-2 text-sm font-extrabold" style={{ color: pg.text3 }}>{icon} {title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-sm shrink-0" style={{ color: pg.text3 }}>{label}</span>
      <span className="text-sm font-medium text-[#F5F7F6] text-right">{value}</span>
    </div>
  )
}
