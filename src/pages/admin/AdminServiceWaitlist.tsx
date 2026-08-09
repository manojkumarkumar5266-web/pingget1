import { useEffect, useState } from 'react'
import { Mail, MapPin, Trash2 } from 'lucide-react'
import { supabase, ServiceAreaWaitlist } from '../../lib/supabase'
import { EmptyState, ErrorBanner, SkeletonCard } from '../../components/ui'
import { AdminShell, AdminHeader } from './adminChrome'
import { pg } from '../../design/tokens'

/** Admin view of users who asked to be notified when service reaches their area */
export default function AdminServiceWaitlist() {
  const [rows, setRows] = useState<ServiceAreaWaitlist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRows = async () => {
    setError(null)
    const { data, error: err } = await supabase
      .from('service_area_waitlist')
      .select('*')
      .order('created_at', { ascending: false })
    if (err) setError(err.message)
    setRows((data as ServiceAreaWaitlist[]) || [])
    setLoading(false)
  }

  useEffect(() => { fetchRows() }, [])

  const markNotified = async (id: string) => {
    await supabase
      .from('service_area_waitlist')
      .update({ notified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)
    fetchRows()
  }

  const remove = async (id: string) => {
    await supabase.from('service_area_waitlist').delete().eq('id', id)
    fetchRows()
  }

  return (
    <AdminShell>
      <AdminHeader
        eyebrow="Coverage"
        title="Area waitlist"
        action={
          <span className="rounded-full px-3 py-1 text-xs font-extrabold" style={{ background: pg.limeDim, color: pg.lime }}>
            {rows.length} interested
          </span>
        }
      />
      <p className="mb-5 max-w-xl text-sm" style={{ color: pg.text3 }}>
        Users outside your active cities/pincodes can request an email when PingGet launches in their place.
      </p>

      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

      {loading ? (
        <div className="space-y-3"><SkeletonCard /><SkeletonCard /></div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<MapPin size={28} />}
          title="No waitlist entries yet"
          description="When users outside active service areas tap Notify me, they show up here."
        />
      ) : (
        <div className="space-y-2.5">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-[22px] px-4 py-3.5"
              style={{ background: pg.surface, border: `1px solid ${pg.line}` }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-extrabold">
                  <Mail size={14} style={{ color: pg.lime }} />
                  <span className="truncate">{row.email}</span>
                </div>
                <p className="mt-1 text-xs" style={{ color: pg.text3 }}>
                  {[row.area_name, row.pincode, row.city_name].filter(Boolean).join(' · ') || 'Location unknown'}
                  {row.source ? ` · ${row.source}` : ''}
                </p>
                <p className="mt-0.5 text-[11px]" style={{ color: pg.text4 }}>
                  {new Date(row.created_at).toLocaleString()}
                  {row.notified_at ? ` · Notified ${new Date(row.notified_at).toLocaleDateString()}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!row.notified_at && (
                  <button
                    type="button"
                    onClick={() => markNotified(row.id)}
                    className="rounded-xl px-3 py-1.5 text-[11px] font-extrabold"
                    style={{ background: pg.lime, color: pg.limeText }}
                  >
                    Mark notified
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(row.id)}
                  className="rounded-xl p-2"
                  style={{ color: pg.text4, background: pg.surface2 }}
                  aria-label="Remove"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  )
}
