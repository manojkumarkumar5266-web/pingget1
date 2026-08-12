/**
 * pinGGet brand tokens — Dunzo / Blinkit / Rapido inspired commerce UI.
 * Light canvas, forest-green primary CTAs, clean white cards.
 */
export const pg = {
  bg: '#F4F6F5',
  bgElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surface2: '#EEF2EF',
  line: 'rgba(15, 40, 25, 0.08)',
  lineStrong: 'rgba(15, 40, 25, 0.14)',
  /** Primary accent — forest green (Dunzo/Blinkit style) */
  lime: '#0C8A3E',
  limeDim: 'rgba(12, 138, 62, 0.12)',
  limeText: '#FFFFFF',
  /** Secondary accent — softer leaf green */
  olive: '#2EAD5A',
  oliveDim: 'rgba(46, 173, 90, 0.14)',
  oliveText: '#FFFFFF',
  text: '#0F1A14',
  text2: 'rgba(15, 26, 20, 0.72)',
  text3: 'rgba(15, 26, 20, 0.48)',
  text4: 'rgba(15, 26, 20, 0.32)',
  danger: '#E23B3B',
  success: '#0C8A3E',
  info: '#1A7FBF',
  warning: '#E89B0C',
  radius: {
    sm: 12,
    md: 16,
    lg: 20,
    xl: 28,
    pill: 999,
  },
} as const

export type PgColor = typeof pg
