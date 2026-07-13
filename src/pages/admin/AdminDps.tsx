import { useEffect, useState } from 'react'
import { useAuth } from '../../context'
import { supabase, DeliveryPartner, Profile } from '../../lib/supabase'
import { Avatar, EmptyState } from '../../components/ui'
import { formatTime } from '../../lib/utils'
import { Check, X, Shield, ChevronRight, ArrowLeft, FileText, Phone, Truck, CreditCard, AlertCircle, Download, MapPin } from 'lucide-react'
import * as XLSX from 'xlsx'

type DpWithProfile = DeliveryPartner & { profile: Profile; aadhaar_url?: string | null }
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

  const updateStatus = async (dp: DpWithProfile, newStatus: 'approved' | 'rejected') => {
    const { error } = await supabase.from('delivery_partners').update({ status: newStatus }).eq('id', dp.id)
    if (!error) {
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
    <div className="p-4 md:p-8">
      <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">Delivery Partners</h1>

      <div className="mb-4 flex items-center justify-between gap-3">
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
        <button onClick={exportDps} className="btn-secondary shrink-0 text-sm"><Download size={16} /> Export</button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />)}
        </div>
      ) : dps.length === 0 ? (
        <EmptyState icon={<Shield size={48} />} title={`No ${filter} delivery partners`} />
      ) : (
        <div className="space-y-3">
          {dps.map(dp => (
            <div
              key={dp.id}
              onClick={() => setSelected(dp)}
              className='card p-4 cursor-pointer active:bg-gray-50 dark:active:bg-gray-800'
            >
              <div className="flex items-center gap-3">
                <Avatar url={dp.profile?.photo_url} name={dp.profile?.full_name || 'DP'} size={48} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white truncate">{dp.profile?.full_name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{dp.profile?.phone}</p>
                  <p className="text-xs text-gray-400">{dp.vehicle_type || 'Vehicle not set'} • {formatTime(dp.created_at)}</p>
                  {dp.status === 'approved' && (
                    <p className="text-xs text-gray-400">
                      Rating: {dp.rating_count > 0 ? `${dp.rating_avg} ★ (${dp.rating_count} reviews)` : 'No ratings yet'}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`badge ${
                    dp.status === 'approved' ? 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300' :
                    dp.status === 'pending' ? 'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-300' :
                    'bg-error-100 text-error-700 dark:bg-error-900/40 dark:text-error-300'
                  }`}>{dp.status}</span>
                  <ChevronRight size={16} className='text-gray-400' />
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
    </div>
  )
}

function DpDetailDrawer({ dp, onClose, onApprove, onReject }: {
  dp: DpWithProfile; onClose: () => void; onApprove: () => void; onReject: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
      <div
        className="absolute bottom-0 left-0 right-0 max-h-[92vh] overflow-y-auto rounded-t-3xl bg-white dark:bg-gray-900"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="px-5 pb-8">
          <div className="mb-5 flex items-center gap-3">
            <button onClick={onClose} className="btn-ghost p-2 -ml-2"><ArrowLeft size={20} /></button>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">DP Application</h2>
          </div>

          <div className="mb-6 flex items-center gap-4">
            <Avatar url={dp.profile?.photo_url} name={dp.profile?.full_name || 'DP'} size={72} />
            <div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{dp.profile?.full_name}</p>
              <span className={`badge mt-1 ${dp.status==='approved' ? 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300' : dp.status==='rejected' ? 'bg-error-100 text-error-700 dark:bg-error-900/40 dark:text-error-300' : 'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-300'}`}>{dp.status === 'approved' ? 'Approved' : dp.status === 'rejected' ? 'Rejected' : 'Pending Approval'}</span>
            </div>
          </div>

          <div className="space-y-4">
            <Section title="Contact" icon={<Phone size={16} />}>
              <Row label="Phone" value={dp.profile?.phone || 'Not provided'} />
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
            <Section title="Identity" icon={<FileText size={16} />}>
              <Row label="Aadhaar Number" value={dp.aadhaar_number ? `****${dp.aadhaar_number.slice(-4)}` : 'Not provided'} />
              {(dp as any).aadhaar_url ? (
                <div className="mt-2">
                  <p className="text-xs text-gray-500 mb-1">Aadhaar Document</p>
                  <a
                    href={(dp as any).aadhaar_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700 dark:border-primary-800 dark:bg-primary-900/30 dark:text-primary-300"
                  >
                    <FileText size={14} /> View Aadhaar
                  </a>
                </div>
              ) : (
                <Row label="Aadhaar Document" value="Not uploaded" />
              )}
              {dp.driving_license_url ? (
                <div className="mt-2">
                  <p className="text-xs text-gray-500 mb-1">Driving Licence</p>
                  <a
                    href={dp.driving_license_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-accent-200 bg-accent-50 px-3 py-1.5 text-sm font-medium text-accent-700 dark:border-accent-800 dark:bg-accent-900/30 dark:text-accent-300"
                  >
                    <FileText size={14} /> View Driving Licence
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
                className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all active:scale-95"
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
    <div className="rounded-2xl border border-gray-100 p-4 dark:border-gray-800">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-400">{icon} {title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900 dark:text-white text-right">{value}</span>
    </div>
  )
}
