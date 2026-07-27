import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Brand from '../components/Brand'
import Watermark from '../components/Watermark'
import {
  Bike, Package, MapPin, MessageCircle, ShoppingBag, Pill, Gift, Zap,
  ArrowRight, User, Wallet, Shield,
} from 'lucide-react'

const FLOATING_ICONS = [
  { icon: <Bike size={28} />, delay: '0s', x: '8%', y: '12%', dur: '3s' },
  { icon: <Package size={24} />, delay: '0.4s', x: '85%', y: '18%', dur: '3.5s' },
  { icon: <MapPin size={26} />, delay: '0.8s', x: '12%', y: '68%', dur: '2.8s' },
  { icon: <MessageCircle size={22} />, delay: '0.2s', x: '88%', y: '72%', dur: '3.2s' },
  { icon: <ShoppingBag size={26} />, delay: '0.6s', x: '75%', y: '45%', dur: '3s' },
  { icon: <Pill size={24} />, delay: '0.3s', x: '18%', y: '42%', dur: '3.4s' },
  { icon: <Gift size={22} />, delay: '0.9s', x: '50%', y: '10%', dur: '2.6s' },
  { icon: <Zap size={20} />, delay: '0.5s', x: '60%', y: '80%', dur: '3.1s' },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  return (
    <div className="relative min-h-screen overflow-hidden">
      <Watermark />

      {FLOATING_ICONS.map((item, i) => (
        <div key={i} className="pointer-events-none absolute opacity-25"
          style={{ left: item.x, top: item.y, color: '#a0b060', animation: `floatIcon ${item.dur} ease-in-out infinite`, animationDelay: item.delay }}>
          {item.icon}
        </div>
      ))}

      <style>{`
        @keyframes floatIcon {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-25px) rotate(15deg); }
        }
      `}</style>

      <div className="relative z-10 flex min-h-screen flex-col px-4 py-4">
        <div className={`pt-6 text-center transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
          <Brand size="xl" showTagline />
        </div>

        <div className="flex flex-1 flex-col justify-center max-w-md mx-auto w-full">
          {/* Description */}
          <div className={`mb-6 text-center transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <p className="text-sm text-white/60">
              Order groceries, medicines, parcels and more — or earn by delivering in your neighbourhood.
            </p>
          </div>

          {/* CTA */}
          <div className={`transition-all duration-700 delay-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <button
              onClick={() => navigate('/auth')}
              className="w-full rounded-xl py-4 text-base font-bold text-white shadow-lg transition-all active:scale-95"
              style={{ backgroundColor: '#808000' }}
            >
              Get Started <ArrowRight size={18} className="inline" />
            </button>
          </div>

          {/* Feature pills */}
          <div className={`mt-5 flex flex-wrap justify-center gap-2 transition-all duration-700 delay-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
            {[
              { icon: <MessageCircle size={12} />, label: 'Chat' },
              { icon: <MapPin size={12} />, label: 'Live Tracking' },
              { icon: <Shield size={12} />, label: 'Secure' },
              { icon: <Zap size={12} />, label: 'Fast Delivery' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                <span style={{ color: '#a0b060' }}>{f.icon}</span>
                <span className="text-[11px] font-medium text-white/70">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 text-center text-xs text-white/40">
          By continuing you agree to our Terms &amp; Privacy Policy
        </div>


      </div>
    </div>
  )
}
