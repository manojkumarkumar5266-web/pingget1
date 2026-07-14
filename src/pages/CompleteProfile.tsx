import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context'
import { supabase } from '../lib/supabase'
import { ErrorBanner } from '../components/ui'
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
        const { error: dpError } = await supabase.from("delivery_partners").insert({ user_id: userId, vehicle_type: "Bike" })
        if (dpError && !dpError.message.includes("duplicate")) throw dpError
        const { error: walletError } = await supabase.from("wallets").insert({ dp_user_id: userId })
        if (walletError && !walletError.message.includes("duplicate")) throw walletError
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
    <div className="min-h-screen ">
      <div className="mx-auto max-w-md px-6 py-8">
        <h1 className="mb-2 text-2xl font-bold text-white">Complete Your Profile</h1>
        <p className="mb-6 text-sm text-white/50">Select your city and share your location to get started.</p>
        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          <div>
            <label className="label">City</label>
            <input className="input" value={city} onChange={e => setCity(e.target.value)} placeholder="Your city" required />
          </div>
          <div>
            <label className="label">GPS Location</label>
            <button type="button" onClick={getLocation} disabled={gpsLoading} className="btn-secondary w-full">
              <MapPin size={18} /> {gpsLoading ? 'Getting location...' : gpsLat ? `${gpsLat.toFixed(4)}, ${gpsLng!.toFixed(4)}` : 'Get My Location'}
            </button>
          </div>
          {error && <ErrorBanner message={error} />}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Saving...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
