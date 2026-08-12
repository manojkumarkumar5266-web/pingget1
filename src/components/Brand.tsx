type BrandSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero'

type BrandProps = {
  size?: BrandSize
  className?: string
  compact?: boolean
  /** Force CSS wordmark (always used — no PNG logos) */
  wordmark?: boolean
  showTagline?: boolean
}

const wordScale: Record<BrandSize, string> = {
  xs: 'text-base',
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-4xl sm:text-5xl',
  xl: 'text-5xl sm:text-6xl',
  hero: 'text-[3.25rem] sm:text-[3.75rem]',
}

const tagScale: Record<BrandSize, string> = {
  xs: 'text-[8px] tracking-[0.22em]',
  sm: 'text-[9px] tracking-[0.24em]',
  md: 'text-[10px] tracking-[0.26em]',
  lg: 'text-[10px] tracking-[0.28em] sm:text-[11px]',
  xl: 'text-[11px] tracking-[0.28em] sm:text-xs',
  hero: 'text-[11px] tracking-[0.28em] sm:text-xs',
}

/**
 * pinGGet wordmark — light commerce UI
 * pin/et dark · 1st G soft green · 2nd G brand green
 */
export function BrandWordmark({
  className = '',
  size = 'lg',
  showTagline = true,
  align = 'center',
}: {
  className?: string
  size?: BrandSize
  showTagline?: boolean
  align?: 'left' | 'center'
}) {
  return (
    <div
      className={`select-none leading-none ${align === 'left' ? 'text-left' : 'text-center'} ${className}`}
      aria-label="pinGGet"
    >
      <div
        className={`font-extrabold tracking-tight ${wordScale[size]}`}
        style={{ fontFamily: "'Outfit', 'DM Sans', system-ui, sans-serif" }}
      >
        <span style={{ color: '#0F1A14' }}>pin</span>
        <span style={{ color: '#2EAD5A' }}>G</span>
        <span style={{ color: '#0C8A3E' }}>G</span>
        <span style={{ color: '#0F1A14' }}>et</span>
      </div>
      {showTagline && (
        <div
          className={`mt-1.5 font-semibold uppercase ${tagScale[size]}`}
          style={{ color: '#0C8A3E' }}
        >
          boy next door
        </div>
      )}
    </div>
  )
}

/**
 * Official pinGGet brand — always CSS wordmark (no old PNG logos).
 * Use compact / showTagline={false} for top-left app chrome.
 */
export default function Brand({
  size = 'md',
  className = '',
  compact = false,
  showTagline,
}: BrandProps) {
  const resolvedSize = compact ? 'xs' : size
  const tagline = showTagline ?? !compact
  return (
    <BrandWordmark
      size={resolvedSize}
      className={className}
      showTagline={tagline}
      align={compact ? 'left' : 'center'}
    />
  )
}

export { Brand as BrandMark }
