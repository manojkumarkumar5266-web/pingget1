import { useEffect, useState } from 'react'
import { MapPin, Mail, X, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../context'
import { pg } from '../design/tokens'
import {
  checkLiveServiceArea,
  submitServiceAreaWaitlist,
  type ServiceAreaResult,
} from '../lib/serviceArea'

const DISMISS_KEY = 'pingget_service_area_dismissed'

/**
 * After sign-in/sign-up: background GPS → compare with admin active cities/pincodes.
 * Active area → silent. Inactive → centered notice + optional email notify waitlist.
 */
export default function ServiceAreaNotice() {
  const { profile } = useAuth()
  const [result, setResult] = useState<ServiceAreaResult | null>(null)
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [wantNotify, setWantNotify] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (!profile?.id) return
    let cancelled = false

    const run = async () => {
      setChecking(true)
      try {
        const area = await checkLiveServiceArea(profile.pincode)
        if (cancelled) return
        setResult(area)

        // Persist detected pincode/city lightly when missing on profile
        if (area.pincode && (!profile.pincode || profile.pincode !== area.pincode)) {
          const { supabase } = await import('../lib/supabase')
          await supabase
            .from('profiles')
            .update({
              pincode: area.pincode,
              ...(area.cityName && !profile.city ? { city: area.cityName } : {}),
              ...(area.lat != null ? { gps_lat: area.lat, gps_lng: area.lng } : {}),
            } as any)
            .eq('id', profile.id)
        }

        if (area.served && !area.paused) {
          setOpen(false)
          return
        }

        const dismissed = sessionStorage.getItem(`${DISMISS_KEY}:${profile.id}`)
        if (!dismissed) {
          setEmail(profile.email || '')
          setOpen(true)
        }
      } catch {
        /* non-blocking */
      } finally {
        if (!cancelled) setChecking(false)
      }
    }

    // Small delay so permission onboarding / GPS can settle
    const t = setTimeout(run, 1200)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [profile?.id, profile?.pincode, profile?.city, profile?.email])

  if (checking || !result) return null
  if (result.served && !result.paused) return null
  if (!open) return null

  const dismiss = () => {
    if (profile?.id) sessionStorage.setItem(`${DISMISS_KEY}:${profile.id}`, '1')
    setOpen(false)
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!wantNotify) {
      dismiss()
      return
    }
    setSubmitting(true)
    const res = await submitServiceAreaWaitlist({
      userId: profile?.id,
      email,
      pincode: result.pincode,
      areaName: result.areaName,
      cityName: result.cityName,
      lat: result.lat,
      lng: result.lng,
      source: 'user_home_gps',
    })
    setSubmitting(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setSubmitted(true)
    if (profile?.id) sessionStorage.setItem(`${DISMISS_KEY}:${profile.id}`, '1')
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-[#000000]/75" onClick={dismiss} />
      <div
        className="relative z-10 w-full max-w-sm animate-slide-in-bottom rounded-[28px] p-5"
        style={{ background: pg.surface, color: pg.ink, border: `1px solid ${pg.lineStrong}` }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-area-title"
      >
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-3 top-3 rounded-full p-1.5"
          style={{ color: pg.text4 }}
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div
          className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: 'rgba(255,159,67,0.16)', color: '#FF9F43' }}
        >
          <MapPin size={22} />
        </div>

        <h2 id="service-area-title" className="text-center text-lg font-extrabold">
          {result.paused ? 'Service temporarily paused' : 'Coming to your area soon'}
        </h2>
        <p className="mt-2 text-center text-sm leading-relaxed" style={{ color: pg.text3 }}>
          {result.paused ? (
            <>
              Service in <strong style={{ color: pg.text }}>{result.cityName || 'your city'}</strong> is
              temporarily paused. Thanks for your patience.
            </>
          ) : (
            <>
              We will serve in your area soon
              {result.areaName || result.pincode
                ? ` (${[result.areaName, result.pincode].filter(Boolean).join(' · ')})`
                : ''}
              . Thanks for your patience.
            </>
          )}
        </p>

        {submitted ? (
          <div
            className="mt-5 flex items-start gap-2 rounded-2xl px-3.5 py-3 text-sm"
            style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#86EFAC' }}
          >
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <span>You&apos;re on the list. We&apos;ll email you when we launch in your place.</span>
          </div>
        ) : !result.paused ? (
          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            <label className="flex items-start gap-2.5 text-sm" style={{ color: pg.text2 }}>
              <input
                type="checkbox"
                checked={wantNotify}
                onChange={(e) => setWantNotify(e.target.checked)}
                className="mt-1"
              />
              <span>Notify me by email when PingGet is available here</span>
            </label>

            {wantNotify && (
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: pg.text4 }} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="input w-full pl-10"
                />
              </div>
            )}

            {error && (
              <p className="text-xs font-bold text-red-300">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-2xl py-3 text-sm font-extrabold disabled:opacity-60"
              style={{ background: pg.lime, color: pg.limeText }}
            >
              {submitting ? 'Saving…' : wantNotify ? 'Notify me' : 'Got it'}
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={dismiss}
            className="mt-5 w-full rounded-2xl py-3 text-sm font-extrabold"
            style={{ background: pg.lime, color: pg.limeText }}
          >
            Got it
          </button>
        )}

        {submitted && (
          <button
            type="button"
            onClick={dismiss}
            className="mt-3 w-full rounded-2xl py-3 text-sm font-extrabold"
            style={{ background: pg.surface2, color: pg.text2, border: `1px solid ${pg.line}` }}
          >
            Close
          </button>
        )}
      </div>
    </div>
  )
}
