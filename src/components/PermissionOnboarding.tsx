import { useState } from 'react'
import { MapPin, Camera, Bell, CheckCircle, Shield } from 'lucide-react'

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
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center px-5 bg-[#0B0B0B]">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full blur-[80px]" style={{ background: 'rgba(166,179,0,0.08)' }} />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Progress indicator */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl"
            style={{ background: 'rgba(166,179,0,0.15)', border: '1px solid rgba(166,179,0,0.25)' }}>
            <Shield size={26} style={{ color: '#A6B300' }} />
          </div>
          <div>
            <h2 className="text-center text-xl font-bold text-white">Quick Setup</h2>
            <p className="text-center text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Step {stepIdx + 1} of {STEPS.length}</p>
          </div>
          <div className="flex gap-2">
            {STEPS.map((s, i) => (
              <div key={s.key} className="h-1.5 rounded-full transition-all duration-400"
                style={{ width: i === stepIdx ? 28 : 10, background: i <= stepIdx ? '#A6B300' : 'rgba(255,255,255,0.12)' }} />
            ))}
          </div>
        </div>

        {/* Card */}
        <div className="rounded-3xl p-6 animate-slide-up shadow-modal"
          style={{ background: '#181818', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="mb-5 flex flex-col items-center gap-3 text-center">
            <div className={`flex h-20 w-20 items-center justify-center rounded-3xl text-4xl transition-all ${isGranted ? 'animate-bounce-in' : 'animate-float'}`}
              style={isGranted
                ? { background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.25)' }
                : { background: 'rgba(166,179,0,0.1)', border: '1px solid rgba(166,179,0,0.2)' }}>
              {isGranted ? '✅' : current.emoji}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{current.title}</h3>
              {isGranted && <p className="mt-1 text-sm font-semibold text-green-400">Permission Granted!</p>}
            </div>
            <p className="text-sm leading-relaxed text-center" style={{ color: 'rgba(255,255,255,0.5)' }}>{current.desc}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSkip} className="btn-secondary flex-1">Skip</button>
            <button onClick={handleNext} disabled={requesting} className="flex-1 btn font-bold disabled:opacity-50" style={{ background: '#A6B300', color: '#0B0B0B' }}>
              {requesting ? 'Requesting...' : isGranted ? 'Continue' : 'Allow'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
