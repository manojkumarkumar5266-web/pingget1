/**
 * PingGET theme — midnight ink + warm gold (User / DP / Admin).
 * Fresh break from the old lime-on-black look.
 */
export const pg = {
  bg: '#07080B',
  bgElevated: '#0E1016',
  surface: '#141821',
  surface2: '#1C2230',
  line: 'rgba(255,255,255,0.07)',
  lineStrong: 'rgba(255,255,255,0.14)',
  /** Primary accent (warm gold) — kept as `lime` key for app-wide compatibility */
  lime: '#F5C542',
  limeDim: 'rgba(245,197,66,0.14)',
  limeText: '#140F05',
  text: '#F7F4EE',
  text2: 'rgba(247,244,238,0.72)',
  text3: 'rgba(247,244,238,0.48)',
  text4: 'rgba(247,244,238,0.28)',
  danger: '#FF5C5C',
  success: '#3DDC97',
  info: '#5B9DFF',
  warning: '#FF9F43',
  radius: {
    sm: 12,
    md: 16,
    lg: 22,
    xl: 28,
    pill: 999,
  },
} as const

export type PgColor = typeof pg
