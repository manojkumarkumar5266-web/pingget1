import { ReactNode, useEffect, useState, useCallback, createContext, useContext } from 'react'
import { Loader as Loader2, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle, CirclePause as PauseCircle, X, Info, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

// ── Spinner ──
export function Spinner({ size = 24 }: { size?: number }) {
  return <Loader2 size={size} className="animate-spin text-primary-500" />
}

export function FullScreenLoader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-4 border-primary-100 dark:border-primary-900/40" />
          <div className="absolute inset-0 h-12 w-12 animate-spin rounded-full border-4 border-transparent border-t-primary-600" />
        </div>
        <p className="text-sm font-medium text-gray-400">Loading...</p>
      </div>
    </div>
  )
}

// ── Empty State ──
export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in-up">
      {icon && (
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl glass">
          <div className="text-white/40">{icon}</div>
        </div>
      )}
      <p className="text-base font-semibold text-white">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ── Error Banner ──
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm text-red-300 animate-slide-up" style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.25)" }}>
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

// ── Avatar ──
export function Avatar({ url, name, size = 40 }: { url?: string | null; name: string; size?: number }) {
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  if (url) {
    return <img src={url} alt={name} style={{ width: size, height: size }} className="rounded-full object-cover ring-2 ring-white/20" />
  }
  return (
    <div
      className="flex items-center justify-center rounded-full font-semibold ring-2 ring-white/20" style={{ width: size, height: size, fontSize: size * 0.4, background: "rgba(110,140,69,0.3)", color: "#afc28e" }}
    >
      {initials}
    </div>
  )
}

// ── Status Badge ──
export function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    pending: 'Pending', accepted: 'Accepted', confirmed: 'Confirmed',
    shopping: 'Shopping', purchased: 'Purchased', on_the_way: 'On The Way',
    arrived: 'Arrived', delivered: 'Delivered', cash_received: 'Cash Received',
    completed: 'Completed', cancelled: 'Cancelled',
  }
  const colors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    accepted: 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300',
    confirmed: 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300',
    shopping: 'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300',
    purchased: 'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300',
    on_the_way: 'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-300',
    arrived: 'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-300',
    delivered: 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300',
    cash_received: 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300',
    completed: 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300',
    cancelled: 'bg-error-100 text-error-700 dark:bg-error-900/40 dark:text-error-300',
  }
  return (
    <span className={`badge ${colors[status] || colors.pending}`}>
      {labels[status] || status}
    </span>
  )
}

// ── Service Status Banner ──
export function ServiceStatusBanner({ cityName }: { cityName?: string | null }) {
  const [status, setStatus] = useState<{ active: boolean; paused: boolean; name: string } | null>(null)

  useEffect(() => {
    if (!cityName) return
    supabase
      .from('cities')
      .select('name, is_active, service_paused')
      .ilike('name', cityName)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setStatus({ active: data.is_active, paused: data.service_paused, name: data.name })
      })
  }, [cityName])

  if (!status) return null

  if (!status.active) {
    return (
      <div className="mb-3 flex items-center gap-2 rounded-xl px-4 py-3 text-sm text-red-300 animate-slide-up" style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.25)" }}>
        <AlertTriangle size={16} className="shrink-0" />
        <span><strong>{status.name}</strong> is currently not serviceable. We&apos;ll be available soon.</span>
      </div>
    )
  }

  if (status.paused) {
    return (
      <div className="mb-3 flex items-center gap-2 rounded-xl px-4 py-3 text-sm text-yellow-300 animate-slide-up" style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.25)" }}>
        <PauseCircle size={16} className="shrink-0" />
        <span>Service in <strong>{status.name}</strong> is temporarily paused. We&apos;ll resume soon.</span>
      </div>
    )
  }

  return (
    <div className="mb-3 flex items-center gap-2 rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-800 dark:bg-success-950/40 dark:text-success-300 animate-slide-up">
      <CheckCircle size={16} className="shrink-0" />
      <span>Service is active in <strong>{status.name}</strong>.</span>
    </div>
  )
}

// ── Star Rating ──
export function StarRating({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= Math.round(value) ? 'currentColor' : 'none'} stroke="currentColor" className={i <= Math.round(value) ? 'text-accent-400' : 'text-gray-300 dark:text-gray-600'}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ))}
    </div>
  )
}

// ── Skeleton ──
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton key={i} className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
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

// ── Snackbar / Toast Context ──
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

  const icons: Record<SnackbarType, ReactNode> = {
    success: <CheckCircle size={18} className="text-success-400" />,
    error: <AlertCircle size={18} className="text-error-400" />,
    info: <Info size={18} className="text-primary-400" />,
    warning: <AlertTriangle size={18} className="text-warning-400" />,
  }

  return (
    <SnackbarContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-24 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2 md:bottom-8">
        {items.map(item => (
          <div key={item.id} className="snackbar flex items-center gap-2.5">
            {icons[item.type]}
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

// ── Bottom Sheet ──
export function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bottom-sheet w-full max-w-md max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-200 dark:bg-gray-700" />
        {title && <h3 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">{title}</h3>}
        {children}
      </div>
    </div>
  )
}

// ── Dialog / Modal ──
export function Dialog({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; footer?: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div className="card w-full max-w-md p-6 animate-scale-in" onClick={e => e.stopPropagation()}>
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
            <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
          </div>
        )}
        {children}
        {footer && <div className="mt-4 flex gap-2">{footer}</div>}
      </div>
    </div>
  )
}

// ── Tabs ──
export function Tabs({ tabs, active, onChange }: { tabs: { key: string; label: string; count?: number }[]; active: string; onChange: (key: string) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto scrollbar-hide border-b border-gray-100 dark:border-gray-800">
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`relative shrink-0 px-4 py-2.5 text-sm font-medium transition-colors ${active === tab.key ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
        >
          {tab.label}
          {tab.count !== undefined && tab.count > 0 && (
            <span className="ml-1.5 rounded-full bg-error-500 px-1.5 text-[10px] font-bold text-white">{tab.count}</span>
          )}
          {active === tab.key && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary-600 dark:bg-primary-400" />}
        </button>
      ))}
    </div>
  )
}

// ── Chip ──
export function Chip({ label, active, onClick, icon }: { label: string; active?: boolean; onClick?: () => void; icon?: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`chip ${active ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}
    >
      {icon} {label}
    </button>
  )
}

// ── Progress Bar ──
export function ProgressBar({ value, max = 100, color = 'bg-primary-600', height = 'h-2' }: { value: number; max?: number; color?: string; height?: string }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className={`w-full ${height} rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden`}>
      <div className={`${height} ${color} rounded-full transition-all duration-500 ease-out`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ── Count Up ──
export function CountUp({ value, duration = 600, prefix = '', suffix = '' }: { value: number; duration?: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let start = 0
    const startTime = performance.now()
    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(start + (value - start) * eased))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value, duration])
  return <span>{prefix}{display.toLocaleString()}{suffix}</span>
}

// ── Section Header ──
export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-base font-bold text-gray-900 dark:text-white">{title}</h3>
      {action}
    </div>
  )
}

// ── Stat Card ──
export function StatCard({ label, value, icon, color, delay = 0 }: { label: string; value: string | number; icon: ReactNode; color: string; delay?: number }) {
  return (
    <div className="card card-hover p-4 animate-slide-up" style={{ animationDelay: `${delay}ms` }}>
      <div className={`mb-2 flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  )
}
