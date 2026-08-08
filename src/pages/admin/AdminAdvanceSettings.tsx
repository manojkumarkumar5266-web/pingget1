import { useEffect, useState } from 'react'
import { supabase, type AdvanceSettings } from '../../lib/supabase'
import { Settings, Save, Check, AlertCircle } from 'lucide-react'
import { AdminShell, AdminHeader } from './adminChrome'

const DEFAULT_SETTINGS: Omit<AdvanceSettings, 'id' | 'created_at' | 'updated_at'> = {
  enabled: true,
  max_advance_days: 7,
  notification_lead_minutes: 30,
  business_hours_start: '08:00',
  business_hours_end: '20:00',
  slot_duration_minutes: 30,
  advance_booking_fee: 10,
  platform_fee: 5,
  min_service_charge: 20,
  max_service_charge: 500,
  dp_convenience_charge: 15,
  emergency_charge: 0,
  holiday_charge: 0,
  night_charge: 0,
  night_charge_start: '22:00',
  night_charge_end: '06:00',
  peak_hour_charge: 0,
  peak_hours_start: '17:00',
  peak_hours_end: '20:00',
  cancellation_cutoff_minutes: 120,
  reschedule_cutoff_minutes: 360,
  recurring_enabled: true,
  weekend_charge: 0,
  weekend_charge_enabled: false,
  platform_fee_percent: 0,
  dp_convenience_percent: 0,
  cancellation_fee_after_accept: 25,
  admin_override_cancellation: true,
  expiry_mode: '2_hours',
  expiry_custom_minutes: 120,
  reminder_24h: true,
  reminder_12h: true,
  reminder_2h: true,
  reminder_1h: true,
  reminder_30m: true,
  reminder_15m: true,
  reminder_5m: false,
  expand_search_radius: true,
  search_radius_increment_meters: 2000,
  max_search_radius_meters: 20000,
  // V3 fields
  confirmation_fee: 0,
  reservation_search_radius_meters: 10000,
  payment_deadline_minutes: 120,
  dp_cancel_research: true,
  min_advance_buffer_minutes: 30,
}

const LEAD_OPTIONS = [15, 30, 45, 60, 90, 120]
const SLOT_OPTIONS = [30, 60]
const BUFFER_OPTIONS = [15, 30, 45, 60]
const MAX_DAYS_OPTIONS = [1, 3, 7, 15, 30, 60, 90]
const EXPIRY_OPTIONS: { value: AdvanceSettings['expiry_mode']; label: string }[] = [
  { value: '30_minutes', label: '30 Minutes' },
  { value: '1_hour', label: '1 Hour' },
  { value: '2_hours', label: '2 Hours' },
  { value: '4_hours', label: '4 Hours' },
  { value: 'end_of_slot', label: 'End of Slot' },
  { value: 'never', label: 'Never Expire' },
]

export default function AdminAdvanceSettings() {
  const [settings, setSettings] = useState<AdvanceSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('advance_settings')
      .select('*')
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (data) setSettings(data as AdvanceSettings)
        setLoading(false)
        if (error) setError(error.message)
      })
  }, [])

  const update = (field: keyof AdvanceSettings, value: string | number | boolean) => {
    if (!settings) return
    setSettings({ ...settings, [field]: value })
  }

  const handleSave = async () => {
    if (!settings) return
    setSaving(true); setError(null); setSaved(false)
    try {
      const { id, created_at, updated_at, ...updateData } = settings
      const { error: updateError } = await supabase
        .from('advance_settings')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('id', settings.id)
      if (updateError) throw updateError
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  if (loading) return (
    <AdminShell>
      <div className="mb-6 h-8 w-48 skeleton rounded-xl" />
      <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="skeleton h-32 rounded-2xl" />)}</div>
    </AdminShell>
  )

  const s = settings || ({ ...DEFAULT_SETTINGS, id: '' } as AdvanceSettings)

  return (
    <AdminShell>
      <AdminHeader title="Advance Request Settings" />

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl p-3" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertCircle size={16} className="text-red-400" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Enable / Disable */}
      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-white">Enable Advance Requests</p>
            <p className="text-sm text-white/40">Allow customers to schedule tasks in advance</p>
          </div>
          <Toggle value={s.enabled} onChange={v => update('enabled', v)} />
        </div>
      </div>

      {/* Recurring Toggle */}
      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-white">Enable Recurring Requests</p>
            <p className="text-sm text-white/40">Allow customers to set repeat schedules (daily/weekly/monthly)</p>
          </div>
          <Toggle value={s.recurring_enabled} onChange={v => update('recurring_enabled', v)} />
        </div>
      </div>

      {/* Scheduling */}
      <SectionTitle title="Scheduling" />
      <div className="card p-4 mb-4 space-y-4">
        <div>
          <label className="label">Maximum Advance Booking Days</label>
          <div className="flex flex-wrap gap-2">
            {MAX_DAYS_OPTIONS.map(opt => (
              <Pill key={opt} active={s.max_advance_days === opt} onClick={() => update('max_advance_days', opt)}>{opt} {opt === 1 ? 'day' : 'days'}</Pill>
            ))}
          </div>
          <p className="mt-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>How many days ahead a customer can schedule (includes today)</p>
        </div>
        <div>
          <label className="label">Minimum Advance Buffer Time</label>
          <div className="flex flex-wrap gap-2">
            {BUFFER_OPTIONS.map(opt => (
              <Pill key={opt} active={s.min_advance_buffer_minutes === opt} onClick={() => update('min_advance_buffer_minutes', opt)}>{opt} min</Pill>
            ))}
          </div>
          <p className="mt-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Minimum time from now before a today-slot becomes available</p>
        </div>
        <div>
          <label className="label">Notification Lead Time</label>
          <div className="flex flex-wrap gap-2">
            {LEAD_OPTIONS.map(opt => (
              <Pill key={opt} active={s.notification_lead_minutes === opt} onClick={() => update('notification_lead_minutes', opt)}>{opt} min</Pill>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Slot Duration</label>
          <div className="flex gap-2">
            {SLOT_OPTIONS.map(opt => (
              <Pill key={opt} active={s.slot_duration_minutes === opt} onClick={() => update('slot_duration_minutes', opt)}>{opt === 30 ? '30 min' : '1 hour'}</Pill>
            ))}
          </div>
        </div>
      </div>

      {/* Business Hours */}
      <SectionTitle title="Business Hours" />
      <div className="card p-4 mb-4 grid grid-cols-2 gap-3">
        <div><label className="label">Start Time</label><input type="time" className="input" value={s.business_hours_start} onChange={e => update('business_hours_start', e.target.value)} /></div>
        <div><label className="label">End Time</label><input type="time" className="input" value={s.business_hours_end} onChange={e => update('business_hours_end', e.target.value)} /></div>
      </div>

      {/* Expiry Settings */}
      <SectionTitle title="Expiry Settings" />
      <div className="card p-4 mb-4 space-y-4">
        <div>
          <label className="label">Expiry Mode</label>
          <div className="flex flex-wrap gap-2">
            {EXPIRY_OPTIONS.map(opt => (
              <Pill key={opt.value} active={s.expiry_mode === opt.value} onClick={() => update('expiry_mode', opt.value)}>{opt.label}</Pill>
            ))}
          </div>
        </div>
        <NumberField label="Custom Expiry (minutes, used when mode is custom)" value={s.expiry_custom_minutes} onChange={v => update('expiry_custom_minutes', v)} min={0} />
      </div>

      {/* Service Charges */}
      <SectionTitle title="Service Charges (Fixed)" />
      <div className="card p-4 mb-4 space-y-4">
        <NumberField label="Advance Booking Fee" value={s.advance_booking_fee} onChange={v => update('advance_booking_fee', v)} min={0} />
        <NumberField label="Platform Fee" value={s.platform_fee} onChange={v => update('platform_fee', v)} min={0} />
        <NumberField label="Minimum Service Charge" value={s.min_service_charge} onChange={v => update('min_service_charge', v)} min={0} />
        <NumberField label="Maximum Service Charge" value={s.max_service_charge} onChange={v => update('max_service_charge', v)} min={0} />
        <NumberField label="DP Convenience Charge" value={s.dp_convenience_charge} onChange={v => update('dp_convenience_charge', v)} min={0} />
      </div>

      {/* Percentage Charges */}
      <SectionTitle title="Percentage Charges (on max budget)" />
      <div className="card p-4 mb-4 space-y-4">
        <NumberField label="Platform Fee (%)" value={s.platform_fee_percent} onChange={v => update('platform_fee_percent', v)} min={0} max={100} />
        <NumberField label="DP Convenience (%)" value={s.dp_convenience_percent} onChange={v => update('dp_convenience_percent', v)} min={0} max={100} />
      </div>

      {/* Optional Charges */}
      <SectionTitle title="Optional Charges" />
      <div className="card p-4 mb-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Weekend Charge</p>
          <Toggle value={s.weekend_charge_enabled} onChange={v => update('weekend_charge_enabled', v)} />
        </div>
        {s.weekend_charge_enabled && <NumberField label="Weekend Charge Amount" value={s.weekend_charge} onChange={v => update('weekend_charge', v)} min={0} />}
        <NumberField label="Emergency Charge" value={s.emergency_charge} onChange={v => update('emergency_charge', v)} min={0} />
        <NumberField label="Holiday Charge" value={s.holiday_charge} onChange={v => update('holiday_charge', v)} min={0} />
        <NumberField label="Night Charge" value={s.night_charge} onChange={v => update('night_charge', v)} min={0} />
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Night Charge Start</label><input type="time" className="input" value={s.night_charge_start} onChange={e => update('night_charge_start', e.target.value)} /></div>
          <div><label className="label">Night Charge End</label><input type="time" className="input" value={s.night_charge_end} onChange={e => update('night_charge_end', e.target.value)} /></div>
        </div>
        <NumberField label="Peak Hour Charge" value={s.peak_hour_charge} onChange={v => update('peak_hour_charge', v)} min={0} />
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Peak Hours Start</label><input type="time" className="input" value={s.peak_hours_start} onChange={e => update('peak_hours_start', e.target.value)} /></div>
          <div><label className="label">Peak Hours End</label><input type="time" className="input" value={s.peak_hours_end} onChange={e => update('peak_hours_end', e.target.value)} /></div>
        </div>
      </div>

      {/* Cancellation Policy */}
      <SectionTitle title="Cancellation Policy" />
      <div className="card p-4 mb-4 space-y-4">
        <NumberField label="Cancellation Fee After DP Accepts" value={s.cancellation_fee_after_accept} onChange={v => update('cancellation_fee_after_accept', v)} min={0} />
        <NumberField label="Free Cancellation Cutoff (minutes before scheduled time)" value={s.cancellation_cutoff_minutes} onChange={v => update('cancellation_cutoff_minutes', v)} min={0} />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Admin Override Cancellation</p>
            <p className="text-sm text-white/40">Allow admins to cancel any request without fees</p>
          </div>
          <Toggle value={s.admin_override_cancellation} onChange={v => update('admin_override_cancellation', v)} />
        </div>
      </div>

      {/* Reschedule Policy */}
      <SectionTitle title="Reschedule Policy" />
      <div className="card p-4 mb-4 space-y-4">
        <NumberField label="Reschedule Cutoff (minutes before scheduled time)" value={s.reschedule_cutoff_minutes} onChange={v => update('reschedule_cutoff_minutes', v)} min={0} />
      </div>

      {/* Smart Reminders */}
      <SectionTitle title="Smart Reminders" />
      <div className="card p-4 mb-4 space-y-3">
        {[
          { key: 'reminder_24h' as const, label: '24 Hours Before' },
          { key: 'reminder_12h' as const, label: '12 Hours Before' },
          { key: 'reminder_2h' as const, label: '2 Hours Before' },
          { key: 'reminder_1h' as const, label: '1 Hour Before' },
          { key: 'reminder_30m' as const, label: '30 Minutes Before' },
          { key: 'reminder_15m' as const, label: '15 Minutes Before' },
          { key: 'reminder_5m' as const, label: '5 Minutes Before' },
        ].map(r => (
          <div key={r.key} className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">{r.label}</p>
            <Toggle value={s[r.key]} onChange={v => update(r.key, v)} />
          </div>
        ))}
      </div>

      {/* V3 Reservation Settings */}
      <SectionTitle title="Reservation & Payment (V3)" />
      <div className="card p-4 mb-4 space-y-4">
        <NumberField label="Confirmation Fee (advance payment)" value={s.confirmation_fee} onChange={v => update('confirmation_fee', v)} min={0} />
        <NumberField label="Reservation Search Radius (meters)" value={s.reservation_search_radius_meters} onChange={v => update('reservation_search_radius_meters', v)} min={1000} />
        <NumberField label="Payment Deadline (minutes)" value={s.payment_deadline_minutes} onChange={v => update('payment_deadline_minutes', v)} min={5} />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Auto Re-search on DP Cancel</p>
            <p className="text-sm text-white/40">Automatically search for a new DP if the reserved DP cancels</p>
          </div>
          <Toggle value={s.dp_cancel_research} onChange={v => update('dp_cancel_research', v)} />
        </div>
      </div>

      {/* Smart DP Matching */}
      <SectionTitle title="Smart Delivery Partner Matching" />
      <div className="card p-4 mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Expand Search Radius</p>
            <p className="text-sm text-white/40">Gradually expand search if no DP accepts</p>
          </div>
          <Toggle value={s.expand_search_radius} onChange={v => update('expand_search_radius', v)} />
        </div>
        {s.expand_search_radius && (
          <>
            <NumberField label="Search Radius Increment (meters)" value={s.search_radius_increment_meters} onChange={v => update('search_radius_increment_meters', v)} min={500} />
            <NumberField label="Maximum Search Radius (meters)" value={s.max_search_radius_meters} onChange={v => update('max_search_radius_meters', v)} min={1000} />
          </>
        )}
      </div>

      {/* Save Button */}
      <div className="sticky bottom-0 z-10 pb-4">
        <button onClick={handleSave} disabled={saving}
          className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold transition-all active:scale-[0.97] disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #D4F000, #D4F000)', color: '#0B0B0B', boxShadow: '0 8px 24px rgba(212,240,0,0.35)' }}>
          {saving ? (
            <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0B0B0B]/30" style={{ borderTopColor: '#0B0B0B' }} />Saving...</span>
          ) : saved ? (
            <span className="flex items-center gap-2"><Check size={18} strokeWidth={2.5} /> Saved!</span>
          ) : (
            <span className="flex items-center gap-2"><Save size={18} strokeWidth={2.5} /> Save Settings</span>
          )}
        </button>
      </div>
    </AdminShell>
  )
}

function SectionTitle({ title }: { title: string }) {
  return <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: '#C4D600' }}>{title}</p>
}

function NumberField({ label, value, onChange, min = 0, max }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input type="number" className="input" value={value} min={min} max={max} onChange={e => onChange(parseFloat(e.target.value) || 0)} />
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className="relative h-7 w-12 rounded-full transition-all"
      style={{ background: value ? '#D4F000' : 'rgba(255,255,255,0.15)' }}>
      <div className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all" style={{ left: value ? 24 : 4 }} />
    </button>
  )
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="rounded-xl px-4 py-2 text-sm font-semibold transition-all active:scale-95"
      style={active ? { background: '#D4F000', color: '#0B0B0B' } : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
      {children}
    </button>
  )
}
