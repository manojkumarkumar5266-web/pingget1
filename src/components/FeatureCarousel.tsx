import { useEffect, useRef, useState } from 'react'
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
 * Discover carousel — auto-moves.
 * Press/hold pauses on the current card; release resumes. No full-screen expand.
 */
export default function FeatureCarousel({ intervalMs = 3400 }: { intervalMs?: number }) {
  const [index, setIndex] = useState(0)
  const [holding, setHolding] = useState(false)
  const pauseUntil = useRef(0)
  const n = FEATURES.length

  useEffect(() => {
    if (n <= 1) return
    const id = window.setInterval(() => {
      if (holding) return
      if (Date.now() < pauseUntil.current) return
      setIndex((i) => (i + 1) % n)
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [n, intervalMs, holding])

  const go = (next: number) => {
    pauseUntil.current = Date.now() + 4000
    setIndex(((next % n) + n) % n)
  }

  const holdStart = () => setHolding(true)
  const holdEnd = () => {
    setHolding(false)
    pauseUntil.current = Date.now() + 800
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
          Hold a card to pause — release to continue
        </p>
      </div>

      <div
        className="relative overflow-hidden rounded-[1.35rem] touch-manipulation select-none"
        style={{
          border: `1px solid ${pg.line}`,
          background: '#F4F6F5',
          boxShadow: holding ? `0 0 0 2px ${pg.olive}` : undefined,
        }}
        onPointerDown={holdStart}
        onPointerUp={holdEnd}
        onPointerCancel={holdEnd}
        onPointerLeave={holdEnd}
      >
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {FEATURES.map((f, i) => {
            const near = Math.abs(i - index) <= 1 || (index === 0 && i === n - 1) || (index === n - 1 && i === 0)
            return (
            <article key={f.title} className="relative min-w-full shrink-0">
              <div className="relative aspect-[5/4] w-full overflow-hidden sm:aspect-[4/3]">
                {near ? (
                  <img
                    src={f.image}
                    alt={f.title}
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
                    style={{ background: 'transparent' }}
                    loading={i === index ? 'eager' : 'lazy'}
                    decoding="async"
                    fetchPriority={i === index ? 'high' : 'low'}
                    draggable={false}
                    width={800}
                    height={640}
                  />
                ) : (
                  <div className="absolute inset-0" style={{ background: '#F4F6F5' }} />
                )}
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-3.5 pt-12"
                  style={{
                    background: 'linear-gradient(180deg, transparent, rgba(15,26,20,0.88) 62%)',
                  }}
                >
                  <p className="text-[16px] font-extrabold tracking-tight text-white">{f.title}</p>
                  <p className="mt-0.5 text-xs text-white/75">
                    {f.subtitle}
                  </p>
                </div>
              </div>
            </article>
            )
          })}
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
              background: i === index ? pg.lime : i % 2 === 0 ? 'rgba(143,174,62,0.45)' : 'rgba(255,255,255,0.22)',
            }}
          />
        ))}
      </div>
    </section>
  )
}
