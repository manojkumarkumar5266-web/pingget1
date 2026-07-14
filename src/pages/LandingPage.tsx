import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Brand from '../components/Brand'
import Watermark from '../components/Watermark'
import {
  Bike, Package, MapPin, MessageCircle, ShoppingBag, Pill, Gift, Zap,
  TrendingUp, Clock, Shield, ArrowRight, User, Wallet,
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

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div
      className="relative min-h-screen overflow-hidden"
    >
      <Watermark />

      {/* Floating animated icons */}
      {FLOATING_ICONS.map((item, i) => (
        <div
          key={i}
          className="pointer-events-none absolute opacity-25"
          style={{
            left: item.x, top: item.y,
            color: '#a0b060',
            animation: `floatIcon ${item.dur} ease-in-out infinite`,
            animationDelay: item.delay,
          }}
        >
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
        {/* Brand */}
        <div className={`pt-6 text-center transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
          <Brand size="xl" showTagline />
        </div>

        {/* Main content */}
        <div className="flex flex-1 flex-col justify-center max-w-md mx-auto w-full">
          {/* User side */}
          <div className={`mb-4 transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <User size={20} className="text-white" />
                <h2 className="text-base font-bold text-white">For Users</h2>
              </div>
              <p className="text-sm text-white/60 mb-4">
                Chat with delivery partners, order groceries, medicines, parcels, and more — delivered to your doorstep.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => navigate('/auth')}
                  className="flex-1 rounded-xl py-3 text-sm font-bold text-white shadow-lg transition-all active:scale-95"
                  style={{ backgroundColor: '#808000' }}
                >
                  Sign In
                </button>
                <button
                  onClick={() => navigate('/auth')}
                  className="flex-1 rounded-xl border border-white/20 bg-white/10 py-3 text-sm font-bold text-white transition-all active:scale-95 hover:bg-white/20"
                >
                  Sign Up
                </button>
              </div>
            </div>
          </div>

          {/* DP side - more elaborate */}
          <div className={`transition-all duration-700 delay-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <div className="rounded-2xl border-2 p-5 relative overflow-hidden" style={{ borderColor: 'rgba(128,128,0,0.4)', background: 'linear-gradient(135deg, rgba(58,82,40,0.6) 0%, rgba(74,104,48,0.4) 100%)' }}>
              {/* Badge */}
              <div className="absolute top-0 right-0 px-3 py-1 text-[10px] font-black tracking-wide text-white rounded-bl-xl" style={{ backgroundColor: '#808000' }}>
                EARN MONEY
              </div>

              <div className="flex items-center gap-2 mb-2">
                <Bike size={20} className="text-white" />
                <h2 className="text-base font-bold text-white">For Delivery Partners</h2>
              </div>

              <p className="text-sm text-white/70 mb-4">
                Become a delivery partner. Earn money by delivering groceries, medicines, and parcels in your neighbourhood.
              </p>

              {/* Benefits grid */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { icon: <TrendingUp size={18} />, label: 'Earn' },
                  { icon: <Clock size={18} />, label: 'Flexible' },
                  { icon: <Wallet size={18} />, label: 'Instant Pay' },
                ].map((b, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 rounded-xl bg-white/10 px-2 py-3">
                    <span style={{ color: '#a0b060' }}>{b.icon}</span>
                    <span className="text-[10px] font-semibold text-white/80">{b.label}</span>
                  </div>
                ))}
              </div>

              {/* Quote */}
              <div className="mb-4 rounded-xl bg-black/20 px-3 py-2.5">
                <p className="text-xs italic text-white/60">
                  "Join hundreds of partners earning daily by helping their neighbours get what they need."
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => navigate('/dp-signup')}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-bold text-white shadow-lg transition-all active:scale-95"
                  style={{ backgroundColor: '#808000' }}
                >
                  Sign Up <ArrowRight size={16} />
                </button>
                <button
                  onClick={() => navigate('/auth')}
                  className="flex-1 rounded-xl border border-white/20 bg-white/10 py-3 text-sm font-bold text-white transition-all active:scale-95 hover:bg-white/20"
                >
                  Sign In
                </button>
              </div>
            </div>
          </div>

          {/* Feature pills */}
          <div className={`mt-4 flex flex-wrap justify-center gap-2 transition-all duration-700 delay-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
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

        {/* Footer */}
        <div className="mt-4 text-center text-xs text-white/40">
          By continuing you agree to our Terms &amp; Privacy Policy
        </div>

        {/* Feature strip */}
        <div className="mt-2 w-full overflow-hidden rounded-2xl border border-white/10" style={{ background: 'linear-gradient(135deg, #3a5228 0%, #4a6830 100%)' }}>
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
                style={{ borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}
              >
                <span className="text-white">{f.icon}</span>
                <p className="mt-0.5 text-[10px] font-black tracking-wide text-white">{f.title}</p>
                <p className="text-[8px] font-semibold leading-tight text-white/80">{f.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
