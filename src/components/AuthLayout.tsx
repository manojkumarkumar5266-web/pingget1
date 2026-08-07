import { ReactNode } from 'react'
import Brand from './Brand'

type Props = { children: ReactNode; title?: string; subtitle?: string; showBrand?: boolean }

export default function AuthLayout({ children, title, subtitle }: Props) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-start overflow-hidden bg-[#0B0B0B]">
      <div className="relative z-10 flex min-h-screen w-full flex-col items-center justify-start px-5 py-10">
        <div className="mb-8 flex flex-col items-center">
          <Brand size="lg" showTagline={false} />
        </div>

        <div className="w-full max-w-md">
          <div
            className="rounded-3xl p-6"
            style={{ background: '#181818', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {(title || subtitle) && (
              <div className="mb-6">
                {title && <h2 className="text-2xl font-bold text-white">{title}</h2>}
                {subtitle && <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{subtitle}</p>}
              </div>
            )}
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
