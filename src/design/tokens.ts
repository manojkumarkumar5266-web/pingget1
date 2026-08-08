/**
 * PingGET production design system — Blinkit / Zepto / Dunzo inspired dark commerce UI.
 * Black canvas, electric lime CTAs, large media, dense but clear hierarchy.
 */
export const pg = {
  bg: '#050505',
  bgElevated: '#0C0C0C',
  surface: '#121212',
  surface2: '#1A1A1A',
  line: 'rgba(255,255,255,0.08)',
  lineStrong: 'rgba(255,255,255,0.14)',
  lime: '#D4F000',
  limeDim: 'rgba(212,240,0,0.14)',
  limeText: '#0A0A0A',
  text: '#FFFFFF',
  text2: 'rgba(255,255,255,0.72)',
  text3: 'rgba(255,255,255,0.45)',
  text4: 'rgba(255,255,255,0.28)',
  danger: '#FF4D4F',
  success: '#22C55E',
  info: '#3B82F6',
  warning: '#F5A524',
  radius: {
    sm: 12,
    md: 16,
    lg: 22,
    xl: 28,
    pill: 999,
  },
} as const

export type PgColor = typeof pg
