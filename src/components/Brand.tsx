import { Images } from '../lib/customImages'

type BrandSize = 'sm' | 'md' | 'lg' | 'xl' | 'hero'

type BrandProps = {
  size?: BrandSize
  /** Show the official pinGGet wordmark image (includes tagline) */
  className?: string
  /** Inline compact mark for headers */
  compact?: boolean
}

const sizeMap: Record<BrandSize, string> = {
  sm: 'h-8 w-auto max-w-[140px]',
  md: 'h-12 w-auto max-w-[200px]',
  lg: 'h-16 w-auto max-w-[260px]',
  xl: 'h-24 w-auto max-w-[320px]',
  hero: 'h-28 w-auto max-w-[360px] sm:h-32',
}

/**
 * Official pinGGet logo — replace public/images/logo.png to update everywhere.
 * Renders the full wordmark + “boy next door” artwork (no plain “PingGET” text).
 */
export default function Brand({
  size = 'md',
  className = '',
  compact = false,
}: BrandProps) {
  return (
    <img
      src={Images.logo}
      alt="pinGGet"
      className={`${compact ? 'h-7 w-auto max-w-[120px]' : sizeMap[size]} object-contain ${className}`}
      draggable={false}
    />
  )
}

/** Colored wordmark fallback when only text is needed (matches logo palette) */
export function BrandWordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline font-extrabold tracking-tight ${className}`} aria-label="pinGGet">
      <span style={{ color: '#FFFFFF' }}>pin</span>
      <span style={{ color: '#A3B168' }}>G</span>
      <span style={{ color: '#FFFFFF' }}>G</span>
      <span style={{ color: '#A3B168' }}>et</span>
    </span>
  )
}

export const OLIVE_GREEN = '#A3B168'
