/**
 * pinGGet brand tokens — lime + olive green (User / DP / Admin).
 * Primary CTA / highlights use lime; secondary / Advance accents use olive.
 */
export const pg = {
  bg: '#07080B',
  bgElevated: '#0E1016',
  surface: '#141821',
  surface2: '#1C2230',
  line: 'rgba(255,255,255,0.07)',
  lineStrong: 'rgba(255,255,255,0.14)',
  /** Primary accent — lime (first G in pinGGet) */
  lime: '#C4D600',
  limeDim: 'rgba(196,214,0,0.16)',
  limeText: '#101404',
  /** Secondary accent — olive green light (second G in pinGGet) */
  olive: '#8FAE3E',
  oliveDim: 'rgba(143,174,62,0.16)',
  oliveText: '#101404',
  text: '#F7F4EE',
  text2: 'rgba(247,244,238,0.72)',
  text3: 'rgba(247,244,238,0.48)',
  text4: 'rgba(247,244,238,0.28)',
  danger: '#FF5C5C',
  success: '#3DDC97',
  info: '#8FAE3E',
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
