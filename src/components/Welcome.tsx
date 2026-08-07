import { useEffect, useState } from 'react'
import { Images } from '../lib/customImages'

export default function Welcome({ onDone }: { onDone: () => void }) {
  const [fadeOut, setFadeOut] = useState(false)
  const [showContent, setShowContent] = useState(false)

  useEffect(() => {
    const t0 = setTimeout(() => setShowContent(true), 80)
    const t1 = setTimeout(() => setFadeOut(true), 2400)
    const t2 = setTimeout(() => onDone(), 2900)
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2) }
  }, [onDone])

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
      style={{ background: '#0B0B0B' }}
    >
      <div
        className={`relative z-10 flex w-full max-w-sm flex-col items-center px-6 transition-all duration-500 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
      >
        <img
          src={Images.welcome}
          alt="Hello welcome to pinGGet"
          className="w-full max-h-[70vh] object-contain"
          draggable={false}
        />
      </div>
    </div>
  )
}
