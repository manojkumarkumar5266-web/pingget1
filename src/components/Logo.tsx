import Brand from './Brand'

/** Alias — always use official pinGGet logo artwork */
export default function PingGetLogo({
  size = 'sm',
}: {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
}) {
  const map = { sm: 'sm' as const, md: 'md' as const, lg: 'lg' as const }
  return <Brand size={map[size]} />
}
