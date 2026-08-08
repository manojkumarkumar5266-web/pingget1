import { pg } from '../design/tokens'

/** Soft lime atmosphere — no logo watermark */
export default function Watermark() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 15% 0%, ${pg.limeDim}, transparent 42%), radial-gradient(ellipse at 90% 100%, rgba(212,240,0,0.05), transparent 40%)`,
        }}
      />
    </div>
  )
}
