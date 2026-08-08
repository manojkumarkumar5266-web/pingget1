import { useEffect, useState } from 'react'
import { Images } from '../lib/customImages'
import { isDpApp } from '../lib/appTarget'

/** Full-bleed welcome on solid app black — matches #0B0B0B chrome */
export default function Welcome({ onDone }: { onDone: () => void }) {
  const [fadeOut, setFadeOut] = useState(false)
  const [showContent, setShowContent] = useState(false)
  const welcomeSrc = isDpApp() ? Images.welcomeDp : Images.welcome

  useEffect(() => {
    const t0 = setTimeout(() => setShowContent(true), 60)
    const t1 = setTimeout(() => setFadeOut(true), 2600)
    const t2 = setTimeout(() => onDone(), 3100)
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2) }
  }, [onDone])

  return (
    <div
      className={`fixed inset-0 z-[200] overflow-hidden transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
      style={{ background: '#0B0B0B' }}
    >
      {/* Soft radial so art edges blend into app black */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 40%, rgba(166,179,0,0.08), transparent 55%), #0B0B0B',
        }}
      />
      <div
        className={`relative z-10 flex h-full w-full flex-col items-center justify-center px-0 transition-all duration-500 ${
          showContent ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98]'
        }`}
      >
        <img
          src={welcomeSrc}
          alt=""
          className="h-full w-full max-h-[100dvh] object-contain"
          style={{ background: '#0B0B0B' }}
          draggable={false}
        />
      </div>
    </div>
  )
}
