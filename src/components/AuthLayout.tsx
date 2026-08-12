import { ReactNode } from 'react'
import Brand from './Brand'
import { pg } from '../design/tokens'

/** Auth chrome — pinGGet wordmark with tagline */
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
      <div className="mb-8 flex flex-col items-center text-center">
        <Brand size="lg" showTagline className="mb-4" />
        {title && <h1 className="text-[28px] font-extrabold tracking-tight">{title}</h1>}
        {subtitle && <p className="mt-2 text-sm" style={{ color: pg.text3 }}>{subtitle}</p>}
      </div>
      <div
        className="w-full max-w-md rounded-[28px] p-5"
        style={{ background: pg.surface, color: pg.ink, border: `1px solid rgba(15, 40, 25, 0.08)` }}
      >
        {children}
      </div>
    </div>
  )
}
