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

/** App green — used for 1st G and et */
export const BRAND_GREEN = '#0C8A3E'
/** White — used for pin and 2nd G on black UI */
export const BRAND_WHITE = '#FFFFFF'

/** Official brand typeface — use for person names too (colour stays theme/default). */
export const BRAND_FONT = "'Outfit', 'DM Sans', system-ui, sans-serif"

/**
 * Person name in pinGGet wordmark typography (Outfit / extrabold / tight tracking).
 * Colour is unchanged — pass `style.color` or inherit from parent.
 */
export function BrandPersonName({
  children,
  className = '',
  style,
  as: Tag = 'span',
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'p'
}) {
  return (
    <Tag
      className={`font-extrabold tracking-tight ${className}`}
      style={{ fontFamily: BRAND_FONT, ...style }}
    >
      {children}
    </Tag>
  )
}

/**
 * pinGGet wordmark — pin white · 1st G green · 2nd G white · et green
 * Shared across User, DP, and Admin.
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
        style={{ fontFamily: BRAND_FONT }}
      >
        <span style={{ color: BRAND_WHITE }}>pin</span>
        <span style={{ color: BRAND_GREEN }}>G</span>
        <span style={{ color: BRAND_WHITE }}>G</span>
        <span style={{ color: BRAND_GREEN }}>et</span>
      </div>
      {showTagline && (
        <div
          className={`mt-1.5 font-semibold uppercase ${tagScale[size]}`}
          style={{ color: BRAND_GREEN }}
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
