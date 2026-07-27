import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export type GpsState = {
  lat: number | null
  lng: number | null
  loading: boolean
  error: string | null
}

const GPS_REFRESH_INTERVAL_MS = 15000
const GPS_WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 10000,
  timeout: 20000,
}

export function useGps(profileId: string | undefined, enabled = true) {
  const [gps, setGps] = useState<GpsState>({ lat: null, lng: null, loading: true, error: null })
  const watchId = useRef<number | null>(null)
  const refreshInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const visibilityHandler = useRef<(() => void) | null>(null)
  const lastSave = useRef<{ lat: number; lng: number; ts: number } | null>(null)

  const saveGps = useCallback(async (lat: number, lng: number) => {
    // Throttle: skip if same location within 5 seconds
    const now = Date.now()
    if (lastSave.current && lastSave.current.ts > now - 5000 &&
        Math.abs(lastSave.current.lat - lat) < 0.00001 &&
        Math.abs(lastSave.current.lng - lng) < 0.00001) {
      setGps(prev => ({ ...prev, lat, lng, loading: false, error: null }))
      return
    }
    lastSave.current = { lat, lng, ts: now }

    const { error } = await supabase.rpc('update_location', {
      p_lat: lat,
      p_lng: lng,
    })
    if (error) console.warn('[GPS] update_location error:', error.message)
    setGps(prev => ({ ...prev, lat, lng, loading: false, error: null }))
  }, [])

  const getCurrentAndSave = useCallback(() => {
    if (!navigator.geolocation) {
      setGps(prev => ({ ...prev, loading: false, error: 'Geolocation not supported' }))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => saveGps(pos.coords.latitude, pos.coords.longitude),
      (err) => {
        console.warn('[GPS] getCurrentPosition error:', err.message)
        setGps(prev => ({ ...prev, loading: false, error: err.message }))
      },
      GPS_WATCH_OPTIONS
    )
  }, [saveGps])

  const startWatch = useCallback(() => {
    if (!navigator.geolocation) {
      setGps(prev => ({ ...prev, loading: false, error: 'Geolocation not supported' }))
      return
    }
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => saveGps(pos.coords.latitude, pos.coords.longitude),
      (err) => {
        console.warn('[GPS] watchPosition error:', err.message)
        setGps(prev => ({ ...prev, loading: false, error: err.message }))
      },
      GPS_WATCH_OPTIONS
    )
  }, [saveGps])

  useEffect(() => {
    if (!profileId || !enabled) {
      setGps(prev => ({ ...prev, loading: false }))
      return
    }

    // Get initial position immediately
    getCurrentAndSave()
    // Start continuous watch
    startWatch()

    // Periodic refresh — re-fetch GPS and save even if watchPosition is slow
    refreshInterval.current = setInterval(getCurrentAndSave, GPS_REFRESH_INTERVAL_MS)

    // Resume on visibility change (app comes back from background)
    visibilityHandler.current = () => {
      if (document.visibilityState === 'visible') {
        console.log('[GPS] App resumed — refreshing GPS')
        getCurrentAndSave()
        startWatch()
      }
    }
    document.addEventListener('visibilitychange', visibilityHandler.current)

    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
      if (refreshInterval.current) clearInterval(refreshInterval.current)
      if (visibilityHandler.current) document.removeEventListener('visibilitychange', visibilityHandler.current)
    }
  }, [profileId, enabled, getCurrentAndSave, startWatch])

  return gps
}
