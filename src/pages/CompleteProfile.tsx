import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context'
import { supabase } from '../lib/supabase'
import { ErrorBanner } from '../components/ui'
import { MapPin } from 'lucide-react'
import { Geolocation } from '@capacitor/geolocation'


export default function CompleteProfile() {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [gpsLat, setGpsLat] = useState<number | null>(null)
  const [gpsLng, setGpsLng] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [gpsLoading, setGpsLoading] = useState(false)

  const getLocation = async () => {
  try {
    setGpsLoading(true)
    setError(null)

    const permission = await Geolocation.requestPermissions()

    if (permission.location !== 'granted') {
      setError('Location permission denied')
      setGpsLoading(false)
      return
    }

    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000,
    })

    setGpsLat(position.coords.latitude)
    setGpsLng(position.coords.longitude)
  } catch (err) {
    setError('Unable to get your location.')
  } finally {
    setGpsLoading(false)
  }
}

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ address, city, gps_lat: gpsLat, gps_lng: gpsLng })
        .eq('id', profile!.id)
      if (error) throw error

      if (profile!.role === 'dp') {
        const { error: dpError } = await supabase
          .from('delivery_partners')
          .insert({ user_id: profile!.id, vehicle_type: 'Bike' })
        if (dpError && !dpError.message.includes('duplicate')) throw dpError

        const { error: walletError } = await supabase
          .from('wallets')
          .insert({ dp_user_id: profile!.id })
        if (walletError && !walletError.message.includes('duplicate')) throw walletError
      }

      await refreshProfile()
      navigate(profile!.role === 'dp' ? '/dp' : '/app')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto max-w-md px-6 py-8">
        <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">Complete Your Profile</h1>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">Add your address and location to get started.</p>

        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          <div>
            <label className="label">Address</label>
            <input className="input" value={address} onChange={e => setAddress(e.target.value)} placeholder="Flat, Street, Area" required />
          </div>
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
