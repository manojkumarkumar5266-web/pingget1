import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
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
 * Discover carousel — auto-moves; swipe left/right; hold pauses.
 */
export default function FeatureCarousel({ intervalMs = 3400 }: { intervalMs?: number }) {
  const [index, setIndex] = useState(0)
  const [holding, setHolding] = useState(false)
  const [dragPx, setDragPx] = useState(0)
  const pauseUntil = useRef(0)
  const pointer = useRef<{ id: number; x: number; y: number; swiping: boolean } | null>(null)
  const widthRef = useRef(1)
  const trackRef = useRef<HTMLDivElement>(null)
  const n = FEATURES.length

  useEffect(() => {
    if (n <= 1) return
    const id = window.setInterval(() => {
      if (holding || pointer.current) return
      if (Date.now() < pauseUntil.current) return
      setIndex((i) => (i + 1) % n)
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [n, intervalMs, holding])

  const go = (next: number) => {
    pauseUntil.current = Date.now() + 4000
    setIndex(((next % n) + n) % n)
    setDragPx(0)
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    widthRef.current = trackRef.current?.clientWidth || 1
    pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY, swiping: false }
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    setHolding(true)
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const p = pointer.current
    if (!p || p.id !== e.pointerId) return
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    if (!p.swiping && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      p.swiping = true
    }
    if (p.swiping) {
      setDragPx(dx)
    }
  }

  const endPointer = (e: ReactPointerEvent) => {
    const p = pointer.current
    if (!p || p.id !== e.pointerId) return
    const dx = e.clientX - p.x
    const threshold = Math.min(72, widthRef.current * 0.18)
    if (p.swiping && Math.abs(dx) >= threshold) {
      go(dx < 0 ? index + 1 : index - 1)
    } else {
      setDragPx(0)
      pauseUntil.current = Date.now() + 800
    }
    pointer.current = null
    setHolding(false)
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
          Swipe left or right · hold to pause
        </p>
      </div>

      <div
        ref={trackRef}
        className="relative overflow-hidden rounded-[1.35rem] touch-pan-y select-none"
        style={{
          border: `1px solid ${pg.line}`,
          background: '#000000',
          boxShadow: holding ? `0 0 0 2px ${pg.olive}` : undefined,
          touchAction: 'pan-y',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <div
          className="flex"
          style={{
            transform: `translateX(calc(-${index * 100}% + ${dragPx}px))`,
            transition: pointer.current?.swiping || dragPx !== 0 ? 'none' : 'transform 0.45s ease-out',
          }}
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
                    <div className="absolute inset-0" style={{ background: '#000000' }} />
                  )}
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-3.5 pt-12"
                    style={{
                      background: 'linear-gradient(180deg, transparent, rgba(15,26,20,0.88) 62%)',
                    }}
                  >
                    <p className="text-[16px] font-extrabold tracking-tight text-white">{f.title}</p>
                    <p className="mt-0.5 text-xs text-white/75">{f.subtitle}</p>
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
