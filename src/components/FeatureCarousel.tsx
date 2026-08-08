import { useEffect, useRef, useState } from 'react'
import { Images } from '../lib/customImages'

type Feature = {
  title: string
  subtitle: string
  image: string
}

const FEATURES: Feature[] = [
  { title: 'Instant Delivery', subtitle: 'Get items in minutes', image: Images.feature.card1 },
  { title: 'Advance Booking', subtitle: 'Schedule up to 7 days ahead', image: Images.feature.card2 },
  { title: 'Order Your Way', subtitle: 'Describe any task', image: Images.feature.card3 },
  { title: 'Ask Anything', subtitle: 'Groceries to medicines', image: Images.feature.card4 },
  { title: 'Get Everything', subtitle: 'One partner, many items', image: Images.feature.card5 },
  { title: 'Local Partners', subtitle: 'Trusted neighbourhood DPs', image: Images.feature.card6 },
  { title: 'Track Live', subtitle: 'GPS + ETA updates', image: Images.feature.card7 },
  { title: 'Chat & Pay', subtitle: 'Chat, pay, rate', image: Images.feature.card8 },
  { title: 'Safe & Fast', subtitle: 'Verified partners', image: Images.feature.card9 },
]

const AUTO_MS = 3400
const CARD_RATIO = 0.88

/** Large full-bleed carousel — Zepto/Blinkit style, pause on touch */
export default function FeatureCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const pausedRef = useRef(false)
  const indexRef = useRef(0)

  const cardStep = () => {
    const el = scrollRef.current
    if (!el) return 0
    return el.offsetWidth * CARD_RATIO + 12
  }

  const scrollTo = (idx: number, behavior: ScrollBehavior = 'smooth') => {
    const el = scrollRef.current
    if (!el) return
    const clamped = ((idx % FEATURES.length) + FEATURES.length) % FEATURES.length
    el.scrollTo({ left: clamped * cardStep(), behavior })
    indexRef.current = clamped
    setActiveIndex(clamped)
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handleScroll = () => {
      const step = cardStep()
      if (step <= 0) return
      const idx = Math.round(el.scrollLeft / step)
      const clamped = Math.max(0, Math.min(FEATURES.length - 1, idx))
      indexRef.current = clamped
      setActiveIndex(clamped)
    }
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      if (pausedRef.current) return
      scrollTo(indexRef.current + 1)
    }, AUTO_MS)
    return () => clearInterval(timer)
  }, [])

  const pause = () => { pausedRef.current = true }
  const resume = () => { pausedRef.current = false }

  return (
    <div className="mb-7 -mx-4">
      <div className="mb-3 flex items-end justify-between px-4">
        <div>
          <h2 className="text-lg font-extrabold text-white tracking-tight">What’s new</h2>
          <p className="text-xs text-white/45">Swipe · pauses when you hold</p>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto px-4 pb-1"
        style={{
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {FEATURES.map((feature, idx) => (
          <button
            key={feature.title}
            type="button"
            onClick={() => scrollTo(idx)}
            onTouchStart={pause}
            onTouchEnd={resume}
            onTouchCancel={resume}
            onMouseDown={pause}
            onMouseUp={resume}
            onMouseLeave={resume}
            className="shrink-0 overflow-hidden rounded-[28px] text-left transition-transform active:scale-[0.98]"
            style={{
              width: `${CARD_RATIO * 100}%`,
              scrollSnapAlign: 'center',
              background: '#141414',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
            }}
          >
            <img
              src={feature.image}
              alt={feature.title}
              className="w-full object-cover"
              style={{ height: 'min(52vw, 260px)' }}
              loading="lazy"
              draggable={false}
            />
            <div className="px-4 py-3.5">
              <h3 className="text-[15px] font-extrabold text-white tracking-tight">{feature.title}</h3>
              <p className="mt-0.5 text-xs text-white/50">{feature.subtitle}</p>
            </div>
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-1.5 px-4">
        {FEATURES.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => scrollTo(idx)}
            className="rounded-full transition-all"
            style={{
              width: idx === activeIndex ? 22 : 7,
              height: 7,
              background: idx === activeIndex ? '#C0D900' : 'rgba(255,255,255,0.18)',
            }}
          />
        ))}
      </div>
    </div>
  )
}
