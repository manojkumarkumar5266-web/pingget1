/**
 * pinGGet brand tokens — full pure-black UI (User / DP / Admin).
 * Cards, chrome, and image wells are black; green CTAs for actions.
 */
export const pg = {
  bg: '#000000',
  bgElevated: '#000000',
  surface: '#000000',
  surface2: '#0A0A0A',
  line: 'rgba(255, 255, 255, 0.12)',
  lineStrong: 'rgba(255, 255, 255, 0.2)',
  /** Primary accent — forest green */
  lime: '#0C8A3E',
  limeDim: 'rgba(12, 138, 62, 0.2)',
  limeText: '#FFFFFF',
  /** Secondary accent */
  olive: '#2EAD5A',
  oliveDim: 'rgba(46, 173, 90, 0.18)',
  oliveText: '#FFFFFF',
  text: '#F5F7F6',
  text2: 'rgba(245, 247, 246, 0.72)',
  text3: 'rgba(245, 247, 246, 0.48)',
  text4: 'rgba(245, 247, 246, 0.32)',
  /** Alias for card text (same as canvas — everything is black) */
  ink: '#F5F7F6',
  ink2: 'rgba(245, 247, 246, 0.72)',
  ink3: 'rgba(245, 247, 246, 0.48)',
  danger: '#E23B3B',
  success: '#0C8A3E',
  info: '#4DA3E0',
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
