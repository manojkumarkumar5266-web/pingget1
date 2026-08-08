import { useEffect, useState } from 'react'
import { Images } from '../lib/customImages'
import { isDpApp } from '../lib/appTarget'
import { pg } from '../design/tokens'

/** Full-bleed branded splash — rebuilt, matches app black canvas */
export default function Welcome({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in')
  const src = isDpApp() ? Images.welcomeDp : Images.welcome

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 80)
    const t2 = setTimeout(() => setPhase('out'), 2400)
    const t3 = setTimeout(() => onDone(), 2900)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onDone])

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center overflow-hidden"
      style={{
        background: pg.bg,
        opacity: phase === 'out' ? 0 : 1,
        transition: 'opacity 0.45s ease',
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 35%, ${pg.limeDim}, transparent 50%)`,
        }}
      />
      <img
        src={src}
        alt=""
        className="relative z-10 h-full w-full object-contain"
        style={{
          background: pg.bg,
          transform: phase === 'in' ? 'scale(0.96)' : 'scale(1)',
          transition: 'transform 0.5s cubic-bezier(0.22,1,0.36,1)',
        }}
        draggable={false}
      />
    </div>
  )
}
