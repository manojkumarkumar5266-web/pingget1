import { ReactNode, useEffect, useState, useCallback, createContext, useContext, useMemo } from 'react'
import { Loader as Loader2, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle, CirclePause as PauseCircle, X, Info, AlertCircle, TrendingUp } from 'lucide-react'
import { supabase } from '../lib/supabase'

// ── Spinner ─────────────────────────────────────
export function Spinner({ size = 24 }: { size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full border-2 border-white/10" />
      <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent" style={{ borderTopColor: '#A6B300' }} />
    </div>
  )
}

export function FullScreenLoader() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#0B0B0B]">
      <div className="flex flex-col items-center gap-5">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <div className="absolute h-16 w-16 animate-spin rounded-full border-2 border-transparent" style={{ borderTopColor: '#A6B300', borderRightColor: 'rgba(166,179,0,0.3)' }} />
          <Spinner size={28} />
        </div>
      </div>
    </div>
  )
}

// ── Empty State ──────────────────────────────────
export function EmptyState({
  icon,
  illustration,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  illustration?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in-up px-4">
      {illustration ? (
        <div className="mb-6 animate-fade-in">
          {illustration}
        </div>
      ) : icon ? (
        <div
          className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl animate-float"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ color: 'rgba(255,255,255,0.2)' }}>
            {icon}
          </div>
        </div>
      ) : null}

      <p className="text-base font-bold text-white/80">{title}</p>

      {description && (
        <p
          className="mt-2 max-w-xs text-sm leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          {description}
        </p>
      )}

      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
// ── Error Banner ─────────────────────────────────
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl px-4 py-3.5 text-sm text-red-300 animate-slide-up" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-400" />
      <span className="leading-relaxed">{message}</span>
    </div>
  )
}

// ── Avatar ───────────────────────────────────────
export function Avatar({ url, name, size = 40 }: { url?: string | null; name: string; size?: number }) {
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  const cacheBustUrl = useMemo(() => {
    if (!url) return null
    return url.includes('?') ? `${url}&cb=${Date.now()}` : `${url}?cb=${Date.now()}`
  }, [url])
  if (cacheBustUrl) {
    return <img src={cacheBustUrl} alt={name} style={{ width: size, height: size }} className="rounded-full object-cover ring-2 ring-white/15" />
  }
  return (
    <div className="flex items-center justify-center rounded-full font-bold ring-2 ring-white/10"
      style={{ width: size, height: size, fontSize: size * 0.38, background: 'linear-gradient(135deg,rgba(166,179,0,0.3),rgba(166,179,0,0.15))', color: '#A6B300' }}>
      {initials}
    </div>
  )
}

// ── Status Badge ─────────────────────────────────
export function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    pending: 'Pending', accepted: 'Accepted', confirmed: 'Confirmed',
    shopping: 'Shopping', purchased: 'Purchased', on_the_way: 'On Way',
    arrived: 'Arrived', delivered: 'Delivered', cash_received: 'Cash Rcvd',
    completed: 'Completed', cancelled: 'Cancelled',
    scheduled: 'Scheduled', expired: 'Expired', rescheduled: 'Rescheduled',
  }
  const styles: Record<string, { bg: string; text: string; dot: string }> = {
    pending:      { bg: 'rgba(255,255,255,0.07)', text: 'rgba(255,255,255,0.6)', dot: '#666' },
    accepted:     { bg: 'rgba(166,179,0,0.15)',   text: '#A6B300',              dot: '#A6B300' },
    confirmed:    { bg: 'rgba(166,179,0,0.15)',   text: '#A6B300',              dot: '#A6B300' },
    shopping:     { bg: 'rgba(251,191,36,0.15)',  text: '#fbbf24',              dot: '#fbbf24' },
    purchased:    { bg: 'rgba(251,191,36,0.15)',  text: '#fbbf24',              dot: '#fbbf24' },
    on_the_way:   { bg: 'rgba(59,130,246,0.15)',  text: '#60a5fa',              dot: '#3b82f6' },
    arrived:      { bg: 'rgba(59,130,246,0.15)',  text: '#60a5fa',              dot: '#3b82f6' },
    delivered:    { bg: 'rgba(16,185,129,0.15)',  text: '#34d399',              dot: '#10b981' },
    cash_received:{ bg: 'rgba(16,185,129,0.15)',  text: '#34d399',              dot: '#10b981' },
    completed:    { bg: 'rgba(16,185,129,0.15)',  text: '#34d399',              dot: '#10b981' },
    cancelled:    { bg: 'rgba(239,68,68,0.15)',   text: '#f87171',              dot: '#ef4444' },
    scheduled:    { bg: 'rgba(99,102,241,0.15)',   text: '#818cf8',              dot: '#6366f1' },
    expired:      { bg: 'rgba(107,114,128,0.15)',  text: '#9ca3af',              dot: '#6b7280' },
    rescheduled:  { bg: 'rgba(168,85,247,0.15)',  text: '#c084fc',              dot: '#a855f7' },
  }
  const s = styles[status] || styles.pending
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: s.bg, color: s.text }}>
      <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
      {labels[status] || status}
    </span>
  )
}

// ── Service Status Banner ────────────────────────
export function ServiceStatusBanner({ cityName }: { cityName?: string | null }) {
  const [status, setStatus] = useState<{ active: boolean; paused: boolean; name: string } | null>(null)
  useEffect(() => {
    if (!cityName) return
    supabase.from('cities').select('name,is_active,service_paused').ilike('name', cityName).maybeSingle()
      .then(({ data }) => { if (data) setStatus({ active: data.is_active, paused: data.service_paused, name: data.name }) })
  }, [cityName])
  if (!status) return null
  if (!status.active) return (
    <div className="mb-3 flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm text-red-300 animate-slide-up" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>
      <AlertTriangle size={15} className="shrink-0" />
      <span><strong>{status.name}</strong> is not serviceable yet. Coming soon.</span>
    </div>
  )
  if (status.paused) return (
    <div className="mb-3 flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm text-yellow-300 animate-slide-up" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)' }}>
      <PauseCircle size={15} className="shrink-0" />
      <span>Service in <strong>{status.name}</strong> is temporarily paused.</span>
    </div>
  )
  return null
}

// ── Star Rating ──────────────────────────────────
export function StarRating({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24"
          fill={i <= Math.round(value) ? '#f59e0b' : 'none'}
          stroke={i <= Math.round(value) ? '#f59e0b' : 'rgba(255,255,255,0.2)'}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ))}
    </div>
  )
}

// ── Skeleton ─────────────────────────────────────
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <div className="skeleton h-12 w-12 rounded-2xl flex-shrink-0" />
        <div className="flex-1 space-y-2.5 pt-1">
          {Array.from({ length: lines }).map((_, i) => (
            <div key={i} className="skeleton h-3 rounded-full" style={{ width: i === lines - 1 ? '60%' : '100%' }} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function SkeletonList({ count = 3, lines = 3 }: { count?: number; lines?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} lines={lines} />)}
    </div>
  )
}

// ── Snackbar / Toast Context ─────────────────────
type SnackbarType = 'success' | 'error' | 'info' | 'warning'
type SnackbarItem = { id: string; message: string; type: SnackbarType }
const SnackbarContext = createContext<{ show: (msg: string, type?: SnackbarType) => void } | null>(null)

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<SnackbarItem[]>([])
  const show = useCallback((message: string, type: SnackbarType = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setItems(prev => [...prev, { id, message, type }])
    setTimeout(() => setItems(prev => prev.filter(i => i.id !== id)), 4000)
  }, [])
  const iconMap: Record<SnackbarType, { icon: ReactNode; border: string }> = {
    success: { icon: <CheckCircle size={16} />, border: 'rgba(16,185,129,0.4)' },
    error:   { icon: <AlertCircle size={16} className="text-red-400" />, border: 'rgba(239,68,68,0.4)' },
    info:    { icon: <Info size={16} style={{ color: '#A6B300' }} />, border: 'rgba(166,179,0,0.4)' },
    warning: { icon: <AlertTriangle size={16} className="text-yellow-400" />, border: 'rgba(245,158,11,0.4)' },
  }
  return (
    <SnackbarContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-28 left-4 right-4 z-[100] flex flex-col items-center gap-2 pointer-events-none">
        {items.map(item => (
          <div key={item.id} className="pointer-events-auto flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium text-white animate-slide-up shadow-float"
            style={{ background: 'rgba(24,24,24,0.95)', border: `1px solid ${iconMap[item.type].border}`, backdropFilter: 'blur(16px)', maxWidth: 360, width: '100%' }}>
            {iconMap[item.type].icon}
            <span>{item.message}</span>
          </div>
        ))}
      </div>
    </SnackbarContext.Provider>
  )
}

export function useSnackbar() {
  const ctx = useContext(SnackbarContext)
  if (!ctx) return { show: () => {} }
  return ctx
}

// ── Bottom Sheet ─────────────────────────────────
export function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-t-3xl animate-slide-in-bottom"
        style={{ background: '#181818', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '88vh' }}
        onClick={e => e.stopPropagation()}>
        <div className="px-5 pb-1 pt-3">
          <div className="bottom-sheet-handle" />
          {title && <h3 className="mb-4 text-lg font-bold text-white">{title}</h3>}
        </div>
        <div className="overflow-y-auto pb-8" style={{ maxHeight: 'calc(88vh - 80px)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Dialog / Modal ───────────────────────────────
export function Dialog({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; footer?: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl p-6 animate-scale-in shadow-modal"
        style={{ background: '#1E1E1E', border: '1px solid rgba(255,255,255,0.1)' }}
        onClick={e => e.stopPropagation()}>
        {title && (
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">{title}</h3>
            <button onClick={onClose} className="btn-icon h-8 w-8 rounded-xl"><X size={16} className="text-white/50" /></button>
          </div>
        )}
        {children}
        {footer && <div className="mt-5 flex gap-2">{footer}</div>}
      </div>
    </div>
  )
}

// ── Tabs ─────────────────────────────────────────
export function Tabs({ tabs, active, onChange }: { tabs: { key: string; label: string; count?: number }[]; active: string; onChange: (key: string) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
      {tabs.map(tab => (
        <button key={tab.key} onClick={() => onChange(tab.key)}
          className="relative shrink-0 px-4 py-2 text-sm font-medium transition-colors"
          style={{ color: active === tab.key ? '#A6B300' : 'rgba(255,255,255,0.4)' }}>
          {tab.label}
          {tab.count !== undefined && tab.count > 0 && (
            <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{tab.count}</span>
          )}
          {active === tab.key && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: '#A6B300' }} />
          )}
        </button>
      ))}
    </div>
  )
}

// ── Chip ─────────────────────────────────────────
export function Chip({ label, active, onClick, icon }: { label: string; active?: boolean; onClick?: () => void; icon?: ReactNode }) {
  return (
    <button onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-95"
      style={active
        ? { background: 'rgba(166,179,0,0.2)', color: '#A6B300', border: '1px solid rgba(166,179,0,0.4)' }
        : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
      {icon} {label}
    </button>
  )
}

// ── Progress Bar ─────────────────────────────────
export function ProgressBar({ value, max = 100 }: { value: number; max?: number; color?: string; height?: string }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
      <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #A6B300, #BFD400)' }} />
    </div>
  )
}

// ── Count Up ─────────────────────────────────────
export function CountUp({ value, duration = 700, prefix = '', suffix = '' }: { value: number; duration?: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const startTime = performance.now()
    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(value * eased))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value, duration])
  return <span>{prefix}{display.toLocaleString()}{suffix}</span>
}

// ── Stat Card ────────────────────────────────────
export function StatCard({ label, value, icon, color, delay = 0 }: { label: string; value: string | number; icon: ReactNode; color: string; delay?: number }) {
  return (
    <div className="card p-4 animate-slide-up" style={{ animationDelay: `${delay}ms` }}>
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-2xl ${color}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="mt-0.5 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</p>
    </div>
  )
}

// ── Section Header ───────────────────────────────
export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-base font-bold text-white">{title}</h3>
      {action}
    </div>
  )
}

// ── Earnings Card ────────────────────────────────
export function EarningsCard({ today, week, deliveries }: { today: number; week: number; deliveries: number }) {
  return (
    <div className="relative overflow-hidden rounded-3xl p-5 text-white animate-slide-up"
      style={{ background: 'linear-gradient(135deg, #2a2e00 0%, #181a00 100%)', border: '1px solid rgba(166,179,0,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(166,179,0,0.08)' }}>
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-20 blur-3xl" style={{ background: '#A6B300' }} />
      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium" style={{ color: 'rgba(166,179,0,0.7)' }}>Today's Earnings</p>
            <p className="mt-1 text-3xl font-bold text-white"><CountUp value={today} prefix="₹" /></p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'rgba(166,179,0,0.15)', border: '1px solid rgba(166,179,0,0.2)' }}>
            <TrendingUp size={22} style={{ color: '#A6B300' }} />
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <div className="flex-1 rounded-2xl px-3 py-2.5" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>This Week</p>
            <p className="mt-0.5 text-sm font-bold text-white">₹{week.toLocaleString()}</p>
          </div>
          <div className="flex-1 rounded-2xl px-3 py-2.5" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Deliveries</p>
            <p className="mt-0.5 text-sm font-bold text-white">{deliveries} today</p>
          </div>
        </div>
      </div>
    </div>
  )
}
