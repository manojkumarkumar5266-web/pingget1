/**
 * pinGGet brand tokens — Dunzo / Blinkit style on a pure black canvas.
 * Black page background; white cards + forest-green CTAs unchanged.
 */
export const pg = {
  bg: '#000000',
  bgElevated: '#0A0A0A',
  surface: '#FFFFFF',
  surface2: '#EEF2EF',
  line: 'rgba(255, 255, 255, 0.12)',
  lineStrong: 'rgba(255, 255, 255, 0.18)',
  /** Primary accent — forest green (Dunzo/Blinkit style) */
  lime: '#0C8A3E',
  limeDim: 'rgba(12, 138, 62, 0.18)',
  limeText: '#FFFFFF',
  /** Secondary accent — softer leaf green */
  olive: '#2EAD5A',
  oliveDim: 'rgba(46, 173, 90, 0.16)',
  oliveText: '#FFFFFF',
  /** On-black canvas text */
  text: '#F5F7F6',
  text2: 'rgba(245, 247, 246, 0.72)',
  text3: 'rgba(245, 247, 246, 0.48)',
  text4: 'rgba(245, 247, 246, 0.32)',
  /** On-white card text */
  ink: '#0F1A14',
  ink2: 'rgba(15, 26, 20, 0.72)',
  ink3: 'rgba(15, 26, 20, 0.48)',
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
