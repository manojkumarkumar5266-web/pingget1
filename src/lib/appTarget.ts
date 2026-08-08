/** Which product shell this build is for. */
declare const __PINGGET_APP_TARGET__: 'user' | 'dp' | 'admin' | 'web'

export type AppTarget = 'user' | 'dp' | 'admin' | 'web'

function fromDefine(): AppTarget {
  try {
    if (typeof __PINGGET_APP_TARGET__ !== 'undefined') return __PINGGET_APP_TARGET__
  } catch { /* ignore */ }
  return 'web'
}

/** Path-based target when running the unified web build. */
export function resolveAppTarget(): 'user' | 'dp' | 'admin' {
  const defined = fromDefine()
  // Dedicated Capacitor builds are locked to one app.
  // Unified web (`web`) always selects the shell from the URL path.
  if (defined === 'user' || defined === 'dp' || defined === 'admin') return defined
  if (typeof window === 'undefined') return 'user'
  const p = window.location.pathname
  if (p === '/admin' || p.startsWith('/admin/')) return 'admin'
  if (p === '/dp' || p.startsWith('/dp/')) return 'dp'
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
