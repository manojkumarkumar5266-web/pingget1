import Brand from './Brand'

/** Alias kept for older imports — always CSS wordmark */
export default function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const map = { sm: 'sm' as const, md: 'md' as const, lg: 'lg' as const }
  return <Brand size={map[size]} showTagline={false} />
}
