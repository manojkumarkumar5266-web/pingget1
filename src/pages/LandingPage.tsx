import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Brand from '../components/Brand'
import { HeroScene, MascotHandoff } from '../components/Illustrations'
import {
  ArrowRight, MapPin, Shield, Zap, MessageCircle,
} from 'lucide-react'

export default function LandingPage() {
  const navigate = useNavigate()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0B0B0B]">
      {/* Background illustration */}
      <div className="absolute inset-0">
        <HeroScene className="h-full w-full object-cover" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col px-4 py-4">
        <div className={`pt-6 text-center transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
          <Brand size="xl" showTagline />
        </div>

        <div className="flex flex-1 flex-col justify-center max-w-md mx-auto w-full">
          {/* Mascot illustration */}
          <div className={`mb-6 flex justify-center transition-all duration-700 delay-200 ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
            <MascotHandoff className="w-64 h-48" />
          </div>

          {/* Hero tagline */}
          <div className={`mb-6 text-center transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <h2 className="text-2xl font-extrabold text-white leading-tight">
              Get anything delivered.<br />Or earn delivering.
            </h2>
            <p className="mt-3 text-sm text-white/60">
              Order groceries, medicines, parcels and more — or earn by delivering in your neighbourhood.
            </p>
          </div>

          {/* CTA */}
          <div className={`transition-all duration-700 delay-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <button
              onClick={() => navigate('/auth')}
              className="w-full rounded-2xl py-4 text-base font-bold text-white shadow-lg transition-all active:scale-95"
              style={{ backgroundColor: '#A6B300', color: '#0B0B0B', boxShadow: '0 8px 24px rgba(166,179,0,0.35)' }}
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
              <div key={i} className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur-sm">
                <span style={{ color: '#A6B300' }}>{f.icon}</span>
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
