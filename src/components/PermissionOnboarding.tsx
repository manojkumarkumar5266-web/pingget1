import { useState, useEffect } from 'react'
import { MapPin, Camera, Mic, Bell, CheckCircle, X, Shield } from 'lucide-react'

type PermissionStep = 'gps' | 'camera' | 'notifications' | 'done'

const STEPS: { key: PermissionStep; icon: typeof MapPin; title: string; desc: string; perm: PermissionName | null }[] = [
  { key: 'gps', icon: MapPin, title: 'Location Access', desc: 'We use your location to match you with nearby delivery partners and show accurate delivery tracking.', perm: 'geolocation' as PermissionName },
  { key: 'camera', icon: Camera, title: 'Camera Access', desc: 'Allow camera access to take delivery proof photos and capture profile pictures.', perm: null },
  { key: 'notifications', icon: Bell, title: 'Notifications', desc: 'Get notified about order updates, delivery partner messages, and payment confirmations.', perm: null },
]

export default function PermissionOnboarding({ onComplete }: { onComplete: () => void }) {
  const [stepIdx, setStepIdx] = useState(0)
  const [granted, setGranted] = useState<Record<string, boolean>>({})

  const current = STEPS[stepIdx]

  const requestPermission = async () => {
    if (current.key === 'gps') {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          () => setGranted(prev => ({ ...prev, gps: true })),
          () => setGranted(prev => ({ ...prev, gps: false })),
          { timeout: 10000 }
        )
      } else {
        setGranted(prev => ({ ...prev, gps: false }))
      }
    } else if (current.key === 'camera') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        stream.getTracks().forEach(t => t.stop())
        setGranted(prev => ({ ...prev, camera: true }))
      } catch {
        setGranted(prev => ({ ...prev, camera: false }))
      }
    } else if (current.key === 'notifications') {
      if ('Notification' in window) {
        const result = await Notification.requestPermission()
        setGranted(prev => ({ ...prev, notifications: result === 'granted' }))
      } else {
        setGranted(prev => ({ ...prev, notifications: false }))
      }
    }
  }

  const handleNext = async () => {
    if (!granted[current.key]) {
      await requestPermission()
    }
    if (stepIdx < STEPS.length - 1) {
      setStepIdx(stepIdx + 1)
    } else {
      onComplete()
    }
  }

  const handleSkip = () => {
    if (stepIdx < STEPS.length - 1) {
      setStepIdx(stepIdx + 1)
    } else {
      onComplete()
    }
  }

  const Icon = current.icon
  const isGranted = granted[current.key]

  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center px-6" style={{ background: 'linear-gradient(160deg, #1c2a14 0%, #2a3d1c 40%, #374524 100%)' }}>
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
            <Shield size={28} className="text-white" />
          </div>
          <h2 className="text-lg font-bold text-white">Set Up Permissions</h2>
          <p className="mt-1 text-xs text-white/50">Step {stepIdx + 1} of {STEPS.length}</p>
        </div>

        <div className="rounded-2xl bg-white p-6 dark:bg-gray-900 animate-slide-up">
          <div className="mb-4 flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${isGranted ? 'bg-success-100 dark:bg-success-900/40' : 'bg-primary-100 dark:bg-primary-900/30'}`}>
              {isGranted ? <CheckCircle size={24} className="text-success-600" /> : <Icon size={24} style={{ color: '#556d34' }} />}
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">{current.title}</h3>
              {isGranted && <span className="text-xs font-medium text-success-600">Granted</span>}
            </div>
          </div>

          <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">{current.desc}</p>

          <div className="flex gap-2">
            <button onClick={handleSkip} className="btn-secondary flex-1 text-sm">
              Skip
            </button>
            <button onClick={handleNext} className="btn-primary flex-1 text-sm">
              {isGranted ? 'Continue' : 'Allow'}
            </button>
          </div>
        </div>

        <div className="mt-4 flex justify-center gap-1.5">
          {STEPS.map((s, i) => (
            <div key={s.key} className={`h-1.5 rounded-full transition-all ${i === stepIdx ? 'w-6 bg-white/60' : i < stepIdx ? 'w-1.5 bg-white/40' : 'w-1.5 bg-white/20'}`} />
          ))}
        </div>
      </div>
    </div>
  )
}
