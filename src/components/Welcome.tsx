import { useEffect, useState } from 'react'
import Brand from './Brand'
import { MascotWave } from './Illustrations'

export default function Welcome({ onDone }: { onDone: () => void }) {
  const [fadeOut, setFadeOut] = useState(false)
  const [showContent, setShowContent] = useState(false)

  useEffect(() => {
    const t0 = setTimeout(() => setShowContent(true), 100)
    const t1 = setTimeout(() => setFadeOut(true), 2600)
    const t2 = setTimeout(() => onDone(), 3100)
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2) }
  }, [onDone])

  return (
    <div className={`fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
      style={{ background: '#0B0B0B' }}>
      {/* Decorative glow */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 40%, rgba(166,179,0,0.08) 0%, transparent 60%)' }} />

      {/* Floating accent dots */}
      <div className="absolute top-[20%] left-[15%] h-2 w-2 rounded-full animate-float" style={{ background: 'rgba(166,179,0,0.3)' }} />
      <div className="absolute top-[30%] right-[18%] h-1.5 w-1.5 rounded-full animate-float" style={{ background: 'rgba(166,179,0,0.2)', animationDelay: '0.5s' }} />
      <div className="absolute bottom-[25%] left-[22%] h-2 w-2 rounded-full animate-float" style={{ background: 'rgba(166,179,0,0.25)', animationDelay: '1s' }} />

      <div className={`relative z-10 flex flex-col items-center gap-4 transition-all duration-700 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        {/* Mascot */}
        <MascotWave className="w-40 h-48" />
        <Brand size="xl" showTagline />
        <p className="text-xs tracking-widest font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Fast · Reliable · Local
        </p>
      </div>
    </div>
  )
}
