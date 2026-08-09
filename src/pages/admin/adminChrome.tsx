import { ReactNode } from 'react'
import { Search } from 'lucide-react'
import { pg } from '../../design/tokens'

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="p-4 md:p-8" style={{ background: pg.bg, minHeight: '100%' }}>
      {children}
    </div>
  )
}

export function AdminHeader({
  eyebrow = 'Admin',
  title,
  action,
}: {
  eyebrow?: string
  title: string
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-3 animate-fade-in-up">
      <div className="min-w-0">
        <p className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.16em]" style={{ color: pg.lime }}>
          {eyebrow}
        </p>
        <h1 className="truncate text-[28px] font-extrabold tracking-tight text-white">{title}</h1>
      </div>
      {action}
    </div>
  )
}

export function FilterPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: T[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {options.map(f => (
        <button
          key={f}
          type="button"
          onClick={() => onChange(f)}
          className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold capitalize transition-all active:scale-95"
          style={
            value === f
              ? { background: pg.lime, color: pg.limeText }
              : { background: pg.surface2, color: pg.text3, border: `1px solid ${pg.line}` }
          }
        >
          {f}
        </button>
      ))}
    </div>
  )
}

export function AdminSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="relative">
      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: pg.text4 }} />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || 'Search...'}
        className="input pl-10"
      />
    </div>
  )
}

export const statusTone: Record<string, { bg: string; color: string }> = {
  active: { bg: 'rgba(34,197,94,0.15)', color: '#86EFAC' },
  approved: { bg: 'rgba(34,197,94,0.15)', color: '#86EFAC' },
  pending: { bg: 'rgba(245,165,36,0.15)', color: '#FCD34D' },
  rejected: { bg: 'rgba(255,77,79,0.15)', color: '#FCA5A5' },
  suspended: { bg: 'rgba(245,165,36,0.15)', color: '#FCD34D' },
  banned: { bg: 'rgba(255,77,79,0.15)', color: '#FCA5A5' },
  completed: { bg: 'rgba(34,197,94,0.15)', color: '#86EFAC' },
  cancelled: { bg: 'rgba(255,77,79,0.15)', color: '#FCA5A5' },
}

export function StatusPill({ status }: { status: string }) {
  const t = statusTone[status] || { bg: pg.surface2, color: pg.text2 }
  return (
    <span
      className="inline-flex shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide"
      style={{ background: t.bg, color: t.color }}
    >
      {status}
    </span>
  )
}

export function DrawerShell({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="absolute bottom-0 left-0 right-0 max-h-[90vh] overflow-y-auto rounded-t-[28px]"
        style={{ background: pg.surface, borderTop: `1px solid ${pg.line}` }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full" style={{ background: pg.lineStrong }} />
        </div>
        <div className="px-5 pb-10 pt-2">{children}</div>
      </div>
    </div>
  )
}

export function ActionBtn({
  children,
  tone = 'lime',
  onClick,
  disabled,
}: {
  children: ReactNode
  tone?: 'lime' | 'success' | 'warn' | 'danger' | 'neutral'
  onClick?: () => void
  disabled?: boolean
}) {
  const map = {
    lime: { bg: pg.limeDim, border: 'rgba(196,214,0,0.28)', color: pg.lime },
    success: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.25)', color: '#86EFAC' },
    warn: { bg: 'rgba(245,165,36,0.12)', border: 'rgba(245,165,36,0.25)', color: '#FCD34D' },
    danger: { bg: 'rgba(255,77,79,0.12)', border: 'rgba(255,77,79,0.25)', color: '#FCA5A5' },
    neutral: { bg: pg.surface2, border: pg.line, color: pg.text2 },
  }
  const t = map[tone]
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50"
      style={{ background: t.bg, border: `1px solid ${t.border}`, color: t.color }}
    >
      {children}
    </button>
  )
}

export function InfoPanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl p-4 space-y-2 ${className}`}
      style={{ background: pg.surface2, border: `1px solid ${pg.line}` }}
    >
      {children}
    </div>
  )
}
