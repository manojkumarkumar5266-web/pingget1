import { Images } from '../lib/customImages'

type BrandSize = 'sm' | 'md' | 'lg' | 'xl'

type BrandProps = {
  size?: BrandSize
  showTagline?: boolean
  variant?: 'light' | 'dark'
  className?: string
}

const sizeMap: Record<BrandSize, string> = {
  sm: 'h-10 w-10',
  md: 'h-14 w-14',
  lg: 'h-20 w-20',
  xl: 'h-28 w-28',
}

export const OLIVE_GREEN = '#D4F000'

/**
 * Brand mark — logo image only (no pinGGet text).
 * Replace public/images/logo.png to update everywhere.
 */
export default function Brand({
  size = 'md',
  showTagline = true,
  className = '',
}: BrandProps) {
  return (
    <div className={`flex flex-col items-center leading-none ${className}`}>
      <img
        src={Images.logo}
        alt=""
        className={`${sizeMap[size]} object-contain`}
        draggable={false}
      />
      {showTagline && (
        <span
          className="mt-2 text-[10px] font-semibold tracking-[0.15em] text-white/70"
        >
          CHAT . ORDER . GET IT
        </span>
      )}
    </div>
  )
}
