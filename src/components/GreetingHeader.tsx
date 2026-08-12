import { pg } from '../design/tokens'

function timeOfDay(): 'morning' | 'afternoon' | 'evening' {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

/** Modern greeting — typography only, no side illustration / broken assets */
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
    <header className={`mb-6 ${className}`}>
      <p
        className="mb-1.5 text-[13px] font-medium tracking-wide"
        style={{ color: pg.text3 }}
      >
        Good {period}
      </p>
      <h1 className="truncate text-[34px] font-extrabold leading-[1.05] tracking-[-0.04em]" style={{ color: pg.text }}>
        {name}
      </h1>
      <div
        className="mt-3 h-[2px] w-10 rounded-full"
        style={{ background: pg.lime }}
      />
    </header>
  )
}

export { timeOfDay }
