import { useEffect, useMemo, useState } from 'react'
import { CheckSquare, Mail, MapPin, Square, Trash2 } from 'lucide-react'
import { supabase, ServiceAreaWaitlist } from '../../lib/supabase'
import { EmptyState, ErrorBanner, SkeletonCard } from '../../components/ui'
import { AdminShell, AdminHeader } from './adminChrome'
import { pg } from '../../design/tokens'

/** Admin view of users who asked to be notified when service reaches their area */
export default function AdminServiceWaitlist() {
  const [rows, setRows] = useState<ServiceAreaWaitlist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [notifying, setNotifying] = useState(false)
  const [areaFilter, setAreaFilter] = useState<string>('all')
  const [customMessage, setCustomMessage] = useState(
    'Good news — PingGet is now available in your area! Download the app and place your first delivery request.',
  )

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

  const areaKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const row of rows) {
      const key = [row.city_name, row.pincode, row.area_name].filter(Boolean).join(' · ') || 'Unknown'
      keys.add(key)
    }
    return Array.from(keys).sort()
  }, [rows])

  const visible = useMemo(() => {
    if (areaFilter === 'all') return rows
    return rows.filter((row) => {
      const key = [row.city_name, row.pincode, row.area_name].filter(Boolean).join(' · ') || 'Unknown'
      return key === areaFilter
    })
  }, [rows, areaFilter])

  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.id))

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        for (const r of visible) next.delete(r.id)
      } else {
        for (const r of visible) next.add(r.id)
      }
      return next
    })
  }

  const markNotified = async (ids: string[]) => {
    if (ids.length === 0) return
    const now = new Date().toISOString()
    await supabase
      .from('service_area_waitlist')
      .update({ notified_at: now, updated_at: now })
      .in('id', ids)
  }

  const remove = async (id: string) => {
    await supabase.from('service_area_waitlist').delete().eq('id', id)
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    fetchRows()
  }

  const bulkNotify = async () => {
    const targets = rows.filter((r) => selected.has(r.id))
    if (targets.length === 0) {
      setError('Select at least one email to notify.')
      return
    }
    setNotifying(true)
    setError(null)
    const failed: string[] = []
    const succeeded: string[] = []

    for (const row of targets) {
      try {
        const { data, error: invErr } = await supabase.functions.invoke('send-email', {
          body: {
            to: row.email,
            type: 'area_available',
            subject: 'PingGet is now available in your area',
            data: {
              area: [row.area_name, row.pincode, row.city_name].filter(Boolean).join(', ') || 'your area',
              message: customMessage,
              app_url: 'https://pingget.app',
            },
          },
        })
        if (invErr || (data && data.success === false && !data.skipped)) {
          failed.push(row.email)
        } else {
          succeeded.push(row.id)
        }
      } catch {
        failed.push(row.email)
      }
    }

    if (succeeded.length > 0) {
      await markNotified(succeeded)
      setSelected((prev) => {
        const next = new Set(prev)
        for (const id of succeeded) next.delete(id)
        return next
      })
      await fetchRows()
    }
    if (failed.length > 0) {
      setError(`Sent ${succeeded.length}, failed for: ${failed.slice(0, 5).join(', ')}${failed.length > 5 ? '…' : ''}`)
    }
    setNotifying(false)
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
        Emails from users outside active cities/pincodes. When you launch in an area, select those emails and send a bulk notification.
      </p>

      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

      {!loading && rows.length > 0 && (
        <div className="mb-4 space-y-3 rounded-[22px] p-4" style={{ background: pg.surface, border: `1px solid ${pg.line}` }}>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-extrabold uppercase tracking-wide" style={{ color: pg.text4 }}>Filter area</label>
            <select
              className="rounded-xl px-3 py-2 text-sm"
              style={{ background: pg.surface2, color: pg.ink, border: `1px solid ${pg.line}` }}
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
            >
              <option value="all">All areas</option>
              {areaKeys.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={toggleAllVisible}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-extrabold"
              style={{ background: pg.surface2, color: pg.ink }}
            >
              {allVisibleSelected ? <CheckSquare size={14} /> : <Square size={14} />}
              {allVisibleSelected ? 'Clear selection' : 'Select visible'}
            </button>
            <span className="text-xs font-bold" style={{ color: pg.text3 }}>{selected.size} selected</span>
          </div>
          <div>
            <label className="mb-1 block text-xs font-extrabold uppercase tracking-wide" style={{ color: pg.text4 }}>
              Bulk message
            </label>
            <textarea
              className="w-full rounded-xl px-3 py-2 text-sm"
              rows={3}
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              style={{ background: pg.surface2, color: pg.ink, border: `1px solid ${pg.line}` }}
            />
          </div>
          <button
            type="button"
            disabled={notifying || selected.size === 0}
            onClick={bulkNotify}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold disabled:opacity-40"
            style={{ background: pg.lime, color: pg.limeText }}
          >
            <Mail size={16} />
            {notifying ? 'Sending…' : `Notify selected (${selected.size})`}
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3"><SkeletonCard /><SkeletonCard /></div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<MapPin size={28} />}
          title="No waitlist entries yet"
          description="When users outside active service areas tap Notify me, they show up here."
        />
      ) : (
        <div className="space-y-2.5">
          {visible.map((row) => {
            const isOn = selected.has(row.id)
            return (
              <div
                key={row.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-[22px] px-4 py-3.5"
                style={{ background: pg.surface, color: pg.ink, border: `1px solid ${isOn ? pg.lime : pg.line}` }}
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggleOne(row.id)}
                    className="mt-0.5 shrink-0"
                    aria-label={isOn ? 'Deselect' : 'Select'}
                    style={{ color: isOn ? pg.lime : pg.text4 }}
                  >
                    {isOn ? <CheckSquare size={18} /> : <Square size={18} />}
                  </button>
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
                </div>
                <div className="flex items-center gap-2">
                  {!row.notified_at && (
                    <button
                      type="button"
                      onClick={() => markNotified([row.id]).then(fetchRows)}
                      className="rounded-xl px-3 py-1.5 text-[11px] font-extrabold"
                      style={{ background: pg.surface2, color: pg.ink }}
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
            )
          })}
        </div>
      )}
    </AdminShell>
  )
}
