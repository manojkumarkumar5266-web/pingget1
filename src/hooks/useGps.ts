import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export type GpsState = {
  lat: number | null
  lng: number | null
  loading: boolean
  error: string | null
  permissionDenied: boolean
}

const GPS_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  maximumAge: 30000,
  timeout: 8000,
}

export function useGps(profileId: string | undefined, enabled = true) {
  const [gps, setGps] = useState<GpsState>({ lat: null, lng: null, loading: true, error: null, permissionDenied: false })
  const watchId = useRef<number | null>(null)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const saveGps = useCallback(async (lat: number, lng: number) => {
    setGps(prev => ({ ...prev, lat, lng, loading: false, error: null, permissionDenied: false }))
    try {
      await supabase.rpc('update_location', { p_lat: lat, p_lng: lng })
    } catch { /* non-critical */ }
  }, [])

  const startWatch = useCallback(() => {
    if (!navigator.geolocation) {
      setGps(prev => ({ ...prev, loading: false, error: 'Geolocation not supported on this device', permissionDenied: false }))
      return
    }
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current)
    }
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => saveGps(pos.coords.latitude, pos.coords.longitude),
      (err) => {
        const denied = err.code === err.PERMISSION_DENIED
        setGps(prev => ({
          ...prev,
          loading: false,
          permissionDenied: denied,
          error: denied
            ? 'Location access denied. Please allow location access in your browser or app settings to receive delivery requests.'
            : err.code === err.POSITION_UNAVAILABLE
            ? 'Location unavailable. Please check your GPS or network connection.'
            : 'Unable to get location. Retrying...',
        }))
        if (!denied && retryTimer.current === null) {
          retryTimer.current = setTimeout(() => {
            retryTimer.current = null
            startWatch()
          }, 5000)
        }
      },
      GPS_OPTIONS
    )
  }, [saveGps])

  useEffect(() => {
    if (!profileId || !enabled) {
      setGps(prev => ({ ...prev, loading: false }))
      return
    }

    setGps({ lat: null, lng: null, loading: true, error: null, permissionDenied: false })

    if (!navigator.geolocation) {
      setGps(prev => ({ ...prev, loading: false, error: 'Geolocation not supported on this device', permissionDenied: false }))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        saveGps(pos.coords.latitude, pos.coords.longitude)
        startWatch()
      },
      (err) => {
        const denied = err.code === err.PERMISSION_DENIED
        setGps(prev => ({
          ...prev,
          loading: false,
          permissionDenied: denied,
          error: denied
            ? 'Location access denied. Please allow location access in your browser or app settings to receive delivery requests.'
            : 'Unable to get your location. Please check your GPS settings.',
        }))
        if (!denied) startWatch()
      },
      GPS_OPTIONS
    )

    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
      if (retryTimer.current !== null) { clearTimeout(retryTimer.current); retryTimer.current = null }
    }
  }, [profileId, enabled, saveGps, startWatch])

  const requestPermission = useCallback(() => {
    setGps(prev => ({ ...prev, loading: true, error: null, permissionDenied: false }))
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        saveGps(pos.coords.latitude, pos.coords.longitude)
        startWatch()
      },
      (err) => {
        const denied = err.code === err.PERMISSION_DENIED
        setGps(prev => ({
          ...prev,
          loading: false,
          permissionDenied: denied,
          error: denied
            ? 'Location access denied. Please allow location access in your browser or app settings to receive delivery requests.'
            : 'Unable to get your location. Please check your GPS settings.',
        }))
        if (!denied) startWatch()
      },
      GPS_OPTIONS
    )
  }, [saveGps, startWatch])

  return { ...gps, requestPermission }
}
