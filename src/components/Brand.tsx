import { useState } from 'react'
import { Images } from '../lib/customImages'

type BrandSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero'

type BrandProps = {
  size?: BrandSize
  className?: string
  compact?: boolean
  /** Force CSS wordmark instead of PNG (always readable) */
  wordmark?: boolean
}

const boxMap: Record<BrandSize, string> = {
  xs: 'h-7 w-auto max-w-[100px]',
  sm: 'h-9 w-auto max-w-[140px]',
  md: 'h-14 w-auto max-w-[220px]',
  lg: 'h-20 w-auto max-w-[280px]',
  xl: 'h-28 w-auto max-w-[360px]',
  hero: 'h-32 w-auto max-w-[420px] sm:h-36',
}

const wordScale: Record<BrandSize, string> = {
  xs: 'text-lg',
  sm: 'text-xl',
  md: 'text-3xl',
  lg: 'text-4xl sm:text-5xl',
  xl: 'text-5xl sm:text-6xl',
  hero: 'text-[3.25rem] sm:text-[3.75rem]',
}

/** Large CSS wordmark — pinGGet with lime + olive GGs + tagline. */
export function BrandWordmark({
  className = '',
  size = 'lg',
  showTagline = true,
}: {
  className?: string
  size?: BrandSize
  showTagline?: boolean
}) {
  return (
    <div className={`select-none text-center leading-none ${className}`}>
      <div className={`font-extrabold tracking-tight ${wordScale[size]}`} style={{ fontFamily: "'Outfit', 'DM Sans', system-ui, sans-serif" }}>
        <span style={{ color: '#F7F4EE' }}>pin</span>
        <span style={{ color: '#C4D600' }}>G</span>
        <span style={{ color: '#8FAE3E' }}>G</span>
        <span style={{ color: '#F7F4EE' }}>et</span>
      </div>
      {showTagline && (
        <div
          className="mt-2 text-[10px] font-semibold uppercase tracking-[0.28em] sm:text-[11px]"
          style={{ color: 'rgba(143,174,62,0.95)' }}
        >
          boy next door
        </div>
      )}
    </div>
  )
}

/**
 * Official pinGGet brand. Large sizes use CSS wordmark so the name is never unreadably small.
 */
export default function Brand({
  size = 'md',
  className = '',
  compact = false,
  wordmark = false,
}: BrandProps) {
  const [failed, setFailed] = useState(false)
  const useWord = wordmark || failed || size === 'lg' || size === 'xl' || size === 'hero'

  if (useWord) {
    return <BrandWordmark size={compact ? 'sm' : size} className={className} showTagline={!compact} />
  }

  return (
    <img
      src={Images.logo}
      alt="pinGGet"
      className={`${compact ? 'h-8 w-auto max-w-[130px]' : boxMap[size]} object-contain ${className}`}
      draggable={false}
      onError={() => setFailed(true)}
    />
  )
}

export { Brand as BrandMark }
