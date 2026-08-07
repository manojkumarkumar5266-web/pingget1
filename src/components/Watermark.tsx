import { Images } from '../lib/customImages'

/** Lightweight logo watermark — avoids heavy SVG text pattern (faster paint). */
export default function Watermark() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 flex items-center justify-center" style={{ opacity: 0.03 }}>
        <img src={Images.logo} alt="" className="h-64 w-64 object-contain -rotate-[25deg]" draggable={false} />
      </div>
    </div>
  )
}
