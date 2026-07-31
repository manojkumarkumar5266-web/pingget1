import { ReactNode } from 'react'
import Brand from './Brand'

type Props = { children: ReactNode; title?: string; subtitle?: string; showBrand?: boolean }

export default function AuthLayout({ children, title, subtitle }: Props) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-start overflow-hidden bg-[#0B0B0B]">
      {/* Background ambient */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full blur-[120px]" style={{ background: 'rgba(166,179,0,0.07)' }} />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full blur-[120px]" style={{ background: 'rgba(166,179,0,0.05)' }} />
        <div className="absolute top-1/3 right-1/4 h-64 w-64 rounded-full blur-[100px]" style={{ background: 'rgba(59,130,246,0.04)' }} />
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }} />
      </div>

      <div className="relative z-10 flex min-h-screen w-full flex-col items-center justify-start px-5 py-10">
        {/* Brand header — name only, no logo */}
        <div className="mb-8 flex flex-col items-center animate-fade-in-up">
          <Brand size="lg" showTagline />
        </div>

        {/* Card */}
        <div className="w-full max-w-md animate-slide-up">
          <div className="rounded-3xl p-6 shadow-modal"
            style={{ background: '#181818', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}>
            {(title || subtitle) && (
              <div className="mb-6">
                {title && <h2 className="text-2xl font-bold text-white">{title}</h2>}
                {subtitle && <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{subtitle}</p>}
              </div>
            )}
            {children}
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-xs text-center animate-fade-in" style={{ color: 'rgba(255,255,255,0.2)' }}>
          © {new Date().getFullYear()} PingGET — Fast, reliable local deliveries
        </p>
      </div>
    </div>
  )
}
