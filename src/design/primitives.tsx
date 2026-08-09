import { ReactNode, ButtonHTMLAttributes, HTMLAttributes } from 'react'
import { pg } from './tokens'

/** Full-height black screen canvas */
export function Screen({
  children,
  className = '',
  pad = true,
}: {
  children: ReactNode
  className?: string
  pad?: boolean
}) {
  return (
    <div
      className={`min-h-full w-full ${pad ? 'px-4 pt-4 pb-6' : ''} ${className}`}
      style={{ background: pg.bg, color: pg.text }}
    >
      {children}
    </div>
  )
}

export function PageTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string
  title: string
  action?: ReactNode
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && (
          <p
            className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ color: pg.text3 }}
          >
            {eyebrow}
          </p>
        )}
        <h1 className="truncate text-[28px] font-extrabold leading-none tracking-tight">{title}</h1>
      </div>
      {action}
    </div>
  )
}

export function Surface({
  children,
  className = '',
  accent = false,
  onClick,
  style,
}: {
  children: ReactNode
  className?: string
  accent?: boolean
  onClick?: () => void
  style?: React.CSSProperties
}) {
  const Comp: any = onClick ? 'button' : 'div'
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full text-left ${className}`}
      style={{
        background: pg.surface,
        border: `1px solid ${accent ? 'rgba(245,197,66,0.28)' : pg.line}`,
        borderRadius: pg.radius.lg,
        ...style,
      }}
    >
      {children}
    </Comp>
  )
}

export function CTA({
  children,
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: {
      background: pg.lime,
      color: pg.limeText,
      boxShadow: '0 10px 28px rgba(245,197,66,0.28)',
    },
    secondary: {
      background: pg.surface2,
      color: pg.text,
      border: `1px solid ${pg.lineStrong}`,
    },
    danger: {
      background: pg.danger,
      color: '#fff',
    },
    ghost: {
      background: 'transparent',
      color: pg.text2,
    },
  }
  return (
    <button
      type="button"
      className={`inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl px-5 text-sm font-extrabold transition active:scale-[0.98] disabled:opacity-40 ${className}`}
      style={styles[variant]}
      {...props}
    >
      {children}
    </button>
  )
}

export function Chip({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'lime' | 'info' | 'danger' | 'success' | 'warn'
}) {
  const map: Record<string, { bg: string; color: string }> = {
    neutral: { bg: 'rgba(255,255,255,0.06)', color: pg.text2 },
    lime: { bg: pg.limeDim, color: pg.lime },
    info: { bg: 'rgba(59,130,246,0.15)', color: '#93C5FD' },
    danger: { bg: 'rgba(255,77,79,0.15)', color: '#FCA5A5' },
    success: { bg: 'rgba(34,197,94,0.15)', color: '#86EFAC' },
    warn: { bg: 'rgba(245,165,36,0.15)', color: '#FCD34D' },
  }
  const t = map[tone]
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide"
      style={{ background: t.bg, color: t.color }}
    >
      {children}
    </span>
  )
}

export function SectionLabel({
  title,
  action,
}: {
  title: string
  action?: ReactNode
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-[17px] font-extrabold tracking-tight">{title}</h2>
      {action}
    </div>
  )
}

export function MediaTile({
  src,
  title,
  subtitle,
  onClick,
  badge,
  tall = false,
}: {
  src: string
  title: string
  subtitle?: string
  onClick?: () => void
  badge?: ReactNode
  tall?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="overflow-hidden text-left transition active:scale-[0.98]"
      style={{
        background: pg.surface,
        borderRadius: pg.radius.xl,
        border: `1px solid ${pg.line}`,
      }}
    >
      <div className="relative">
        <img
          src={src}
          alt={title}
          className="w-full object-cover"
          style={{ height: tall ? 'min(56vw, 280px)' : 'min(42vw, 180px)' }}
          draggable={false}
        />
        {badge && <div className="absolute left-3 top-3">{badge}</div>}
      </div>
      <div className="px-3.5 py-3">
        <p className="text-[15px] font-extrabold tracking-tight">{title}</p>
        {subtitle && <p className="mt-0.5 text-xs" style={{ color: pg.text3 }}>{subtitle}</p>}
      </div>
    </button>
  )
}

export function IconButton({
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`flex h-11 w-11 items-center justify-center rounded-2xl transition active:scale-90 ${className}`}
      style={{ background: pg.surface2, border: `1px solid ${pg.line}`, color: pg.text2 }}
      {...props}
    >
      {children}
    </button>
  )
}

export function Dock({ children }: { children: ReactNode }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
      <div
        className="mx-auto flex max-w-lg items-center justify-between gap-1 px-2 py-2"
        style={{
          background: 'rgba(10,12,18,0.96)',
          border: `1px solid ${pg.lineStrong}`,
          borderRadius: 28,
          boxShadow: '0 16px 48px rgba(0,0,0,0.75)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {children}
      </div>
    </nav>
  )
}

export function DockItem({
  label,
  icon,
  active,
  badge,
  onClick,
  center,
}: {
  label: string
  icon: ReactNode
  active?: boolean
  badge?: number
  onClick: () => void
  center?: boolean
}) {
  if (center) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="-mt-7 flex h-16 w-16 items-center justify-center rounded-full transition active:scale-95"
        style={{
          background: pg.lime,
          color: pg.limeText,
          boxShadow: '0 12px 32px rgba(245,197,66,0.4)',
        }}
        aria-label={label}
      >
        {icon}
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex min-w-[56px] flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5"
      style={{ background: active ? pg.limeDim : 'transparent' }}
    >
      <span style={{ color: active ? pg.lime : pg.text3 }}>{icon}</span>
      <span
        className="text-[10px] font-bold"
        style={{ color: active ? pg.lime : pg.text4 }}
      >
        {label}
      </span>
      {!!badge && badge > 0 && (
        <span className="absolute right-1 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
}

export function EmptyBlock({
  image,
  title,
  body,
  action,
}: {
  image?: string
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div
      className="flex flex-col items-center px-6 py-10 text-center"
      style={{ background: pg.surface, borderRadius: pg.radius.xl, border: `1px solid ${pg.line}` }}
    >
      {image && <img src={image} alt="" className="mb-4 h-36 w-36 object-contain" draggable={false} />}
      <p className="text-lg font-extrabold">{title}</p>
      {body && <p className="mt-1.5 text-sm" style={{ color: pg.text3 }}>{body}</p>}
      {action && <div className="mt-5 w-full">{action}</div>}
    </div>
  )
}

export function TopChrome({
  left,
  center,
  right,
}: {
  left?: ReactNode
  center?: ReactNode
  right?: ReactNode
}) {
  return (
    <div
      className="sticky top-0 z-20 mb-4 flex items-center gap-3 px-4 py-3"
      style={{
        background: 'rgba(5,5,5,0.92)',
        borderBottom: `1px solid ${pg.line}`,
        backdropFilter: 'blur(16px)',
      }}
    >
      <div className="w-12 shrink-0">{left}</div>
      <div className="min-w-0 flex-1 text-center">{center}</div>
      <div className="flex w-12 shrink-0 justify-end">{right}</div>
    </div>
  )
}
