/**
 * Public HTTPS origin for Auth emails (password reset, Google OAuth).
 * Capacitor Android origin is https://localhost — that must not go in reset emails.
 */
export function publicWebOrigin(): string {
  const fromEnv = String(import.meta.env.VITE_PUBLIC_WEB_URL || '').replace(/\/$/, '')
  if (fromEnv) return fromEnv
  if (typeof window === 'undefined') return 'https://pingget.app'
  const origin = window.location.origin
  if (
    origin.includes('localhost') ||
    origin.startsWith('capacitor://') ||
    origin.startsWith('ionic://') ||
    origin.startsWith('http://')
  ) {
    return 'https://pingget.app'
  }
  return origin
}

export function passwordResetRedirect(role: 'user' | 'dp' | 'admin' = 'user'): string {
  const base = publicWebOrigin()
  if (role === 'dp') return `${base}/dp/reset-password`
  if (role === 'admin') return `${base}/admin/reset-password`
  return `${base}/reset-password`
}
