import type { SVGProps } from 'react'

const OLIVE = '#C4D600'
const OLIVE_DARK = '#C4D600'
const OLIVE_LIGHT = '#C4D600'
const DARK_BG = '#0B0B0B'
const CARD_BG = '#181818'
const SKIN = '#F5C9A0'
const SKIN_DARK = '#E0A878'
const WHITE = '#FFFFFF'
const AMBER = '#FBBF24'
const BLUE = '#3B82F6'
const RED = '#EF4444'
const GREEN = '#10B981'
const TEAL = '#14B8A6'
const PURPLE = '#8B5CF6'
const PINK = '#EC4899'
const ORANGE = '#F97316'

type SvgProps = SVGProps<SVGSVGElement>

function MascotHead({ cx = 100, cy = 70, expression = 'happy' }: { cx?: number; cy?: number; expression?: 'happy' | 'neutral' | 'excited' }) {
  const eyes = expression === 'excited'
    ? <>{<path d={`M${cx - 14} ${cy - 2} l8 -6 l-8 -2 z`} fill={DARK_BG} />}{<path d={`M${cx + 6} ${cy - 2} l8 -6 l-8 -2 z`} fill={DARK_BG} />}</>
    : <>{<circle cx={cx - 10} cy={cy - 2} r={3.5} fill={DARK_BG} />}{<circle cx={cx + 10} cy={cy - 2} r={3.5} fill={DARK_BG} />}</>
  const mouth = expression === 'happy'
    ? <path d={`M${cx - 10} ${cy + 8} Q${cx} ${cy + 16} ${cx + 10} ${cy + 8}`} stroke={DARK_BG} strokeWidth={2.5} fill="none" strokeLinecap="round" />
    : expression === 'excited'
    ? <ellipse cx={cx} cy={cy + 10} rx={7} ry={5} fill={DARK_BG} />
    : <line x1={cx - 8} y1={cy + 10} x2={cx + 8} y2={cy + 10} stroke={DARK_BG} strokeWidth={2.5} strokeLinecap="round" />
  return (
    <g>
      {/* Helmet */}
      <path d={`M${cx - 28} ${cy - 8} Q${cx - 28} ${cy - 38} ${cx} ${cy - 38} Q${cx + 28} ${cy - 38} ${cx + 28} ${cy - 8} L${cx + 24} ${cy - 4} L${cx - 24} ${cy - 4} Z`} fill={OLIVE} />
      <path d={`M${cx - 28} ${cy - 8} Q${cx - 28} ${cy - 38} ${cx} ${cy - 38} Q${cx + 28} ${cy - 38} ${cx + 28} ${cy - 8} L${cx + 24} ${cy - 4} L${cx - 24} ${cy - 4} Z`} fill="none" stroke={OLIVE_DARK} strokeWidth={1.5} />
      {/* Helmet shine */}
      <path d={`M${cx - 20} ${cy - 30} Q${cx - 24} ${cy - 20} ${cx - 22} ${cy - 12}`} stroke={OLIVE_LIGHT} strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.6} />
      {/* Visor */}
      <path d={`M${cx - 24} ${cy - 4} L${cx + 24} ${cy - 4} L${cx + 20} ${cy + 4} L${cx - 20} ${cy + 4} Z`} fill="rgba(0,0,0,0.6)" />
      {/* Face */}
      <ellipse cx={cx} cy={cy + 6} rx={20} ry={18} fill={SKIN} />
      {/* Cheek */}
      <circle cx={cx - 14} cy={cy + 10} r={3} fill={PINK} opacity={0.3} />
      <circle cx={cx + 14} cy={cy + 10} r={3} fill={PINK} opacity={0.3} />
      {eyes}
      {mouth}
    </g>
  )
}

export function MascotWave(props: SvgProps) {
  return (
    <svg viewBox="0 0 200 240" fill="none" {...props}>
      {/* Glow */}
      <ellipse cx={100} cy={210} rx={50} ry={8} fill={OLIVE} opacity={0.08} />
      {/* Body */}
      <path d="M70 140 Q70 130 80 128 L120 128 Q130 130 130 140 L130 200 Q130 210 120 210 L80 210 Q70 210 70 200 Z" fill={OLIVE_DARK} />
      {/* Collar */}
      <path d="M80 128 Q100 136 120 128 L120 134 Q100 142 80 134 Z" fill={OLIVE} />
      {/* Name badge */}
      <rect x={88} y={155} width={24} height={16} rx={3} fill={WHITE} opacity={0.9} />
      <rect x={92} y={160} width={16} height={2} rx={1} fill={OLIVE_DARK} />
      <rect x={92} y={165} width={10} height={2} rx={1} fill={OLIVE_DARK} opacity={0.5} />
      {/* Head */}
      <MascotHead cx={100} cy={80} expression="happy" />
      {/* Left arm */}
      <path d="M70 145 L55 175 Q53 180 58 182 L62 184 Q67 186 69 181 L80 155" fill={OLIVE_DARK} />
      {/* Right arm waving */}
      <path d="M130 145 L145 115 Q148 110 153 112 L158 116 Q162 118 160 122 L148 155" fill={OLIVE_DARK} />
      {/* Hand */}
      <circle cx={158} cy={112} r={9} fill={SKIN} />
      <circle cx={158} cy={112} r={9} fill="none" stroke={SKIN_DARK} strokeWidth={1} />
      {/* Motion lines for wave */}
      <path d="M168 100 Q174 98 172 92" stroke={OLIVE_LIGHT} strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.5} />
      <path d="M175 105 Q182 103 180 96" stroke={OLIVE_LIGHT} strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.4} />
      {/* Hi speech bubble */}
      <g>
        <path d="M125 30 Q125 18 137 18 L175 18 Q187 18 187 30 L187 48 Q187 60 175 60 L145 60 L138 68 L140 60 L137 60 Q125 60 125 48 Z" fill={WHITE} />
        <text x={156} y={44} textAnchor="middle" fontSize={16} fontWeight="bold" fill={OLIVE_DARK} fontFamily="system-ui">Hi!</text>
      </g>
      {/* Sparkles */}
      <circle cx={40} cy={60} r={2} fill={OLIVE_LIGHT} opacity={0.5} />
      <circle cx={180} cy={80} r={1.5} fill={AMBER} opacity={0.4} />
      <circle cx={30} cy={120} r={1.5} fill={OLIVE_LIGHT} opacity={0.3} />
    </svg>
  )
}

export function MascotHandoff(props: SvgProps) {
  return (
    <svg viewBox="0 0 280 200" fill="none" {...props}>
      {/* Ground */}
      <ellipse cx={140} cy={185} rx={110} ry={10} fill={OLIVE} opacity={0.06} />
      {/* === Delivery Partner (left) === */}
      <MascotHead cx={70} cy={55} expression="happy" />
      {/* DP Body */}
      <path d="M48 105 Q48 98 56 96 L84 96 Q92 98 92 105 L92 170 Q92 178 84 178 L56 178 Q48 178 48 170 Z" fill={OLIVE_DARK} />
      <path d="M56 96 Q70 104 84 96 L84 102 Q70 108 56 102 Z" fill={OLIVE} />
      {/* DP left arm (holding package) */}
      <path d="M92 110 L115 125 Q120 128 118 133 L114 137 Q110 140 106 136 L90 125" fill={OLIVE_DARK} />
      {/* Package being handed */}
      <g>
        <rect x={108} y={118} width={28} height={28} rx={3} fill={ORANGE} />
        <rect x={108} y={118} width={28} height={28} rx={3} fill="none" stroke="#C2410C" strokeWidth={1.5} />
        <line x1={122} y1={118} x2={122} y2={146} stroke="#C2410C" strokeWidth={1} opacity={0.5} />
        <line x1={108} y1={132} x2={136} y2={132} stroke="#C2410C" strokeWidth={1} opacity={0.5} />
        {/* Tape */}
        <rect x={119} y={118} width={6} height={28} fill="#C2410C" opacity={0.3} />
      </g>
      {/* Sparkle on package */}
      <path d="M140 115 l2 4 l4 2 l-4 2 l-2 4 l-2 -4 l-4 -2 l4 -2 z" fill={AMBER} opacity={0.6} />

      {/* === Customer (right) === */}
      {/* Customer head */}
      <ellipse cx={210} cy={48} rx={22} ry={24} fill={SKIN} />
      {/* Hair */}
      <path d="M188 45 Q188 22 210 22 Q232 22 232 45 L232 40 Q228 30 210 28 Q192 30 188 40 Z" fill="#3D2B1F" />
      {/* Customer eyes */}
      <circle cx={202} cy={50} r={3} fill={DARK_BG} />
      <circle cx={218} cy={50} r={3} fill={DARK_BG} />
      {/* Customer smile */}
      <path d="M202 58 Q210 64 218 58" stroke={DARK_BG} strokeWidth={2} fill="none" strokeLinecap="round" />
      {/* Cheeks */}
      <circle cx={196} cy={56} r={3} fill={PINK} opacity={0.3} />
      <circle cx={224} cy={56} r={3} fill={PINK} opacity={0.3} />
      {/* Customer body */}
      <path d="M188 95 Q188 88 196 86 L224 86 Q232 88 232 95 L232 170 Q232 178 224 178 L196 178 Q188 178 188 170 Z" fill={BLUE} />
      {/* Customer arm reaching for package */}
      <path d="M188 110 L168 125 Q164 128 166 133 L170 137 Q174 140 178 136 L192 125" fill={BLUE} />
      {/* Hand */}
      <circle cx={170} cy={130} r={8} fill={SKIN} />

      {/* Connection sparkles between them */}
      <circle cx={155} cy={100} r={2} fill={OLIVE_LIGHT} opacity={0.5} />
      <circle cx={148} cy={110} r={1.5} fill={AMBER} opacity={0.4} />
    </svg>
  )
}

export function MascotOnBike(props: SvgProps) {
  return (
    <svg viewBox="0 0 240 200" fill="none" {...props}>
      {/* Ground line */}
      <ellipse cx={120} cy={180} rx={90} ry={6} fill={OLIVE} opacity={0.06} />
      {/* Speed lines behind */}
      <path d="M20 100 L50 100" stroke={OLIVE_LIGHT} strokeWidth={2} strokeLinecap="round" opacity={0.3} />
      <path d="M15 115 L45 115" stroke={OLIVE_LIGHT} strokeWidth={2} strokeLinecap="round" opacity={0.2} />
      <path d="M25 130 L48 130" stroke={OLIVE_LIGHT} strokeWidth={2} strokeLinecap="round" opacity={0.25} />
      {/* === Scooter === */}
      {/* Body */}
      <path d="M55 150 Q50 140 55 135 L75 130 L120 130 Q130 130 135 138 L140 150 L135 160 L60 160 Q52 160 55 150 Z" fill={OLIVE_DARK} />
      <path d="M55 150 Q50 140 55 135 L75 130 L120 130 Q130 130 135 138 L140 150 L135 160 L60 160 Q52 160 55 150 Z" fill="none" stroke={OLIVE} strokeWidth={1.5} />
      {/* Seat */}
      <path d="M75 130 L110 130 L108 122 L78 122 Z" fill="#1a1a1a" />
      {/* Delivery box */}
      <rect x={80} y={88} width={40} height={36} rx={4} fill={OLIVE} />
      <rect x={80} y={88} width={40} height={36} rx={4} fill="none" stroke={OLIVE_DARK} strokeWidth={1.5} />
      <rect x={86} y={96} width={28} height={20} rx={2} fill={WHITE} opacity={0.9} />
      <text x={100} y={110} textAnchor="middle" fontSize={9} fontWeight="bold" fill={OLIVE_DARK} fontFamily="system-ui">P</text>
      {/* Headlight */}
      <ellipse cx={138} cy={145} rx={6} ry={4} fill={AMBER} opacity={0.7} />
      <path d="M138 145 L170 140 L170 150 L138 148 Z" fill={AMBER} opacity={0.1} />
      {/* Front wheel */}
      <circle cx={140} cy={165} r={16} fill="none" stroke="#333" strokeWidth={4} />
      <circle cx={140} cy={165} r={6} fill="#555" />
      {/* Back wheel */}
      <circle cx={65} cy={165} r={16} fill="none" stroke="#333" strokeWidth={4} />
      <circle cx={65} cy={165} r={6} fill="#555" />
      {/* Handlebar */}
      <path d="M120 130 L130 120 L138 122" stroke="#333" strokeWidth={3} fill="none" strokeLinecap="round" />
      {/* === Rider === */}
      <MascotHead cx={115} cy={65} expression="excited" />
      {/* Rider body leaning forward */}
      <path d="M100 100 Q98 95 105 93 L125 93 Q132 95 130 100 L128 130 L102 130 Z" fill={OLIVE_DARK} />
      {/* Arm to handlebar */}
      <path d="M130 105 L138 120 Q140 124 136 126 L132 128 Q128 130 126 126 L120 115" fill={OLIVE_DARK} />
      {/* Speed sparkles */}
      <circle cx={160} cy={120} r={1.5} fill={AMBER} opacity={0.5} />
      <circle cx={170} cy={110} r={1} fill={OLIVE_LIGHT} opacity={0.4} />
      <circle cx={175} cy={130} r={1.5} fill={AMBER} opacity={0.3} />
    </svg>
  )
}

export function MascotWaiting(props: SvgProps) {
  return (
    <svg viewBox="0 0 200 200" fill="none" {...props}>
      {/* Ground */}
      <ellipse cx={100} cy={180} rx={60} ry={6} fill={OLIVE} opacity={0.06} />
      {/* Head */}
      <ellipse cx={100} cy={50} rx={22} ry={24} fill={SKIN} />
      {/* Hair */}
      <path d="M78 47 Q78 24 100 24 Q122 24 122 47 L122 42 Q118 32 100 30 Q82 32 78 42 Z" fill="#3D2B1F" />
      {/* Eyes looking at phone */}
      <circle cx={93} cy={52} r={3} fill={DARK_BG} />
      <circle cx={107} cy={52} r={3} fill={DARK_BG} />
      {/* Slight smile */}
      <path d="M93 60 Q100 64 107 60" stroke={DARK_BG} strokeWidth={2} fill="none" strokeLinecap="round" />
      {/* Cheeks */}
      <circle cx={86} cy={58} r={3} fill={PINK} opacity={0.3} />
      <circle cx={114} cy={58} r={3} fill={PINK} opacity={0.3} />
      {/* Body */}
      <path d="M78 95 Q78 88 86 86 L114 86 Q122 88 122 95 L122 170 Q122 178 114 178 L86 178 Q78 178 78 170 Z" fill={BLUE} />
      {/* Arms holding phone */}
      <path d="M78 105 L68 130 L78 135 L88 115" fill={BLUE} />
      <path d="M122 105 L132 130 L122 135 L112 115" fill={BLUE} />
      {/* Phone */}
      <rect x={78} y={108} width={44} height={30} rx={4} fill={DARK_BG} />
      <rect x={82} y={112} width={36} height={22} rx={2} fill={OLIVE_DARK} opacity={0.3} />
      {/* Mini radar on phone */}
      <circle cx={100} cy={123} r={8} fill="none" stroke={OLIVE_LIGHT} strokeWidth={1} opacity={0.5} />
      <circle cx={100} cy={123} r={4} fill="none" stroke={OLIVE_LIGHT} strokeWidth={1} opacity={0.4} />
      <circle cx={100} cy={123} r={1.5} fill={OLIVE_LIGHT} />
      {/* Thought bubble with clock */}
      <g>
        <circle cx={150} cy={45} r={20} fill={WHITE} opacity={0.9} />
        <circle cx={150} cy={45} r={20} fill="none" stroke={OLIVE} strokeWidth={1.5} />
        <circle cx={150} cy={45} r={14} fill="none" stroke={OLIVE_DARK} strokeWidth={1.5} />
        <line x1={150} y1={45} x2={150} y2={37} stroke={OLIVE_DARK} strokeWidth={2} strokeLinecap="round" />
        <line x1={150} y1={45} x2={156} y2={48} stroke={OLIVE_DARK} strokeWidth={2} strokeLinecap="round" />
        <circle cx={150} cy={45} r={1.5} fill={OLIVE_DARK} />
        {/* Thought dots */}
        <circle cx={135} cy={70} r={3} fill={WHITE} opacity={0.7} />
        <circle cx={128} cy={80} r={2} fill={WHITE} opacity={0.5} />
      </g>
    </svg>
  )
}

export function HeroScene(props: SvgProps) {
  return (
    <svg viewBox="0 0 400 600" fill="none" preserveAspectRatio="xMidYMid slice" {...props}>
      <defs>
        <radialGradient id="heroGlow" cx="50%" cy="35%" r="50%">
          <stop offset="0%" stopColor={OLIVE} stopOpacity="0.08" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <rect width="400" height="600" fill={DARK_BG} />
      <rect width="400" height="600" fill="url(#heroGlow)" />
      {/* City skyline */}
      <g opacity="0.04">
        <rect x={20} y={350} width={40} height={100} fill={WHITE} />
        <rect x={70} y={300} width={35} height={150} fill={WHITE} />
        <rect x={115} y={330} width={30} height={120} fill={WHITE} />
        <rect x={155} y={280} width={45} height={170} fill={WHITE} />
        <rect x={210} y={320} width={30} height={130} fill={WHITE} />
        <rect x={250} y={290} width={40} height={160} fill={WHITE} />
        <rect x={300} y={340} width={35} height={110} fill={WHITE} />
        <rect x={345} y={310} width={30} height={140} fill={WHITE} />
      </g>
      {/* Floating dots */}
      <circle cx={60} cy={100} r={3} fill={OLIVE} opacity={0.15} />
      <circle cx={340} cy={150} r={2} fill={OLIVE_LIGHT} opacity={0.12} />
      <circle cx={80} cy={250} r={2} fill={OLIVE} opacity={0.1} />
      <circle cx={320} cy={280} r={3} fill={OLIVE_LIGHT} opacity={0.1} />
    </svg>
  )
}

export function IllusHeroCard(props: SvgProps) {
  return (
    <svg viewBox="0 0 400 200" fill="none" preserveAspectRatio="xMidYMid slice" {...props}>
      <defs>
        <linearGradient id="heroCardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={OLIVE_DARK} stopOpacity="0.15" />
          <stop offset="100%" stopColor={DARK_BG} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="400" height="200" fill="url(#heroCardGrad)" />
      {/* Abstract shapes */}
      <circle cx={320} cy={40} r={50} fill={OLIVE} opacity={0.06} />
      <circle cx={350} cy={150} r={30} fill={OLIVE_LIGHT} opacity={0.05} />
      <path d="M280 60 Q310 40 340 70 Q330 100 300 90 Z" fill={OLIVE} opacity={0.04} />
    </svg>
  )
}

export function IllusEmpty(props: SvgProps) {
  return (
    <svg viewBox="0 0 120 120" fill="none" {...props}>
      <ellipse cx={60} cy={105} rx={35} ry={5} fill={OLIVE} opacity={0.06} />
      {/* Empty box */}
      <path d="M30 55 L60 40 L90 55 L90 90 L60 105 L30 90 Z" fill="none" stroke={OLIVE} strokeWidth={2} opacity={0.3} />
      <path d="M30 55 L60 70 L90 55" fill="none" stroke={OLIVE} strokeWidth={2} opacity={0.3} />
      <path d="M60 70 L60 105" fill="none" stroke={OLIVE} strokeWidth={2} opacity={0.3} />
      {/* Question mark */}
      <text x={60} y={80} textAnchor="middle" fontSize={28} fontWeight="bold" fill={OLIVE} opacity={0.4} fontFamily="system-ui">{'?'}</text>
    </svg>
  )
}

// ===== Category Illustrations =====
export function CategoryIcon({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  const map: Record<string, (p: SvgProps) => JSX.Element> = {
    Shopping: CatShopping,
    Pickup: CatPickup,
    Delivery: CatDelivery,
    Documents: CatDocuments,
    Medicine: CatMedicine,
    Food: CatFood,
    Flowers: CatFlowers,
    Gifts: CatGifts,
    Groceries: CatGroceries,
    Laundry: CatLaundry,
    Courier: CatCourier,
    'Personal Assistant': CatPersonalAssistant,
    'Custom Request': CatCustomRequest,
  }
  const Comp = map[name] || CatCustomRequest
  return <Comp width={size} height={size} viewBox="0 0 48 48" className={className} />
}

function CatShopping(props: SvgProps) {
  return (
    <svg fill="none" {...props}>
      <path d="M12 14 L38 14 L34 36 L16 36 Z" fill="none" stroke={ORANGE} strokeWidth={2.5} strokeLinejoin="round" />
      <path d="M16 14 Q16 8 24 8 Q32 8 32 14" fill="none" stroke={ORANGE} strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={20} cy={24} r={2} fill={ORANGE} />
      <circle cx={30} cy={24} r={2} fill={ORANGE} />
    </svg>
  )
}
function CatPickup(props: SvgProps) {
  return (
    <svg fill="none" {...props}>
      <rect x={8} y={20} width={22} height={18} rx={2} fill="none" stroke={BLUE} strokeWidth={2.5} />
      <path d="M30 26 L40 26 L42 32 L42 38 L30 38" fill="none" stroke={BLUE} strokeWidth={2.5} strokeLinejoin="round" />
      <circle cx={16} cy={40} r={3} fill={BLUE} />
      <circle cx={36} cy={40} r={3} fill={BLUE} />
    </svg>
  )
}
function CatDelivery(props: SvgProps) {
  return (
    <svg fill="none" {...props}>
      <rect x={6} y={14} width={24} height={20} rx={2} fill="none" stroke={TEAL} strokeWidth={2.5} />
      <path d="M30 20 L38 20 L42 26 L42 34 L30 34" fill="none" stroke={TEAL} strokeWidth={2.5} strokeLinejoin="round" />
      <circle cx={14} cy={38} r={3} fill={TEAL} />
      <circle cx={34} cy={38} r={3} fill={TEAL} />
      <line x1={14} y1={24} x2={22} y2={24} stroke={TEAL} strokeWidth={2} strokeLinecap="round" />
    </svg>
  )
}
function CatDocuments(props: SvgProps) {
  return (
    <svg fill="none" {...props}>
      <path d="M14 8 L30 8 L36 14 L36 40 L14 40 Z" fill="none" stroke={PURPLE} strokeWidth={2.5} strokeLinejoin="round" />
      <path d="M30 8 L30 14 L36 14" fill="none" stroke={PURPLE} strokeWidth={2.5} strokeLinejoin="round" />
      <line x1={18} y1={20} x2={32} y2={20} stroke={PURPLE} strokeWidth={2} strokeLinecap="round" />
      <line x1={18} y1={26} x2={32} y2={26} stroke={PURPLE} strokeWidth={2} strokeLinecap="round" />
      <line x1={18} y1={32} x2={28} y2={32} stroke={PURPLE} strokeWidth={2} strokeLinecap="round" />
    </svg>
  )
}
function CatMedicine(props: SvgProps) {
  return (
    <svg fill="none" {...props}>
      <rect x={10} y={16} width={28} height={20} rx={10} fill="none" stroke={RED} strokeWidth={2.5} />
      <line x1={24} y1={16} x2={24} y2={36} stroke={RED} strokeWidth={2.5} />
      <circle cx={24} cy={26} r={4} fill="none" stroke={RED} strokeWidth={2} />
      <path d="M20 10 L28 10" stroke={RED} strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  )
}
function CatFood(props: SvgProps) {
  return (
    <svg fill="none" {...props}>
      <path d="M12 20 L36 20 L34 38 L14 38 Z" fill="none" stroke={AMBER} strokeWidth={2.5} strokeLinejoin="round" />
      <path d="M16 20 Q16 12 24 12 Q32 12 32 20" fill="none" stroke={AMBER} strokeWidth={2.5} />
      <circle cx={20} cy={28} r={2} fill={AMBER} />
      <circle cx={28} cy={30} r={2} fill={AMBER} />
    </svg>
  )
}
function CatFlowers(props: SvgProps) {
  return (
    <svg fill="none" {...props}>
      <circle cx={24} cy={16} r={5} fill={PINK} />
      <circle cx={18} cy={20} r={5} fill={PINK} opacity={0.7} />
      <circle cx={30} cy={20} r={5} fill={PINK} opacity={0.7} />
      <circle cx={20} cy={26} r={5} fill={PINK} opacity={0.5} />
      <circle cx={28} cy={26} r={5} fill={PINK} opacity={0.5} />
      <circle cx={24} cy={22} r={3} fill={AMBER} />
      <path d="M24 30 L24 42" stroke={GREEN} strokeWidth={2.5} strokeLinecap="round" />
      <path d="M24 36 Q20 34 18 36" fill="none" stroke={GREEN} strokeWidth={2} />
    </svg>
  )
}
function CatGifts(props: SvgProps) {
  return (
    <svg fill="none" {...props}>
      <rect x={10} y={20} width={28} height={22} rx={2} fill="none" stroke={PURPLE} strokeWidth={2.5} />
      <line x1={24} y1={20} x2={24} y2={42} stroke={PURPLE} strokeWidth={2} />
      <line x1={10} y1={28} x2={38} y2={28} stroke={PURPLE} strokeWidth={2} />
      <path d="M18 20 Q18 12 24 14 Q30 12 30 20" fill="none" stroke={PURPLE} strokeWidth={2} />
      <circle cx={24} cy={14} r={2} fill={AMBER} />
    </svg>
  )
}
function CatGroceries(props: SvgProps) {
  return (
    <svg fill="none" {...props}>
      <path d="M10 18 L38 18 L36 40 L12 40 Z" fill="none" stroke={GREEN} strokeWidth={2.5} strokeLinejoin="round" />
      <path d="M14 18 Q14 10 24 10 Q34 10 34 18" fill="none" stroke={GREEN} strokeWidth={2.5} />
      <circle cx={20} cy={28} r={3} fill={RED} />
      <path d="M26 26 L30 34" stroke={AMBER} strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  )
}
function CatLaundry(props: SvgProps) {
  return (
    <svg fill="none" {...props}>
      <rect x={8} y={10} width={32} height={30} rx={3} fill="none" stroke={BLUE} strokeWidth={2.5} />
      <circle cx={24} cy={26} r={10} fill="none" stroke={BLUE} strokeWidth={2.5} />
      <circle cx={14} cy={16} r={1.5} fill={BLUE} />
      <circle cx={20} cy={16} r={1.5} fill={BLUE} />
      <circle cx={34} cy={16} r={1.5} fill={BLUE} />
      <circle cx={22} cy={24} r={2} fill={BLUE} opacity={0.5} />
      <circle cx={28} cy={28} r={2} fill={BLUE} opacity={0.5} />
    </svg>
  )
}
function CatCourier(props: SvgProps) {
  return (
    <svg fill="none" {...props}>
      <rect x={8} y={14} width={32} height={24} rx={2} fill="none" stroke={OLIVE} strokeWidth={2.5} />
      <path d="M8 22 L40 22" stroke={OLIVE} strokeWidth={2} />
      <rect x={16} y={26} width={16} height={8} rx={1} fill="none" stroke={OLIVE} strokeWidth={2} />
      <path d="M20 14 L20 10 L28 10 L28 14" fill="none" stroke={OLIVE} strokeWidth={2} />
    </svg>
  )
}
function CatPersonalAssistant(props: SvgProps) {
  return (
    <svg fill="none" {...props}>
      <circle cx={18} cy={16} r={6} fill="none" stroke={TEAL} strokeWidth={2.5} />
      <path d="M8 38 Q8 26 18 26 Q28 26 28 38" fill="none" stroke={TEAL} strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={34} cy={20} r={6} fill="none" stroke={TEAL} strokeWidth={2.5} opacity={0.6} />
      <path d="M28 38 Q28 30 34 30 Q40 30 40 38" fill="none" stroke={TEAL} strokeWidth={2.5} strokeLinecap="round" opacity={0.6} />
    </svg>
  )
}
function CatCustomRequest(props: SvgProps) {
  return (
    <svg fill="none" {...props}>
      <path d="M24 8 L26 18 L36 20 L26 22 L24 32 L22 22 L12 20 L22 18 Z" fill={AMBER} opacity={0.8} />
      <circle cx={36} cy={34} r={4} fill={OLIVE_LIGHT} opacity={0.6} />
      <circle cx={12} cy={36} r={3} fill={PINK} opacity={0.5} />
    </svg>
  )
}

export const CategoryIllustration = CategoryIcon
export const IllusGrocery = CatGroceries

// ===== Feature Carousel Illustrations =====
export function FeatureInstantDelivery(props: SvgProps) {
  return (
    <svg viewBox="0 0 200 140" fill="none" {...props}>
      <ellipse cx={100} cy={125} rx={70} ry={6} fill={AMBER} opacity={0.06} />
      {/* Lightning bolt */}
      <path d="M155 25 L145 50 L155 50 L145 75" stroke={AMBER} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M155 25 L145 50 L155 50 L145 75" fill={AMBER} opacity={0.15} />
      {/* Mini bike */}
      <circle cx={70} cy={100} r={14} fill="none" stroke="#444" strokeWidth={3} />
      <circle cx={130} cy={100} r={14} fill="none" stroke="#444" strokeWidth={3} />
      <path d="M55 95 L85 90 L125 90 L140 95 L140 105 L55 105 Z" fill={OLIVE_DARK} />
      <rect x={80} y={65} width={30} height={28} rx={3} fill={OLIVE} />
      <text x={95} y={82} textAnchor="middle" fontSize={10} fontWeight="bold" fill={DARK_BG} fontFamily="system-ui">P</text>
      {/* 10 min badge */}
      <g>
        <circle cx={45} cy={45} r={18} fill={AMBER} />
        <text x={45} y={42} textAnchor="middle" fontSize={8} fontWeight="bold" fill={DARK_BG} fontFamily="system-ui">10</text>
        <text x={45} y={52} textAnchor="middle" fontSize={6} fontWeight="bold" fill={DARK_BG} fontFamily="system-ui">MIN</text>
      </g>
    </svg>
  )
}

export function FeatureAdvanceBooking(props: SvgProps) {
  return (
    <svg viewBox="0 0 200 140" fill="none" {...props}>
      <ellipse cx={100} cy={125} rx={70} ry={6} fill={BLUE} opacity={0.06} />
      {/* Calendar */}
      <rect x={55} y={30} width={90} height={75} rx={6} fill="none" stroke={BLUE} strokeWidth={2.5} />
      <rect x={55} y={30} width={90} height={18} rx={6} fill={BLUE} opacity={0.15} />
      <line x1={70} y1={22} x2={70} y2={36} stroke={BLUE} strokeWidth={3} strokeLinecap="round" />
      <line x1={130} y1={22} x2={130} y2={36} stroke={BLUE} strokeWidth={3} strokeLinecap="round" />
      {/* Date grid */}
      {[0, 1, 2].map(row =>
        [0, 1, 2, 3].map(col => (
          <circle key={`${row}-${col}`} cx={70 + col * 18} cy={62 + row * 14} r={3} fill={BLUE} opacity={0.2} />
        ))
      )}
      {/* Selected date */}
      <circle cx={88} cy={76} r={8} fill={BLUE} />
      <path d="M84 76 L87 79 L92 73" stroke={WHITE} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Clock */}
      <circle cx={155} cy={100} r={16} fill="none" stroke={BLUE} strokeWidth={2.5} />
      <line x1={155} y1={100} x2={155} y2={92} stroke={BLUE} strokeWidth={2} strokeLinecap="round" />
      <line x1={155} y1={100} x2={161} y2={103} stroke={BLUE} strokeWidth={2} strokeLinecap="round" />
    </svg>
  )
}

export function FeatureOrderYourWay(props: SvgProps) {
  return (
    <svg viewBox="0 0 200 140" fill="none" {...props}>
      <ellipse cx={100} cy={125} rx={70} ry={6} fill={PURPLE} opacity={0.06} />
      {/* Clipboard */}
      <rect x={50} y={25} width={70} height={90} rx={5} fill="none" stroke={PURPLE} strokeWidth={2.5} />
      <rect x={70} y={18} width={30} height={12} rx={3} fill={PURPLE} opacity={0.3} />
      {/* Checklist items */}
      {[0, 1, 2].map(i => (
        <g key={i}>
          <rect x={58} y={42 + i * 20} width={10} height={10} rx={2} fill="none" stroke={PURPLE} strokeWidth={2} />
          <path d={`M${60} ${47 + i * 20} L${63} ${50 + i * 20} L${67} ${44 + i * 20}`} stroke={PURPLE} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <line x1={74} y1={47 + i * 20} x2={108} y2={47 + i * 20} stroke={PURPLE} strokeWidth={2} strokeLinecap="round" opacity={0.4} />
        </g>
      ))}
      {/* Pen */}
      <path d="M130 40 L150 60 L145 70 L125 50 Z" fill={PURPLE} opacity={0.6} />
      <path d="M125 50 L130 40 L133 43 L128 53 Z" fill={PURPLE} />
    </svg>
  )
}

export function FeatureAskAnything(props: SvgProps) {
  return (
    <svg viewBox="0 0 200 140" fill="none" {...props}>
      <ellipse cx={100} cy={125} rx={70} ry={6} fill={TEAL} opacity={0.06} />
      {/* Chat bubbles */}
      <path d="M30 30 Q30 22 38 22 L80 22 Q88 22 88 30 L88 50 Q88 58 80 58 L50 58 L40 66 L42 58 L38 58 Q30 58 30 50 Z" fill={TEAL} opacity={0.15} />
      <circle cx={45} cy={36} r={2} fill={TEAL} />
      <circle cx={55} cy={36} r={2} fill={TEAL} />
      <circle cx={65} cy={36} r={2} fill={TEAL} />
      <path d="M100 60 Q100 52 108 52 L165 52 Q173 52 173 60 L173 82 Q173 90 165 90 L130 90 L120 98 L122 90 L108 90 Q100 90 100 82 Z" fill={TEAL} opacity={0.25} />
      <text x={136} y={76} textAnchor="middle" fontSize={18} fontWeight="bold" fill={TEAL} fontFamily="system-ui">{'?'}</text>
      {/* Mini items */}
      <rect x={110} y={100} width={12} height={12} rx={2} fill={ORANGE} opacity={0.5} />
      <circle cx={140} cy={106} r={6} fill={RED} opacity={0.4} />
      <rect x={155} y={100} width={12} height={12} rx={2} fill={GREEN} opacity={0.4} />
    </svg>
  )
}

export function FeatureGetEverything(props: SvgProps) {
  return (
    <svg viewBox="0 0 200 140" fill="none" {...props}>
      <ellipse cx={100} cy={125} rx={70} ry={6} fill={ORANGE} opacity={0.06} />
      {/* Shopping bag */}
      <path d="M60 50 L140 50 L132 120 L68 120 Z" fill="none" stroke={ORANGE} strokeWidth={2.5} strokeLinejoin="round" />
      <path d="M75 50 Q75 30 100 30 Q125 30 125 50" fill="none" stroke={ORANGE} strokeWidth={2.5} />
      {/* Items overflowing */}
      <circle cx={85} cy={42} r={8} fill={RED} opacity={0.7} />
      <path d="M100 35 Q100 25 108 25 Q116 25 116 35 L116 42 L100 42 Z" fill={AMBER} opacity={0.7} />
      <rect x={112} y={38} width={14} height={14} rx={2} fill={BLUE} opacity={0.6} />
      {/* Inside bag items */}
      <circle cx={85} cy={75} r={6} fill={GREEN} opacity={0.4} />
      <rect x={100} y={70} width={12} height={12} rx={2} fill={PURPLE} opacity={0.4} />
      <circle cx={115} cy={80} r={5} fill={RED} opacity={0.4} />
    </svg>
  )
}

export function FeatureLocalPartners(props: SvgProps) {
  return (
    <svg viewBox="0 0 200 140" fill="none" {...props}>
      <ellipse cx={100} cy={125} rx={70} ry={6} fill={GREEN} opacity={0.06} />
      {/* Map pin */}
      <path d="M100 30 Q80 30 80 50 Q80 70 100 95 Q120 70 120 50 Q120 30 100 30 Z" fill={GREEN} opacity={0.2} />
      <path d="M100 30 Q80 30 80 50 Q80 70 100 95 Q120 70 120 50 Q120 30 100 30 Z" fill="none" stroke={GREEN} strokeWidth={2.5} />
      <circle cx={100} cy={50} r={8} fill={GREEN} />
      {/* Nearby partner dots */}
      <circle cx={60} cy={70} r={6} fill={OLIVE} opacity={0.5} />
      <circle cx={140} cy={65} r={6} fill={OLIVE} opacity={0.5} />
      <circle cx={70} cy={100} r={5} fill={OLIVE} opacity={0.4} />
      <circle cx={130} cy={105} r={5} fill={OLIVE} opacity={0.4} />
      {/* Connection lines */}
      <path d="M100 50 L60 70" stroke={GREEN} strokeWidth={1.5} opacity={0.3} strokeDasharray="3 3" />
      <path d="M100 50 L140 65" stroke={GREEN} strokeWidth={1.5} opacity={0.3} strokeDasharray="3 3" />
      <path d="M100 50 L70 100" stroke={GREEN} strokeWidth={1.5} opacity={0.2} strokeDasharray="3 3" />
      <path d="M100 50 L130 105" stroke={GREEN} strokeWidth={1.5} opacity={0.2} strokeDasharray="3 3" />
    </svg>
  )
}

export function FeatureTrackLive(props: SvgProps) {
  return (
    <svg viewBox="0 0 200 140" fill="none" {...props}>
      <ellipse cx={100} cy={125} rx={70} ry={6} fill={OLIVE} opacity={0.06} />
      {/* Route path */}
      <path d="M30 100 Q50 80 70 90 T130 80 Q150 70 170 50" fill="none" stroke={OLIVE} strokeWidth={2.5} strokeDasharray="5 4" strokeLinecap="round" />
      {/* Start dot */}
      <circle cx={30} cy={100} r={6} fill={BLUE} />
      {/* End dot */}
      <circle cx={170} cy={50} r={6} fill={RED} />
      {/* Moving bike on path */}
      <g>
        <circle cx={100} cy={85} r={10} fill={OLIVE} opacity={0.2} />
        <circle cx={100} cy={85} r={6} fill={OLIVE} />
        <text x={100} y={89} textAnchor="middle" fontSize={8} fontWeight="bold" fill={DARK_BG} fontFamily="system-ui">P</text>
      </g>
      {/* LIVE badge */}
      <g>
        <rect x={75} y={25} width={36} height={16} rx={8} fill={RED} />
        <circle cx={83} cy={33} r={3} fill={WHITE} />
        <text x={98} y={36} textAnchor="middle" fontSize={8} fontWeight="bold" fill={WHITE} fontFamily="system-ui">LIVE</text>
      </g>
    </svg>
  )
}
