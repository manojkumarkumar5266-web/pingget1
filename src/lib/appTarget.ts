/** Which product shell this build is for. */
declare const __PINGGET_APP_TARGET__: 'user' | 'dp' | 'admin' | 'web'

export type AppTarget = 'user' | 'dp' | 'admin' | 'web'

function fromDefine(): AppTarget {
  try {
    if (typeof __PINGGET_APP_TARGET__ !== 'undefined') return __PINGGET_APP_TARGET__
  } catch { /* ignore */ }
  return 'web'
}

function fromPathname(): 'user' | 'dp' | 'admin' | null {
  if (typeof window === 'undefined') return null
  const p = window.location.pathname
  if (p === '/admin' || p.startsWith('/admin/')) return 'admin'
  if (p === '/dp' || p.startsWith('/dp/')) return 'dp'
  // Only treat explicit customer app paths as user when a dedicated build
  // might also be involved — bare `/` is handled by callers via define/fallback.
  return null
}

/**
 * Unified web: URL path always wins (/dp → Partner, /admin → Admin).
 * Dedicated Capacitor builds (define = user|dp|admin) use define when path
 * does not identify an app (e.g. app opens at `/`).
 */
export function resolveAppTarget(): 'user' | 'dp' | 'admin' {
  const pathTarget = fromPathname()
  if (pathTarget) return pathTarget

  const defined = fromDefine()
  if (defined === 'user' || defined === 'dp' || defined === 'admin') return defined
  return 'user'
}

export const APP_TARGET: AppTarget = fromDefine()

/** True when this is the unified web deploy (path routing). */
export const IS_WEB_UNIFIED = APP_TARGET === 'web'

export function isUserApp(): boolean {
  return resolveAppTarget() === 'user'
}
export function isDpApp(): boolean {
  return resolveAppTarget() === 'dp'
}
export function isAdminApp(): boolean {
  return resolveAppTarget() === 'admin'
}

/** @deprecated Prefer isDpApp() — kept as function for call-site compatibility */
export const IS_USER_APP = isUserApp
export const IS_DP_APP = isDpApp
export const IS_ADMIN_APP = isAdminApp

export const APP_DISPLAY_NAME = (() => {
  const t = typeof window !== 'undefined' ? resolveAppTarget() : (fromDefine() === 'web' ? 'user' : fromDefine())
  if (t === 'dp') return 'PingGET Partner'
  if (t === 'admin') return 'PingGET Admin'
  return 'PingGET'
})()
