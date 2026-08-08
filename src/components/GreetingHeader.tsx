import { pg } from '../design/tokens'

function timeOfDay(): 'morning' | 'afternoon' | 'evening' {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

/** Modern greeting — typography-led, no side illustration */
export default function GreetingHeader({
  firstName,
  className = '',
}: {
  firstName: string
  className?: string
}) {
  const period = timeOfDay()
  const name = firstName?.trim() || 'there'

  return (
    <header className={`relative mb-6 overflow-hidden ${className}`}>
      <div
        className="pointer-events-none absolute -left-8 -top-10 h-28 w-28 rounded-full blur-3xl"
        style={{ background: pg.limeDim }}
      />
      <div
        className="animate-fade-in-up relative rounded-[24px] px-4 py-4"
        style={{
          background: `linear-gradient(135deg, ${pg.surface} 0%, rgba(18,18,18,0.4) 100%)`,
          border: `1px solid ${pg.line}`,
        }}
      >
        <div className="mb-2.5 flex items-center gap-2">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: pg.lime, boxShadow: `0 0 10px ${pg.lime}` }}
          />
          <p
            className="text-[11px] font-extrabold uppercase tracking-[0.18em]"
            style={{ color: pg.text3 }}
          >
            Good {period}
          </p>
        </div>
        <h1 className="truncate text-[32px] font-extrabold leading-[1.05] tracking-tight">
          <span style={{ color: pg.text2, fontWeight: 700 }}>Hai,</span>{' '}
          <span style={{ color: pg.text }}>{name}</span>
        </h1>
        <div
          className="mt-3 h-[3px] w-12 rounded-full"
          style={{ background: `linear-gradient(90deg, ${pg.lime}, transparent)` }}
        />
      </div>
    </header>
  )
}

export { timeOfDay }
