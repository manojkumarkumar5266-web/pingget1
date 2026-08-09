import { useState } from 'react'
import { MapPin, Camera, Bell } from 'lucide-react'
import Brand from './Brand'
import { pg } from '../design/tokens'
import { CTA, Surface } from '../design/primitives'

type PermissionStep = 'gps' | 'camera' | 'notifications'

const STEPS: { key: PermissionStep; icon: typeof MapPin; emoji: string; title: string; desc: string }[] = [
  { key: 'gps', icon: MapPin, emoji: '📍', title: 'Location Access', desc: 'We use your location to match you with nearby delivery partners and show accurate live tracking.' },
  { key: 'camera', icon: Camera, emoji: '📷', title: 'Camera Access', desc: 'Take delivery proof photos and capture your profile picture to complete your account.' },
  { key: 'notifications', icon: Bell, emoji: '🔔', title: 'Notifications', desc: 'Get notified about order updates, partner messages, and delivery confirmations in real time.' },
]

export default function PermissionOnboarding({ onComplete }: { onComplete: () => void }) {
  const [stepIdx, setStepIdx] = useState(0)
  const [granted, setGranted] = useState<Record<string, boolean>>({})
  const current = STEPS[stepIdx]

  const [requesting, setRequesting] = useState(false)

  const requestPermission = async () => {
    setRequesting(true)
    try {
      if (current.key === 'gps') {
        if (navigator.geolocation) {
          await new Promise<void>((resolve) => {
            navigator.geolocation.getCurrentPosition(
              () => { setGranted(prev => ({ ...prev, gps: true })); resolve() },
              () => { setGranted(prev => ({ ...prev, gps: false })); resolve() },
              { timeout: 10000 }
            )
          })
        } else { setGranted(prev => ({ ...prev, gps: false })) }
      } else if (current.key === 'camera') {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true })
          stream.getTracks().forEach(t => t.stop())
          setGranted(prev => ({ ...prev, camera: true }))
        } catch { setGranted(prev => ({ ...prev, camera: false })) }
      } else if (current.key === 'notifications') {
        if ('Notification' in window && Notification.permission !== 'granted') {
          const result = await Notification.requestPermission()
          setGranted(prev => ({ ...prev, notifications: result === 'granted' }))
        } else if (Notification.permission === 'granted') {
          setGranted(prev => ({ ...prev, notifications: true }))
        } else { setGranted(prev => ({ ...prev, notifications: false })) }
      }
    } finally {
      setRequesting(false)
    }
  }

  const handleNext = async () => {
    if (!granted[current.key]) {
      await requestPermission()
      return
    }
    if (stepIdx < STEPS.length - 1) setStepIdx(stepIdx + 1)
    else onComplete()
  }
  const handleSkip = () => {
    if (stepIdx < STEPS.length - 1) setStepIdx(stepIdx + 1)
    else onComplete()
  }

  const isGranted = granted[current.key]

  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center px-5" style={{ background: pg.bg }}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full blur-[80px]" style={{ background: pg.limeDim }} />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Brand size="md" showTagline />
          <div className="text-center">
            <h2 className="text-xl font-extrabold tracking-tight">Quick Setup</h2>
            <p className="text-sm" style={{ color: pg.text3 }}>Step {stepIdx + 1} of {STEPS.length}</p>
          </div>
          <div className="flex gap-2">
            {STEPS.map((s, i) => (
              <div
                key={s.key}
                className="h-1.5 rounded-full transition-all duration-400"
                style={{ width: i === stepIdx ? 28 : 10, background: i <= stepIdx ? pg.lime : 'rgba(255,255,255,0.12)' }}
              />
            ))}
          </div>
        </div>

        <Surface className="animate-slide-up p-6">
          <div className="mb-5 flex flex-col items-center gap-3 text-center">
            <div
              className={`flex h-20 w-20 items-center justify-center rounded-3xl text-4xl transition-all ${isGranted ? 'animate-bounce-in' : 'animate-float'}`}
              style={isGranted
                ? { background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.28)' }
                : { background: pg.limeDim, border: '1px solid rgba(196,214,0,0.22)' }}
            >
              {isGranted ? '✅' : current.emoji}
            </div>
            <div>
              <h3 className="text-xl font-extrabold tracking-tight">{current.title}</h3>
              {isGranted && <p className="mt-1 text-sm font-bold" style={{ color: pg.success }}>Permission Granted!</p>}
            </div>
            <p className="text-sm leading-relaxed" style={{ color: pg.text3 }}>{current.desc}</p>
          </div>
          <div className="flex gap-2">
            <CTA variant="secondary" onClick={handleSkip} className="flex-1">Skip</CTA>
            <CTA onClick={handleNext} disabled={requesting} className="flex-1">
              {requesting ? 'Requesting...' : isGranted ? 'Continue' : 'Allow'}
            </CTA>
          </div>
        </Surface>
      </div>
    </div>
  )
}
