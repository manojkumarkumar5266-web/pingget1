import { ReactNode } from 'react'
import { pg } from '../design/tokens'

/** Rebuilt auth chrome — no logo clutter, commerce card on black */
export default function AuthLayout({
  children,
  title,
  subtitle,
}: {
  children: ReactNode
  title?: string
  subtitle?: string
  showBrand?: boolean
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-5 py-10" style={{ background: pg.bg }}>
      <div className="mb-8 text-center">
        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.22em]" style={{ color: pg.lime }}>PingGET</p>
        {title && <h1 className="text-[28px] font-extrabold tracking-tight">{title}</h1>}
        {subtitle && <p className="mt-2 text-sm" style={{ color: pg.text3 }}>{subtitle}</p>}
      </div>
      <div
        className="w-full max-w-md rounded-[28px] p-5"
        style={{ background: pg.surface, border: `1px solid ${pg.line}` }}
      >
        {children}
      </div>
    </div>
  )
}
