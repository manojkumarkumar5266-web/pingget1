import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context'
import { supabase } from '../lib/supabase'
import { ErrorBanner } from '../components/ui'
import Brand from '../components/Brand'
import { pg } from '../design/tokens'
import { CTA } from '../design/primitives'
import { MapPin } from 'lucide-react'

export default function CompleteProfile() {
  const { profile, user, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [city, setCity] = useState('')
  const [gpsLat, setGpsLat] = useState<number | null>(null)
  const [gpsLng, setGpsLng] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)

  useEffect(() => {
    if (profile?.city) setCity(profile.city)
  }, [profile])

  const getLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.')
      return
    }
    setGpsLoading(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setGpsLat(pos.coords.latitude)
        setGpsLng(pos.coords.longitude)
        setGpsLoading(false)
      },
      err => {
        let msg = 'Unable to get your location.'
        if (err.code === 1) msg = 'Location permission denied. Please allow location access in your browser settings.'
        else if (err.code === 2) msg = 'Location unavailable. Check your GPS or network connection.'
        else if (err.code === 3) msg = 'Location request timed out. Please try again.'
        setError(msg)
        setGpsLoading(false)
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) { setError("User session not found. Please sign in again."); return }
    setError(null)
    setLoading(true)
    try {
      const userId = profile?.id || user.id
      const role = profile?.role || "user"
      const { error } = await supabase
        .from("profiles")
        .update({ city, gps_lat: gpsLat, gps_lng: gpsLng })
        .eq("id", userId)
      if (error) throw error

      if (role === "dp") {
        const { error: dpError } = await supabase.from("delivery_partners")
          .update({ service_range_meters: 3000 })
          .eq("user_id", userId)
        if (dpError) console.warn('[CompleteProfile] DP update skipped:', dpError.message)
      }

      await refreshProfile()
      navigate(role === "dp" ? "/dp" : "/app")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col px-5 py-10" style={{ background: pg.bg }}>
      <div className="mx-auto w-full max-w-md">
        <Brand size="md" showTagline className="mb-4" />
        <h1 className="mb-2 text-[28px] font-extrabold tracking-tight">Complete Your Profile</h1>
        <p className="mb-6 text-sm" style={{ color: pg.text3 }}>Select your city and share your location to get started.</p>
        <form onSubmit={handleSubmit} className="space-y-4 rounded-[28px] p-5" style={{ background: pg.surface, color: pg.ink, border: `1px solid ${pg.line}` }}>
          <div>
            <label className="label">City</label>
            <input className="input" value={city} onChange={e => setCity(e.target.value)} placeholder="Your city" required />
          </div>
          <div>
            <label className="label">GPS Location</label>
            <CTA type="button" variant="secondary" onClick={getLocation} disabled={gpsLoading} className="w-full">
              <MapPin size={18} /> {gpsLoading ? 'Getting location...' : gpsLat ? `${gpsLat.toFixed(4)}, ${gpsLng!.toFixed(4)}` : 'Get My Location'}
            </CTA>
          </div>
          {error && <ErrorBanner message={error} />}
          <CTA type="submit" disabled={loading} className="w-full">
            {loading ? 'Saving...' : 'Continue'}
          </CTA>
        </form>
      </div>
    </div>
  )
}
