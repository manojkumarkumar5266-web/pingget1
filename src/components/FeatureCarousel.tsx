import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Images } from '../lib/customImages'
import { pg } from '../design/tokens'

const FEATURES = [
  { title: 'Instant Delivery', subtitle: 'Book now — DP acts after accept', image: Images.feature.card1 },
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
 * Discover section — auto L→R carousel.
 * Tap a card to open full-screen for reading; close resumes auto-move.
 */
export default function FeatureCarousel({ intervalMs = 3400 }: { intervalMs?: number }) {
  const [index, setIndex] = useState(0)
  const [expanded, setExpanded] = useState<(typeof FEATURES)[number] | null>(null)
  const pauseUntil = useRef(0)
  const n = FEATURES.length

  useEffect(() => {
    if (n <= 1) return
    const id = window.setInterval(() => {
      if (expanded) return
      if (Date.now() < pauseUntil.current) return
      setIndex((i) => (i + 1) % n)
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [n, intervalMs, expanded])

  const go = (next: number) => {
    pauseUntil.current = Date.now() + 5000
    setIndex(((next % n) + n) % n)
  }

  const closeExpanded = () => {
    setExpanded(null)
    // Resume auto-carousel shortly after close
    pauseUntil.current = Date.now() + 1200
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
          Tap a card to read — close to continue
        </p>
      </div>

      <div
        className="relative overflow-hidden rounded-[1.35rem]"
        style={{ border: `1px solid ${pg.line}`, background: '#0A0C10' }}
      >
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {FEATURES.map((f) => (
            <article key={f.title} className="relative min-w-full shrink-0 select-none">
              <button
                type="button"
                className="relative aspect-[5/4] w-full overflow-hidden text-left sm:aspect-[4/3]"
                onClick={() => {
                  pauseUntil.current = Number.MAX_SAFE_INTEGER
                  setExpanded(f)
                }}
                aria-label={`Open ${f.title}`}
              >
                <img
                  src={f.image}
                  alt={f.title}
                  className="absolute inset-0 h-full w-full object-cover object-center"
                  style={{ background: 'transparent' }}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                />
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-3.5 pt-12"
                  style={{
                    background: 'linear-gradient(180deg, transparent, rgba(7,8,11,0.94) 60%)',
                  }}
                >
                  <p className="text-[16px] font-extrabold tracking-tight text-white">{f.title}</p>
                  <p className="mt-0.5 text-xs" style={{ color: pg.text3 }}>
                    {f.subtitle}
                  </p>
                </div>
              </button>
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

      {expanded && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.88)' }}
          onClick={closeExpanded}
          role="dialog"
          aria-modal="true"
          aria-label={expanded.title}
        >
          <div
            className="relative w-full max-w-lg overflow-hidden rounded-[1.5rem]"
            style={{ background: '#0A0C10', border: `1px solid ${pg.lineStrong}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeExpanded}
              className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full"
              style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <div className="relative aspect-[4/5] w-full sm:aspect-[4/3]">
              <img
                src={expanded.image}
                alt={expanded.title}
                className="absolute inset-0 h-full w-full object-cover"
                draggable={false}
              />
              <div
                className="absolute inset-x-0 bottom-0 px-5 pb-5 pt-16"
                style={{ background: 'linear-gradient(180deg, transparent, rgba(7,8,11,0.96) 55%)' }}
              >
                <p className="text-[22px] font-extrabold tracking-tight text-white">{expanded.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed" style={{ color: pg.text2 }}>
                  {expanded.subtitle}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
