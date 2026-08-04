import type { CSSProperties } from 'react'

const ACCENT = '#A6B300'
const ACCENT_LIGHT = '#C0D900'
const ACCENT_DARK = '#7a8500'
const BG_DARK = '#181818'
const SURFACE = '#232323'
const WHITE = '#ffffff'
const MUTED = 'rgba(255,255,255,0.5)'

type IllustrationProps = {
  className?: string
  style?: CSSProperties
}

/* ═══════════════════════════════════════════════
   PingGET Delivery Mascot — a friendly, rounded
   character wearing a helmet, riding a scooter
   with a delivery box. Brand olive-green palette.
   ═══════════════════════════════════════════════ */
export function MascotDelivery({ className, style }: IllustrationProps) {
  return (
    <svg viewBox="0 0 400 500" fill="none" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      {/* Ground shadow */}
      <ellipse cx="200" cy="460" rx="120" ry="18" fill="rgba(0,0,0,0.35)" />

      {/* Scooter body */}
      <path d="M120 380 Q100 370 105 350 L130 320 Q140 310 155 315 L260 315 Q280 315 285 330 L295 370 Q295 385 280 388 L140 388 Q122 388 120 380Z" fill={ACCENT_DARK} />
      {/* Seat */}
      <path d="M140 322 Q160 314 190 316 L255 316 Q268 316 270 326 L262 334 L145 334 Z" fill={SURFACE} />
      {/* Delivery box */}
      <rect x="150" y="270" width="90" height="55" rx="8" fill={ACCENT} />
      <rect x="150" y="270" width="90" height="55" rx="8" fill="none" stroke={ACCENT_LIGHT} strokeWidth="1.5" />
      <path d="M165 285 L225 285 M165 295 L210 295" stroke={ACCENT_DARK} strokeWidth="2" strokeLinecap="round" />
      <text x="195" y="312" textAnchor="middle" fontSize="10" fontWeight="bold" fill={BG_DARK} fontFamily="system-ui">pinGGet</text>

      {/* Front wheel */}
      <circle cx="120" cy="395" r="28" fill="none" stroke={SURFACE} strokeWidth="6" />
      <circle cx="120" cy="395" r="14" fill={BG_DARK} stroke={ACCENT_DARK} strokeWidth="2" />
      <circle cx="120" cy="395" r="4" fill={ACCENT} />

      {/* Back wheel */}
      <circle cx="285" cy="395" r="28" fill="none" stroke={SURFACE} strokeWidth="6" />
      <circle cx="285" cy="395" r="14" fill={BG_DARK} stroke={ACCENT_DARK} strokeWidth="2" />
      <circle cx="285" cy="395" r="4" fill={ACCENT} />

      {/* Handlebar */}
      <path d="M285 330 Q300 335 305 350 M305 350 L315 345" stroke={SURFACE} strokeWidth="5" strokeLinecap="round" fill="none" />

      {/* Character body — torso */}
      <path d="M175 220 Q165 240 168 270 L235 270 Q238 240 228 220 Z" fill={ACCENT} />
      {/* Arm reaching handlebar */}
      <path d="M225 235 Q255 250 280 340" stroke={ACCENT} strokeWidth="14" strokeLinecap="round" fill="none" />
      {/* Hand */}
      <circle cx="305" cy="345" r="8" fill="#E8C9A0" />

      {/* Character head — rounded */}
      <circle cx="200" cy="185" r="38" fill="#E8C9A0" />
      {/* Helmet */}
      <path d="M162 185 Q162 145 200 142 Q238 145 238 185 L238 175 Q238 150 200 148 Q162 150 162 175 Z" fill={ACCENT_DARK} />
      <path d="M162 175 Q162 150 200 148 Q238 150 238 175 L238 168 Q238 145 200 143 Q162 145 162 168 Z" fill={ACCENT} />
      {/* Helmet visor */}
      <path d="M170 180 Q200 175 230 180 L228 195 Q200 190 172 195 Z" fill="rgba(0,0,0,0.6)" />
      {/* Smile */}
      <path d="M188 200 Q200 208 212 200" stroke={BG_DARK} strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* Eyes — happy dots */}
      <circle cx="190" cy="192" r="2.5" fill={BG_DARK} />
      <circle cx="210" cy="192" r="2.5" fill={BG_DARK} />

      {/* Motion lines */}
      <path d="M55 340 L85 340 M50 360 L75 360 M60 320 L85 320" stroke={ACCENT} strokeWidth="3" strokeLinecap="round" opacity="0.6" />

      {/* Sparkle accents */}
      <g opacity="0.7">
        <path d="M330 180 L335 190 L345 195 L335 200 L330 210 L325 200 L315 195 L325 190 Z" fill={ACCENT_LIGHT} />
        <path d="M60 200 L63 207 L70 210 L63 213 L60 220 L57 213 L50 210 L57 207 Z" fill={ACCENT_LIGHT} opacity="0.5" />
      </g>
    </svg>
  )
}

/* ═══════════════════════════════════════════════
   Mascot waving — used on welcome / landing
   ═══════════════════════════════════════════════ */
export function MascotWave({ className, style }: IllustrationProps) {
  return (
    <svg viewBox="0 0 300 360" fill="none" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      {/* Shadow */}
      <ellipse cx="150" cy="340" rx="80" ry="12" fill="rgba(0,0,0,0.3)" />

      {/* Body */}
      <path d="M120 200 Q110 230 113 280 L187 280 Q190 230 180 200 Z" fill={ACCENT} />

      {/* Head */}
      <circle cx="150" cy="160" r="42" fill="#E8C9A0" />
      {/* Helmet */}
      <path d="M108 160 Q108 115 150 112 Q192 115 192 160 L192 148 Q192 118 150 116 Q108 118 108 148 Z" fill={ACCENT_DARK} />
      <path d="M108 148 Q108 118 150 116 Q192 118 192 148 L192 140 Q192 112 150 110 Q108 112 108 140 Z" fill={ACCENT} />
      {/* Visor */}
      <path d="M116 155 Q150 150 184 155 L182 172 Q150 167 118 172 Z" fill="rgba(0,0,0,0.55)" />
      {/* Smile */}
      <path d="M136 178 Q150 186 164 178" stroke={BG_DARK} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Eyes */}
      <circle cx="138" cy="170" r="3" fill={BG_DARK} />
      <circle cx="162" cy="170" r="3" fill={BG_DARK} />

      {/* Waving arm */}
      <path d="M180 215 Q210 185 225 140" stroke={ACCENT} strokeWidth="14" strokeLinecap="round" fill="none" />
      {/* Hand waving */}
      <circle cx="225" cy="135" r="10" fill="#E8C9A0" />
      {/* Wave lines */}
      <path d="M245 115 L255 105 M250 130 L265 128 M242 145 L255 150" stroke={ACCENT_LIGHT} strokeWidth="2.5" strokeLinecap="round" />

      {/* Other arm */}
      <path d="M120 215 Q105 245 110 275" stroke={ACCENT} strokeWidth="14" strokeLinecap="round" fill="none" />

      {/* Delivery bag at feet */}
      <rect x="125" y="290" width="50" height="35" rx="6" fill={ACCENT_DARK} />
      <rect x="125" y="290" width="50" height="35" rx="6" fill="none" stroke={ACCENT_LIGHT} strokeWidth="1" />
      <path d="M135 305 L165 305 M135 312 L158 312" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" />

      {/* Sparkles */}
      <g opacity="0.6">
        <path d="M250 200 L254 208 L262 212 L254 216 L250 224 L246 216 L238 212 L246 208 Z" fill={ACCENT_LIGHT} />
        <path d="M55 130 L58 136 L64 139 L58 142 L55 148 L52 142 L46 139 L52 136 Z" fill={ACCENT_LIGHT} opacity="0.4" />
      </g>
    </svg>
  )
}

/* ═══════════════════════════════════════════════
   Hero scene — mascot on scooter with city skyline
   silhouette. Used on landing page background.
   ═══════════════════════════════════════════════ */
export function HeroScene({ className, style }: IllustrationProps) {
  return (
    <svg viewBox="0 0 800 600" fill="none" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      {/* Sky gradient backdrop */}
      <defs>
        <linearGradient id="heroSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0B0B0B" />
          <stop offset="60%" stopColor="#141414" />
          <stop offset="100%" stopColor="#1a1a1a" />
        </linearGradient>
        <radialGradient id="heroGlow" cx="50%" cy="45%" r="40%">
          <stop offset="0%" stopColor="rgba(166,179,0,0.15)" />
          <stop offset="100%" stopColor="rgba(166,179,0,0)" />
        </radialGradient>
      </defs>
      <rect width="800" height="600" fill="url(#heroSky)" />
      <rect width="800" height="600" fill="url(#heroGlow)" />

      {/* City skyline silhouette */}
      <g fill={BG_DARK} opacity="0.7">
        <rect x="0" y="380" width="60" height="220" />
        <rect x="55" y="340" width="50" height="260" />
        <rect x="100" y="360" width="70" height="240" />
        <rect x="165" y="320" width="45" height="280" />
        <rect x="205" y="370" width="60" height="230" />
        <rect x="530" y="350" width="55" height="250" />
        <rect x="580" y="310" width="50" height="290" />
        <rect x="625" y="370" width="65" height="230" />
        <rect x="685" y="340" width="55" height="260" />
        <rect x="735" y="360" width="65" height="240" />
      </g>
      {/* Building windows */}
      <g fill={ACCENT} opacity="0.3">
        <rect x="65" y="360" width="6" height="8" />
        <rect x="78" y="360" width="6" height="8" />
        <rect x="65" y="380" width="6" height="8" />
        <rect x="175" y="340" width="6" height="8" />
        <rect x="188" y="360" width="6" height="8" />
        <rect x="590" y="330" width="6" height="8" />
        <rect x="603" y="350" width="6" height="8" />
        <rect x="700" y="360" width="6" height="8" />
        <rect x="713" y="380" width="6" height="8" />
      </g>

      {/* Road */}
      <rect x="0" y="520" width="800" height="80" fill="#0F0F0F" />
      <line x1="0" y1="555" x2="800" y2="555" stroke={ACCENT_DARK} strokeWidth="2" strokeDasharray="30 20" opacity="0.5" />

      {/* Mascot on scooter — centered */}
      <g transform="translate(220, 130) scale(0.72)">
        <MascotDelivery />
      </g>

      {/* Floating elements */}
      <g opacity="0.5">
        {/* Floating package icon */}
        <rect x="620" y="120" width="36" height="36" rx="6" fill="none" stroke={ACCENT} strokeWidth="2" />
        <path d="M620 138 L656 138 M638 120 L638 156" stroke={ACCENT} strokeWidth="1.5" />
        {/* Floating chat bubble */}
        <rect x="100" y="100" width="50" height="32" rx="16" fill="none" stroke={ACCENT_LIGHT} strokeWidth="2" />
        <circle cx="115" cy="116" r="3" fill={ACCENT_LIGHT} />
        <circle cx="127" cy="116" r="3" fill={ACCENT_LIGHT} />
        <circle cx="139" cy="116" r="3" fill={ACCENT_LIGHT} />
      </g>

      {/* Sparkles */}
      <g opacity="0.4">
        <path d="M680 200 L685 212 L697 217 L685 222 L680 234 L675 222 L663 217 L675 212 Z" fill={ACCENT_LIGHT} />
        <path d="M120 280 L124 288 L132 292 L124 296 L120 304 L116 296 L108 292 L116 288 Z" fill={ACCENT_LIGHT} opacity="0.5" />
      </g>
    </svg>
  )
}

/* ═══════════════════════════════════════════════
   Category illustrations — simple, recognizable
   icons drawn in brand style on dark bg
   ═══════════════════════════════════════════════ */
export function IllusGrocery({ className, style }: IllustrationProps) {
  return (
    <svg viewBox="0 0 80 80" fill="none" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      {/* Bag */}
      <path d="M22 28 L58 28 L62 68 L18 68 Z" fill={ACCENT} />
      <path d="M22 28 L58 28 L62 68 L18 68 Z" fill="none" stroke={ACCENT_LIGHT} strokeWidth="1.5" />
      {/* Handles */}
      <path d="M28 28 Q28 16 40 16 Q52 16 52 28" stroke={ACCENT_LIGHT} strokeWidth="2.5" fill="none" />
      {/* Items sticking out */}
      <path d="M30 28 L30 18 Q30 14 34 14 L34 28" fill={BG_DARK} stroke={ACCENT_DARK} strokeWidth="1" />
      <ellipse cx="38" cy="20" rx="5" ry="8" fill="#22C55E" />
      <ellipse cx="48" cy="18" rx="4" ry="7" fill="#F59E0B" />
      {/* Label */}
      <rect x="28" y="42" width="24" height="12" rx="3" fill={BG_DARK} opacity="0.7" />
      <path d="M32 48 L48 48 M32 51 L44 51" stroke={ACCENT_LIGHT} strokeWidth="1" strokeLinecap="round" />
    </svg>
  )
}

export function IllusFood({ className, style }: IllustrationProps) {
  return (
    <svg viewBox="0 0 80 80" fill="none" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      {/* Plate */}
      <circle cx="40" cy="42" r="28" fill={SURFACE} stroke={ACCENT_DARK} strokeWidth="2" />
      <circle cx="40" cy="42" r="22" fill={BG_DARK} />
      {/* Food sections */}
      <path d="M40 22 Q30 30 28 42 Q40 46 52 42 Q50 30 40 22Z" fill={ACCENT} />
      <path d="M28 42 Q30 54 40 60 Q46 52 44 44Z" fill="#F59E0B" opacity="0.8" />
      <path d="M40 60 Q50 54 52 42 L44 44 Q42 52 40 60Z" fill="#EF4444" opacity="0.7" />
      {/* Steam */}
      <path d="M34 18 Q32 14 35 10 M40 16 Q38 12 41 8 M46 18 Q44 14 47 10" stroke={MUTED} strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export function IllusMedicine({ className, style }: IllustrationProps) {
  return (
    <svg viewBox="0 0 80 80" fill="none" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      {/* Bottle */}
      <rect x="26" y="22" width="28" height="42" rx="6" fill={ACCENT} />
      <rect x="26" y="22" width="28" height="42" rx="6" fill="none" stroke={ACCENT_LIGHT} strokeWidth="1.5" />
      {/* Cap */}
      <rect x="30" y="14" width="20" height="10" rx="3" fill={ACCENT_DARK} />
      {/* Cross */}
      <rect x="36" y="36" width="8" height="20" rx="2" fill={WHITE} />
      <rect x="30" y="42" width="20" height="8" rx="2" fill={WHITE} />
      {/* Pills */}
      <ellipse cx="22" cy="56" rx="6" ry="4" fill="#EF4444" opacity="0.8" transform="rotate(-20 22 56)" />
      <ellipse cx="60" cy="58" rx="6" ry="4" fill="#3B82F6" opacity="0.8" transform="rotate(15 60 58)" />
    </svg>
  )
}

export function IllusParcel({ className, style }: IllustrationProps) {
  return (
    <svg viewBox="0 0 80 80" fill="none" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      {/* Box */}
      <path d="M18 30 L40 20 L62 30 L62 56 L40 66 L18 56 Z" fill={ACCENT} />
      <path d="M18 30 L40 40 L62 30" stroke={ACCENT_DARK} strokeWidth="2" fill="none" />
      <path d="M40 40 L40 66" stroke={ACCENT_DARK} strokeWidth="2" />
      {/* Tape */}
      <path d="M36 18 L36 62 M44 18 L44 62" stroke={ACCENT_LIGHT} strokeWidth="2" opacity="0.5" />
      {/* Label */}
      <rect x="28" y="44" width="18" height="10" rx="2" fill={BG_DARK} opacity="0.6" />
      <path d="M31 48 L43 48 M31 51 L39 51" stroke={ACCENT_LIGHT} strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  )
}

/* ═══════════════════════════════════════════════
   Empty state illustration — mascot looking at
   empty clipboard, casual and friendly
   ═══════════════════════════════════════════════ */
export function IllusEmpty({ className, style }: IllustrationProps) {
  return (
    <svg viewBox="0 0 200 200" fill="none" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      {/* Shadow */}
      <ellipse cx="100" cy="175" rx="55" ry="8" fill="rgba(0,0,0,0.25)" />

      {/* Mascot — simplified, smaller */}
      {/* Body */}
      <path d="M80 105 Q73 125 75 150 L125 150 Q127 125 120 105 Z" fill={ACCENT} />
      {/* Head */}
      <circle cx="100" cy="82" r="26" fill="#E8C9A0" />
      {/* Helmet */}
      <path d="M74 82 Q74 52 100 50 Q126 52 126 82 L126 72 Q126 48 100 46 Q74 48 74 72 Z" fill={ACCENT_DARK} />
      <path d="M74 72 Q74 48 100 46 Q126 48 126 72 L126 66 Q126 44 100 42 Q74 44 74 66 Z" fill={ACCENT} />
      <path d="M79 78 Q100 74 121 78 L119 90 Q100 86 81 90 Z" fill="rgba(0,0,0,0.5)" />
      {/* Eyes — looking down at clipboard */}
      <circle cx="92" cy="88" r="2" fill={BG_DARK} />
      <circle cx="108" cy="88" r="2" fill={BG_DARK} />
      {/* Neutral mouth */}
      <path d="M94 98 Q100 100 106 98" stroke={BG_DARK} strokeWidth="1.5" strokeLinecap="round" fill="none" />

      {/* Arm holding clipboard */}
      <path d="M120 112 Q135 120 140 135" stroke={ACCENT} strokeWidth="10" strokeLinecap="round" fill="none" />

      {/* Clipboard */}
      <rect x="130" y="120" width="35" height="45" rx="4" fill={SURFACE} stroke={ACCENT_DARK} strokeWidth="1.5" />
      <rect x="140" y="116" width="15" height="6" rx="2" fill={ACCENT_DARK} />
      {/* Empty lines */}
      <path d="M136 135 L159 135 M136 142 L154 142 M136 149 L157 149" stroke={MUTED} strokeWidth="1" strokeLinecap="round" />

      {/* Other arm */}
      <path d="M80 112 Q72 130 75 148" stroke={ACCENT} strokeWidth="10" strokeLinecap="round" fill="none" />

      {/* Floating question mark / dots */}
      <g opacity="0.4">
        <circle cx="160" cy="80" r="3" fill={ACCENT_LIGHT} />
        <circle cx="170" cy="95" r="2" fill={ACCENT_LIGHT} />
        <circle cx="50" cy="70" r="3" fill={ACCENT_LIGHT} />
        <circle cx="40" cy="85" r="2" fill={ACCENT_LIGHT} />
      </g>
    </svg>
  )
}

/* ═══════════════════════════════════════════════
   Hero card background — abstract brand shapes
   for the user home hero card
   ═══════════════════════════════════════════════ */
export function IllusHeroCard({ className, style }: IllustrationProps) {
  return (
    <svg viewBox="0 0 600 200" fill="none" className={className} style={style} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="heroCardGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(166,179,0,0.12)" />
          <stop offset="100%" stopColor="rgba(166,179,0,0.02)" />
        </linearGradient>
      </defs>
      <rect width="600" height="200" fill="url(#heroCardGrad)" />
      {/* Abstract speed lines */}
      <path d="M400 40 Q450 60 480 100 M420 80 Q460 90 490 120 M380 120 Q430 130 470 160"
        stroke={ACCENT} strokeWidth="2" strokeLinecap="round" opacity="0.15" fill="none" />
      {/* Mini mascot silhouette */}
      <g transform="translate(380, 20) scale(0.28)" opacity="0.25">
        <MascotDelivery />
      </g>
      {/* Dot pattern */}
      <g fill={ACCENT} opacity="0.08">
        <circle cx="50" cy="30" r="2" /><circle cx="80" cy="30" r="2" /><circle cx="110" cy="30" r="2" />
        <circle cx="50" cy="60" r="2" /><circle cx="80" cy="60" r="2" /><circle cx="110" cy="60" r="2" />
        <circle cx="50" cy="90" r="2" /><circle cx="80" cy="90" r="2" /><circle cx="110" cy="90" r="2" />
      </g>
    </svg>
  )
}

/* ═══════════════════════════════════════════════
   Category image resolver — returns the right
   illustration component for a category name
   ═══════════════════════════════════════════════ */
export function CategoryIllustration({ name, className, style }: { name: string; className?: string; style?: CSSProperties }) {
  const lower = name.toLowerCase()
  if (lower.includes('food') || lower.includes('tiffin') || lower.includes('meal')) return <IllusFood className={className} style={style} />
  if (lower.includes('med') || lower.includes('pharm') || lower.includes('drug')) return <IllusMedicine className={className} style={style} />
  if (lower.includes('grocery') || lower.includes('veg') || lower.includes('fruit') || lower.includes('market')) return <IllusGrocery className={className} style={style} />
  return <IllusParcel className={className} style={style} />
}
