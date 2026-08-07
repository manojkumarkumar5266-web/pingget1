/** Which product shell this build is for. Injected by vite.app.config.ts */
declare const __PINGGET_APP_TARGET__: 'user' | 'dp' | 'admin'

export type AppTarget = 'user' | 'dp' | 'admin'

export const APP_TARGET: AppTarget =
  typeof __PINGGET_APP_TARGET__ !== 'undefined' ? __PINGGET_APP_TARGET__ : 'user'

export const IS_USER_APP = APP_TARGET === 'user'
export const IS_DP_APP = APP_TARGET === 'dp'
export const IS_ADMIN_APP = APP_TARGET === 'admin'

export const APP_DISPLAY_NAME =
  APP_TARGET === 'dp' ? 'PingGET Partner' : APP_TARGET === 'admin' ? 'PingGET Admin' : 'PingGET'
