import { useEffect, useState } from 'react'
import Brand from './Brand'
import { Bike, Package, MapPin, MessageCircle, ShoppingBag, Pill, Gift, Zap, Clock, TrendingUp } from 'lucide-react'

export default function Welcome({ onDone }: { onDone: () => void }) {
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setFadeOut(true), 2500)
    const t2 = setTimeout(() => onDone(), 3000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onDone])

  const floatingIcons = [
    { icon: <Bike size={28} />, delay: '0s', x: '10%', y: '15%' },
    { icon: <Package size={24} />, delay: '0.3s', x: '80%', y: '20%' },
    { icon: <MapPin size={26} />, delay: '0.6s', x: '15%', y: '70%' },
    { icon: <MessageCircle size={22} />, delay: '0.9s', x: '85%', y: '75%' },
    { icon: <ShoppingBag size={26} />, delay: '0.2s', x: '70%', y: '50%' },
    { icon: <Pill size={24} />, delay: '0.5s', x: '20%', y: '45%' },
    { icon: <Gift size={22} />, delay: '0.7s', x: '50%', y: '12%' },
    { icon: <Zap size={20} />, delay: '0.4s', x: '55%', y: '82%' },
  ]

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
      style={{ background: 'linear-gradient(160deg, #1c2a14 0%, #2a3d1c 40%, #374524 100%)' }}
    >
      {floatingIcons.map((item, i) => (
        <div
          key={i}
          className="absolute opacity-20"
          style={{
            left: item.x, top: item.y,
            color: '#808000',
            animation: `float 3s ease-in-out infinite`,
            animationDelay: item.delay,
          }}
        >
          {item.icon}
        </div>
      ))}

      <div className="animate-scale-in flex flex-col items-center">
        <Brand size="xl" showTagline />
      </div>

      <p className="mt-6 text-sm text-white/60 animate-fade-in tracking-wide">
        Welcome to pinGGet
      </p>
      <p className="mt-1 text-xs text-white/40 animate-fade-in">
        CHAT . ORDER . GET IT
      </p>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(10deg); }
        }
      `}</style>
    </div>
  )
}
