import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

export type GpsState = {
  lat: number | null
  lng: number | null
  loading: boolean
  error: string | null
}

export function useGps(profileId: string | undefined, enabled = true) {
  const [gps, setGps] = useState<GpsState>({ lat: null, lng: null, loading: true, error: null })
  const watchId = useRef<number | null>(null)

  useEffect(() => {
    if (!profileId || !enabled) {
      setGps(prev => ({ ...prev, loading: false }))
      return
    }

    const saveGps = async (lat: number, lng: number) => {
      await supabase.from('profiles')
        .update({ gps_lat: lat, gps_lng: lng })
        .eq('id', profileId)
      setGps(prev => ({ ...prev, lat, lng, loading: false, error: null }))
    }

    const startWatch = () => {
      if (!navigator.geolocation) {
        setGps(prev => ({ ...prev, loading: false, error: 'Geolocation not supported' }))
        return
      }
      watchId.current = navigator.geolocation.watchPosition(
        (pos) => saveGps(pos.coords.latitude, pos.coords.longitude),
        (err) => {
          setGps(prev => ({ ...prev, loading: false, error: err.message }))
          setTimeout(startWatch, 10000)
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
      )
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => saveGps(pos.coords.latitude, pos.coords.longitude),
      (err) => {
        setGps(prev => ({ ...prev, loading: false, error: err.message }))
        startWatch()
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    )
    startWatch()

    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    }
  }, [profileId, enabled])

  return gps
}
