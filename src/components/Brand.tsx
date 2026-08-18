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
  xs: 'text-[1.15rem]',
  sm: 'text-xl',
  md: 'text-[1.85rem]',
  lg: 'text-4xl sm:text-5xl',
  xl: 'text-5xl sm:text-6xl',
  hero: 'text-[3.4rem] sm:text-[3.9rem]',
}

const tagScale: Record<BrandSize, string> = {
  xs: 'text-[7px] tracking-[0.28em]',
  sm: 'text-[8px] tracking-[0.32em]',
  md: 'text-[9px] tracking-[0.34em]',
  lg: 'text-[10px] tracking-[0.36em] sm:text-[11px]',
  xl: 'text-[11px] tracking-[0.38em] sm:text-xs',
  hero: 'text-[11px] tracking-[0.4em] sm:text-xs',
}

/** Forest green */
export const BRAND_GREEN = '#0C8A3E'
/** Dull gold / mustard */
export const BRAND_YELLOW = '#C4A35A'
/** Deep ink */
export const BRAND_DARK = '#0E1410'
export const BRAND_WHITE = '#FFFFFF'

/** Same typeface as greeting names */
export const BRAND_FONT = "'Outfit', 'DM Sans', system-ui, sans-serif"

/**
 * Person name in pinGGet wordmark typography.
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
 * pinGGet wordmark — pin gold · G green · 2nd G gold · et green
 * Tagline “boy next door” only when showTagline is true (welcome + sign-in).
 */
export function BrandWordmark({
  className = '',
  size = 'lg',
  showTagline = false,
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
        className={`font-extrabold ${wordScale[size]}`}
        style={{ fontFamily: BRAND_FONT, letterSpacing: '-0.045em' }}
      >
        <span style={{ color: BRAND_YELLOW }}>pin</span>
        <span style={{ color: BRAND_GREEN }}>G</span>
        <span style={{ color: BRAND_YELLOW }}>G</span>
        <span style={{ color: BRAND_GREEN }}>et</span>
      </div>
      {showTagline && (
        <div
          className={`mt-2 text-center font-semibold uppercase ${tagScale[size]}`}
          style={{ color: BRAND_YELLOW, fontFamily: BRAND_FONT, letterSpacing: '0.22em', opacity: 0.95 }}
        >
          boy next door
        </div>
      )}
    </div>
  )
}

/**
 * Official pinGGet brand — always CSS wordmark.
 */
export default function Brand({
  size = 'md',
  className = '',
  compact = false,
  showTagline,
}: BrandProps) {
  const resolvedSize = compact ? 'xs' : size
  const tagline = showTagline ?? false
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
