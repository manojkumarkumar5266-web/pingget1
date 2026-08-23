/**
 * pinGGet tokens — forest-green canvas, dull-gold actions (User / DP / Admin).
 * Primary buttons/tabs: gold with near-black type. Body type: cream on green.
 */
export const pg = {
  header: '#0C5531',
  headerElevated: '#0E5F38',
  headerBorder: 'rgba(196, 163, 90, 0.42)',
  bg: '#0B4A2A',
  bgElevated: '#0C5230',
  surface: '#0E5C36',
  surface2: '#0A4226',
  line: 'rgba(196, 163, 90, 0.38)',
  lineStrong: 'rgba(196, 163, 90, 0.62)',
  /** Action gold (used by existing lime CTA/tab call sites) */
  lime: '#C4A35A',
  limeDim: 'rgba(196, 163, 90, 0.24)',
  limeText: '#16120C',
  gold: '#C4A35A',
  goldDim: 'rgba(196, 163, 90, 0.24)',
  olive: '#8FD9A4',
  oliveDim: 'rgba(143, 217, 164, 0.18)',
  oliveText: '#0B4A2A',
  text: '#FBF6E8',
  text2: 'rgba(251, 246, 232, 0.92)',
  text3: 'rgba(251, 246, 232, 0.78)',
  text4: 'rgba(251, 246, 232, 0.62)',
  ink: '#FBF6E8',
  ink2: 'rgba(251, 246, 232, 0.92)',
  ink3: 'rgba(251, 246, 232, 0.78)',
  danger: '#E23B3B',
  success: '#8FD9A4',
  info: '#8EC8F0',
  warning: '#E8C36A',
  /** Dim green overlay for centered popups (never black chrome) */
  scrim: 'rgba(11, 74, 42, 0.86)',
  radius: {
    sm: 12,
    md: 16,
    lg: 20,
    xl: 28,
    pill: 999,
  },
} as const

export type PgColor = typeof pg
