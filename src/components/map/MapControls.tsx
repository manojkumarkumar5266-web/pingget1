import { LocateFixed, Navigation, Plus, Minus, Compass, Maximize2, Minimize2, Sun, Moon } from 'lucide-react'
import { useTheme } from '../../context'

type Props = {
  onLocate: () => void
  onFollow: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onCompass: () => void
  onFullscreen: () => void
  isFullscreen: boolean
  isFollowing: boolean
  heading: number | null
}

export default function MapControls({
  onLocate, onFollow, onZoomIn, onZoomOut, onCompass, onFullscreen,
  isFullscreen, isFollowing, heading,
}: Props) {
  const { theme, toggle } = useTheme()

  const btnClass = (active: boolean) =>
    `map-control-btn ${theme === 'dark' ? 'map-control-dark' : 'map-control-light'} ${active ? 'map-control-active' : ''}`

  return (
    <>
      {/* Zoom controls - top right */}
      <div className="absolute right-3 top-20 z-[1000] flex flex-col gap-2">
        <button onClick={onZoomIn} className={btnClass(false)} aria-label="Zoom in">
          <Plus size={20} />
        </button>
        <button onClick={onZoomOut} className={btnClass(false)} aria-label="Zoom out">
          <Minus size={20} />
        </button>
      </div>

      {/* Right side controls - below zoom */}
      <div className="absolute right-3 z-[1000] flex flex-col gap-2" style={{ top: '124px' }}>
        <button onClick={onLocate} className={btnClass(false)} aria-label="Locate me">
          <LocateFixed size={20} />
        </button>
        <button onClick={onFollow} className={btnClass(isFollowing)} aria-label="Follow vehicle">
          <Navigation size={20} />
        </button>
        <button onClick={onCompass} className={btnClass(false)} aria-label="Compass">
          <Compass size={20} className="compass-needle" style={{ transform: heading ? `rotate(${-heading}deg)` : 'none' }} />
        </button>
        <button onClick={onFullscreen} className={btnClass(false)} aria-label="Fullscreen">
          {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
        </button>
        <button onClick={toggle} className={btnClass(false)} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
    </>
  )
}
