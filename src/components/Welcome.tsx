import { useEffect, useState } from 'react'
import Brand from './Brand'
import { Bike, Package, MapPin, MessageCircle, ShoppingBag, Pill, Gift, Zap } from 'lucide-react'

export default function Welcome({ onDone }: { onDone: () => void }) {
  const [fadeOut, setFadeOut] = useState(false)
  const [showContent, setShowContent] = useState(false)

  useEffect(() => {
    const t0 = setTimeout(() => setShowContent(true), 100)
    const t1 = setTimeout(() => setFadeOut(true), 2600)
    const t2 = setTimeout(() => onDone(), 3100)
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2) }
  }, [onDone])

  const floatingIcons = [
    { icon: <Bike size={26} />, delay: '0s',   x: '10%', y: '15%' },
    { icon: <Package size={22} />, delay: '0.3s', x: '80%', y: '20%' },
    { icon: <MapPin size={24} />, delay: '0.6s', x: '12%', y: '68%' },
    { icon: <MessageCircle size={20} />, delay: '0.9s', x: '85%', y: '72%' },
    { icon: <ShoppingBag size={24} />, delay: '0.2s', x: '72%', y: '52%' },
    { icon: <Pill size={22} />, delay: '0.5s', x: '18%', y: '45%' },
    { icon: <Gift size={20} />, delay: '0.7s', x: '50%', y: '12%' },
    { icon: <Zap size={18} />, delay: '0.4s', x: '55%', y: '82%' },
  ]

  return (
    <div className={`fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
      style={{ background: '#0B0B0B' }}>
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full blur-[80px]" style={{ background: 'rgba(166,179,0,0.1)' }} />
      </div>

      {floatingIcons.map((item, i) => (
        <div key={i} className="absolute" style={{ left: item.x, top: item.y, color: '#A6B300', opacity: 0.15, animation: 'float 3.5s ease-in-out infinite', animationDelay: item.delay }}>
          {item.icon}
        </div>
      ))}

      <div className={`relative z-10 flex flex-col items-center gap-3 transition-all duration-700 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <Brand size="xl" showTagline />
        <p className="text-xs tracking-widest font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Fast · Reliable · Local
        </p>
      </div>
    </div>
  )
}
