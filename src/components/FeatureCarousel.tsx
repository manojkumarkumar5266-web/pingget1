import { useRef, useState, useEffect } from 'react'
import {
  FeatureInstantDelivery, FeatureAdvanceBooking, FeatureOrderYourWay,
  FeatureAskAnything, FeatureGetEverything, FeatureLocalPartners, FeatureTrackLive,
} from './Illustrations'

type Feature = {
  title: string
  subtitle: string
  illustration: React.FC<React.SVGProps<SVGSVGElement>>
  color: string
  textColor: string
}

const FEATURES: Feature[] = [
  {
    title: 'Instant Delivery',
    subtitle: 'Get items delivered in ~10 minutes by local partners',
    illustration: FeatureInstantDelivery,
    color: 'rgba(251,191,36,0.12)',
    textColor: '#FBBF24',
  },
  {
    title: 'Advance Booking',
    subtitle: 'Schedule deliveries up to 7 days ahead at your preferred time',
    illustration: FeatureAdvanceBooking,
    color: 'rgba(59,130,246,0.12)',
    textColor: '#60A5FA',
  },
  {
    title: 'Order Your Way',
    subtitle: 'Custom requests — describe any task and we will handle it',
    illustration: FeatureOrderYourWay,
    color: 'rgba(139,92,246,0.12)',
    textColor: '#A78BFA',
  },
  {
    title: 'Ask Anything',
    subtitle: 'From groceries to documents — ask, and partners will fetch',
    illustration: FeatureAskAnything,
    color: 'rgba(20,184,166,0.12)',
    textColor: '#2DD4BF',
  },
  {
    title: 'Get Everything',
    subtitle: 'Multiple items, multiple stops — one delivery partner',
    illustration: FeatureGetEverything,
    color: 'rgba(249,115,22,0.12)',
    textColor: '#FB923C',
  },
  {
    title: 'Local Partners',
    subtitle: 'Trusted delivery partners from your own neighbourhood',
    illustration: FeatureLocalPartners,
    color: 'rgba(16,185,129,0.12)',
    textColor: '#34D399',
  },
  {
    title: 'Track Live',
    subtitle: 'Real-time GPS tracking with ETA and live status updates',
    illustration: FeatureTrackLive,
    color: 'rgba(166,179,0,0.12)',
    textColor: '#C4D600',
  },
]

export default function FeatureCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handleScroll = () => {
      const cardWidth = el.offsetWidth * 0.72
      const idx = Math.round(el.scrollLeft / cardWidth)
      setActiveIndex(Math.max(0, Math.min(FEATURES.length - 1, idx)))
    }
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollTo = (idx: number) => {
    const el = scrollRef.current
    if (!el) return
    const cardWidth = el.offsetWidth * 0.72
    el.scrollTo({ left: idx * cardWidth, behavior: 'smooth' })
  }

  return (
    <div className="mb-6 animate-slide-up" style={{ animationDelay: '80ms' }}>
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
        {FEATURES.map((feature, idx) => {
          const Illus = feature.illustration
          return (
            <div
              key={feature.title}
              onClick={() => scrollTo(idx)}
              className="shrink-0 rounded-3xl p-4 transition-all active:scale-[0.97]"
              style={{
                width: '72%',
                scrollSnapAlign: 'center',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div className="mb-3 flex items-center justify-center rounded-2xl py-2" style={{ background: feature.color }}>
                <Illus className="w-full max-w-[180px] h-auto" />
              </div>
              <h3 className="text-sm font-bold" style={{ color: feature.textColor }}>{feature.title}</h3>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>{feature.subtitle}</p>
            </div>
          )
        })}
      </div>
      {/* Dot indicators */}
      <div className="mt-2 flex items-center justify-center gap-1.5">
        {FEATURES.map((_, idx) => (
          <button
            key={idx}
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
