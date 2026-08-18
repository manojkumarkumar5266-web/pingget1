import type { ReactNode } from 'react'
import { pg } from '../design/tokens'
import { BrandPersonName } from './Brand'

function timeOfDay(): 'morning' | 'afternoon' | 'evening' {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

/** Greeting + optional right-side content (address / commission) */
export default function GreetingHeader({
  firstName,
  aside,
  className = '',
}: {
  firstName: string
  aside?: ReactNode
  className?: string
}) {
  const period = timeOfDay()
  const name = firstName?.trim() || 'there'

  return (
    <header className={`mb-5 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p
            className="mb-1.5 text-[13px] font-medium tracking-wide"
            style={{ color: pg.text3 }}
          >
            Good {period}
          </p>
          <BrandPersonName
            as="h1"
            className="truncate text-[28px] leading-[1.05] tracking-[-0.04em] sm:text-[34px]"
            style={{ color: pg.text }}
          >
            {name}
          </BrandPersonName>
          <div
            className="mt-2.5 h-[2px] w-10 rounded-full"
            style={{ background: pg.gold }}
          />
        </div>
        {aside ? <div className="max-w-[52%] shrink-0 pt-0.5 sm:max-w-[48%]">{aside}</div> : null}
      </div>
    </header>
  )
}

export { timeOfDay }
