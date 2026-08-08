import { useEffect, useRef, useState } from 'react'
import { Images } from '../lib/customImages'

type Feature = {
  title: string
  subtitle: string
  image: string
  accent: string
}

const FEATURES: Feature[] = [
  { title: 'Instant Delivery', subtitle: 'Get items delivered in minutes by local partners', image: Images.feature.card1, accent: '#FBBF24' },
  { title: 'Advance Booking', subtitle: 'Schedule deliveries up to 7 days ahead', image: Images.feature.card2, accent: '#60A5FA' },
  { title: 'Order Your Way', subtitle: 'Describe any task — partners handle the rest', image: Images.feature.card3, accent: '#A78BFA' },
  { title: 'Ask Anything', subtitle: 'Groceries, documents, medicines — just ask', image: Images.feature.card4, accent: '#2DD4BF' },
  { title: 'Get Everything', subtitle: 'Multiple items, one delivery partner', image: Images.feature.card5, accent: '#FB923C' },
  { title: 'Local Partners', subtitle: 'Trusted partners from your neighbourhood', image: Images.feature.card6, accent: '#34D399' },
  { title: 'Track Live', subtitle: 'Real-time GPS with ETA and status updates', image: Images.feature.card7, accent: '#C4D600' },
  { title: 'Chat & Pay', subtitle: 'WhatsApp-style chat, then pay and rate', image: Images.feature.card8, accent: '#F472B6' },
  { title: 'Safe & Fast', subtitle: 'Verified partners and clear delivery steps', image: Images.feature.card9, accent: '#A6B300' },
]

const AUTO_MS = 3200

/**
 * 9-card carousel — auto-loops left→right, pauses while a finger touches a card.
 */
export default function FeatureCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const pausedRef = useRef(false)
  const indexRef = useRef(0)

  const scrollTo = (idx: number, behavior: ScrollBehavior = 'smooth') => {
    const el = scrollRef.current
    if (!el) return
    const cardWidth = el.offsetWidth * 0.72
    const clamped = ((idx % FEATURES.length) + FEATURES.length) % FEATURES.length
    el.scrollTo({ left: clamped * cardWidth, behavior })
    indexRef.current = clamped
    setActiveIndex(clamped)
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handleScroll = () => {
      const cardWidth = el.offsetWidth * 0.72
      if (cardWidth <= 0) return
      const idx = Math.round(el.scrollLeft / cardWidth)
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
    <div className="mb-6">
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2"
        style={{
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {FEATURES.map((feature, idx) => (
          <div
            key={feature.title}
            onClick={() => scrollTo(idx)}
            onTouchStart={pause}
            onTouchEnd={resume}
            onTouchCancel={resume}
            onMouseDown={pause}
            onMouseUp={resume}
            onMouseLeave={resume}
            className="shrink-0 rounded-3xl p-4 transition-transform active:scale-[0.97]"
            style={{
              width: '72%',
              scrollSnapAlign: 'center',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="mb-3 overflow-hidden rounded-2xl" style={{ background: `${feature.accent}22` }}>
              <img
                src={feature.image}
                alt={feature.title}
                className="w-full h-28 object-cover"
                loading="lazy"
                draggable={false}
              />
            </div>
            <h3 className="text-sm font-bold" style={{ color: feature.accent }}>{feature.title}</h3>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>{feature.subtitle}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-center gap-1.5">
        {FEATURES.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => scrollTo(idx)}
            className="rounded-full transition-all"
            style={{
              width: idx === activeIndex ? 20 : 6,
              height: 6,
              background: idx === activeIndex ? '#A6B300' : 'rgba(255,255,255,0.15)',
            }}
          />
        ))}
      </div>
    </div>
  )
}
