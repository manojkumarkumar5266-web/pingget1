import { useEffect, useRef, useState } from 'react'
import { Images } from '../lib/customImages'
import { pg } from '../design/tokens'

const FEATURES = [
  { title: 'Instant Delivery', subtitle: 'Local partners in minutes', image: Images.feature.card1 },
  { title: 'Advance Booking', subtitle: 'Plan up to 7 days ahead', image: Images.feature.card2 },
  { title: 'Order Your Way', subtitle: 'Describe any custom task', image: Images.feature.card3 },
  { title: 'Ask Anything', subtitle: 'Groceries to medicines', image: Images.feature.card4 },
  { title: 'Get Everything', subtitle: 'Multi-item, one partner', image: Images.feature.card5 },
  { title: 'Local Partners', subtitle: 'Trusted neighbourhood DPs', image: Images.feature.card6 },
  { title: 'Live Tracking', subtitle: 'Street map + status steps', image: Images.feature.card7 },
  { title: 'Chat & Pay', subtitle: 'Talk, pay, rate in-app', image: Images.feature.card8 },
  { title: 'Safe & Fast', subtitle: 'Verified delivery partners', image: Images.feature.card9 },
]

const WIDTH = 0.9

/** Rebuilt media carousel — full-bleed commerce tiles */
export default function FeatureCarousel() {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const paused = useRef(false)
  const idx = useRef(0)

  const step = () => (ref.current ? ref.current.offsetWidth * WIDTH + 14 : 0)

  const go = (i: number, behavior: ScrollBehavior = 'smooth') => {
    const el = ref.current
    if (!el) return
    const n = ((i % FEATURES.length) + FEATURES.length) % FEATURES.length
    el.scrollTo({ left: n * step(), behavior })
    idx.current = n
    setActive(n)
  }

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onScroll = () => {
      const s = step()
      if (!s) return
      const n = Math.max(0, Math.min(FEATURES.length - 1, Math.round(el.scrollLeft / s)))
      idx.current = n
      setActive(n)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const t = setInterval(() => { if (!paused.current) go(idx.current + 1) }, 3400)
    return () => clearInterval(t)
  }, [])

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-end justify-between px-1">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em]" style={{ color: pg.lime }}>Discover</p>
          <h2 className="text-[20px] font-extrabold tracking-tight">What’s on PingGET</h2>
        </div>
      </div>
      <div
        ref={ref}
        className="-mx-4 flex gap-3.5 overflow-x-auto px-4"
        style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
        onTouchStart={() => { paused.current = true }}
        onTouchEnd={() => { paused.current = false }}
      >
        {FEATURES.map((f, i) => (
          <button
            key={f.title}
            type="button"
            onClick={() => go(i)}
            className="shrink-0 overflow-hidden text-left"
            style={{
              width: `${WIDTH * 100}%`,
              scrollSnapAlign: 'center',
              background: pg.surface,
              borderRadius: 28,
              border: `1px solid ${pg.line}`,
            }}
          >
            <img
              src={f.image}
              alt={f.title}
              className="w-full object-cover"
              style={{ height: 'min(58vw, 300px)' }}
              draggable={false}
            />
            <div className="px-4 py-3.5">
              <p className="text-[16px] font-extrabold tracking-tight">{f.title}</p>
              <p className="mt-0.5 text-xs" style={{ color: pg.text3 }}>{f.subtitle}</p>
            </div>
          </button>
        ))}
      </div>
      <div className="mt-3.5 flex justify-center gap-1.5">
        {FEATURES.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => go(i)}
            className="rounded-full transition-all"
            style={{
              width: i === active ? 22 : 7,
              height: 7,
              background: i === active ? pg.lime : 'rgba(255,255,255,0.18)',
            }}
          />
        ))}
      </div>
    </section>
  )
}
