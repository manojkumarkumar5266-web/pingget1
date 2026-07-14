import { ReactNode } from 'react'
import { MessageCircle, MapPin, Bike, Package } from 'lucide-react'
import Brand from './Brand'
import Watermark from './Watermark'

type AuthLayoutProps = {
  children: ReactNode
  brandSize?: 'sm' | 'md' | 'lg' | 'xl'
  showBrand?: boolean
}

export default function AuthLayout({ children, brandSize = 'lg', showBrand = true }: AuthLayoutProps) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <Watermark />
      <div className="flex min-h-screen w-full flex-col justify-between px-4 py-3">
        {showBrand && (
          <div className="text-center pt-4">
            <Brand size={brandSize} />
          </div>
        )}

        <div className="flex-1 flex flex-col justify-center pt-2 pb-2">{children}</div>

        <div className="mt-2 text-center text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
          By continuing you agree to our Terms &amp; Privacy Policy
        </div>

        <div className="mt-2 w-full overflow-hidden rounded-2xl glass">
          <div className="grid grid-cols-4">
            {[
              { icon: <MessageCircle size={22} />, title: 'CHAT', sub: 'Easy Conversation' },
              { icon: <MapPin size={22} />, title: 'LOCATION', sub: 'Live Tracking' },
              { icon: <Bike size={22} />, title: 'DELIVERY', sub: 'Fast & Reliable' },
              { icon: <Package size={22} />, title: 'GET IT', sub: 'At Your Doorstep' },
            ].map((f, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-1 px-1 py-3 text-center"
                style={{ borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}
              >
                <span style={{ color: '#8fa964' }}>{f.icon}</span>
                <p className="mt-0.5 text-[10px] font-black tracking-wide text-white">{f.title}</p>
                <p className="text-[8px] font-semibold leading-tight" style={{ color: 'rgba(255,255,255,0.65)' }}>{f.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
