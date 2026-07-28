import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { LatLng, VehicleType } from '../lib/mapUtils'
import { normalizeVehicle } from '../lib/mapUtils'

export type NearbyDp = {
  dp_user_id: string
  distance_meters: number
  vehicle_type: VehicleType
  rating_avg: number
  is_online: boolean
  current_lat: number | null
  current_lng: number | null
  full_name: string
  photo_url: string | null
}

export function useNearbyDps(
  userLocation: LatLng | null,
  requestId: string | undefined,
  radiusMeters: number = 5000,
  intervalMs: number = 4000,
  maxScans: number = 6
) {
  const [dps, setDps] = useState<NearbyDp[]>([])
  const [scanning, setScanning] = useState(true)
  const [scanCount, setScanCount] = useState(0)
  const scanCountRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!userLocation || !requestId) return

    const doScan = async () => {
      try {
        const { data, error } = await supabase.rpc('scan_nearby_dps', {
          p_user_lat: userLocation.lat,
          p_user_lng: userLocation.lng,
          p_radius_meters: radiusMeters,
          p_request_id: requestId,
        })
        if (error) {
          // Fallback: query delivery_partners directly
          const { data: rawDps } = await supabase
            .from('delivery_partners')
            .select('user_id, vehicle_type, rating_avg, is_online, current_lat, current_lng')
            .eq('is_online', true)
            .eq('status', 'approved')
            .limit(10)
          const profiles = await supabase
            .from('profiles')
            .select('id, full_name, photo_url')
            .in('id', (rawDps || []).map((d: any) => d.user_id))
          const profileMap = new Map((profiles.data || []).map((p: any) => [p.id, p]))
          const mapped: NearbyDp[] = (rawDps || []).map((d: any) => {
            const prof = profileMap.get(d.user_id)
            return {
              dp_user_id: d.user_id,
              distance_meters: 0,
              vehicle_type: normalizeVehicle(d.vehicle_type),
              rating_avg: d.rating_avg || 0,
              is_online: d.is_online,
              current_lat: d.current_lat,
              current_lng: d.current_lng,
              full_name: prof?.full_name || 'Partner',
              photo_url: prof?.photo_url || null,
            }
          })
          setDps(mapped)
        } else {
          const mapped: NearbyDp[] = (data || []).map((d: any) => ({
            dp_user_id: d.dp_user_id,
            distance_meters: Number(d.distance_meters || 0),
            vehicle_type: normalizeVehicle(d.vehicle_type),
            rating_avg: d.rating_avg || 0,
            is_online: d.is_online ?? true,
            current_lat: d.current_lat || null,
            current_lng: d.current_lng || null,
            full_name: d.full_name || 'Partner',
            photo_url: d.photo_url || null,
          }))
          setDps(mapped)
        }

        scanCountRef.current += 1
        setScanCount(scanCountRef.current)

        if (scanCountRef.current >= maxScans) {
          setScanning(false)
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
        }
      } catch (err) {
        console.error('scan_nearby_dps failed', err)
      }
    }

    doScan()
    timerRef.current = setInterval(doScan, intervalMs)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [userLocation, requestId, radiusMeters, intervalMs, maxScans])

  return { dps, scanning, scanCount }
}
