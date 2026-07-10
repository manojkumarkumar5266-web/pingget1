type BrandSize = 'sm' | 'md' | 'lg' | 'xl'
type BrandVariant = 'light' | 'dark'

type BrandProps = {
  size?: BrandSize
  showTagline?: boolean
  variant?: BrandVariant
  className?: string
}

const sizeMap: Record<BrandSize, { text: string; tagline: string }> = {
  sm: { text: 'text-2xl', tagline: 'text-[9px]' },
  md: { text: 'text-3xl', tagline: 'text-[10px]' },
  lg: { text: 'text-4xl', tagline: 'text-xs' },
  xl: { text: 'text-5xl', tagline: 'text-sm' },
}

export const OLIVE_GREEN = '#808000'

/**
 * Brand: "pinGGet"
 * Letters p, i, n, 2nd-G → white
 * Letters 1st-G, e, t → olive green
 * Tagline "CHAT . ORDER . GET IT" → white
 */
export default function Brand({
  size = 'md',
  showTagline = true,
  variant = 'light',
  className = '',
}: BrandProps) {
  const s = sizeMap[size]
  const whiteColor = variant === 'light' ? '#ffffff' : '#1a1a1a'
  const olive = OLIVE_GREEN
  const taglineColor = variant === 'light' ? '#ffffff' : olive

  return (
    <div className={`flex flex-col items-center leading-none ${className}`}>
      <span
        className={`${s.text} font-black tracking-tight`}
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        <span style={{ color: whiteColor }}>pin</span>
        <span style={{ color: olive }}>G</span>
        <span style={{ color: whiteColor }}>G</span>
        <span style={{ color: olive }}>et</span>
      </span>
      {showTagline && (
        <span
          className={`${s.tagline} font-semibold tracking-[0.15em] mt-1`}
          style={{ color: taglineColor }}
        >
          CHAT . ORDER . GET IT
        </span>
      )}
    </div>
  )
}
