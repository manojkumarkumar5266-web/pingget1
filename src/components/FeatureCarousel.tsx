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

/**
 * Discover section — auto-advancing L→R carousel (no stacked cards, no brand mark).
 * Cards are display-only.
 */
export default function FeatureCarousel({ intervalMs = 3400 }: { intervalMs?: number }) {
  const [index, setIndex] = useState(0)
  const pauseUntil = useRef(0)
  const n = FEATURES.length

  useEffect(() => {
    if (n <= 1) return
    const id = window.setInterval(() => {
      if (Date.now() < pauseUntil.current) return
      setIndex((i) => (i + 1) % n)
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [n, intervalMs])

  const go = (next: number) => {
    pauseUntil.current = Date.now() + 5000
    setIndex(((next % n) + n) % n)
  }

  return (
    <section className="mb-8">
      <div className="mb-4 px-0.5">
        <p
          className="text-[11px] font-extrabold uppercase tracking-[0.16em]"
          style={{ color: pg.lime }}
        >
          Discover
        </p>
        <h2 className="text-[20px] font-extrabold tracking-tight" style={{ color: pg.text }}>
          We serve you
        </h2>
        <p className="mt-0.5 text-xs" style={{ color: pg.text3 }}>
          Everything you need, delivered nearby
        </p>
      </div>

      <div
        className="relative overflow-hidden rounded-[1.35rem]"
        style={{ border: `1px solid ${pg.line}`, background: pg.surface }}
      >
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {FEATURES.map((f) => (
            <article key={f.title} className="min-w-full shrink-0 select-none px-3 pb-3 pt-3">
              <img
                src={f.image}
                alt={f.title}
                className="mx-auto max-h-[240px] w-full object-contain"
                style={{ background: 'transparent', display: 'block' }}
                loading="lazy"
                decoding="async"
                draggable={false}
              />
              <div className="mt-3 px-1 text-center">
                <p className="text-[16px] font-extrabold tracking-tight">{f.title}</p>
                <p className="mt-0.5 text-xs" style={{ color: pg.text3 }}>
                  {f.subtitle}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2">
        {FEATURES.map((f, i) => (
          <button
            key={f.title}
            type="button"
            aria-label={`Show ${f.title}`}
            onClick={() => go(i)}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: i === index ? 24 : 6,
              background: i === index ? pg.lime : 'rgba(255,255,255,0.22)',
            }}
          />
        ))}
      </div>
    </section>
  )
}
