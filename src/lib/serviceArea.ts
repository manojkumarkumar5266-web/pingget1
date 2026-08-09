import { supabase } from './supabase'

export type ServiceAreaResult = {
  served: boolean
  paused: boolean
  pincode: string | null
  areaName: string | null
  cityName: string | null
  cityId: string | null
  lat: number | null
  lng: number | null
}

type ReverseGeo = {
  pincode: string | null
  areaName: string | null
  cityName: string | null
  lat: number
  lng: number
}

/** Reverse-geocode GPS → Indian pincode / area / city via Nominatim */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeo> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
    { headers: { Accept: 'application/json' } },
  )
  const data = await res.json()
  const addr = data?.address || {}
  const rawPin = String(addr.postcode || addr.postal_code || '').replace(/\D/g, '').slice(0, 6)
  const areaBits = [
    addr.suburb, addr.neighbourhood, addr.quarter, addr.city_district, addr.locality, addr.town, addr.village,
  ].filter(Boolean)
  const cityName = addr.city || addr.town || addr.municipality || addr.state_district || null
  return {
    pincode: rawPin.length === 6 ? rawPin : null,
    areaName: areaBits[0] || null,
    cityName,
    lat,
    lng,
  }
}

/** Check whether a pincode (and its parent city) is in the admin active service list */
export async function checkPincodeServiceArea(pincode: string): Promise<ServiceAreaResult> {
  const base: ServiceAreaResult = {
    served: false,
    paused: false,
    pincode,
    areaName: null,
    cityName: null,
    cityId: null,
    lat: null,
    lng: null,
  }
  if (!pincode || pincode.length !== 6) return base

  const { data: pins } = await supabase
    .from('pincodes')
    .select('area_name, city_id, is_active')
    .eq('pincode', pincode)
    .eq('is_active', true)
    .limit(1)

  const pin = pins?.[0]
  if (!pin) return { ...base, areaName: null }

  const { data: city } = await supabase
    .from('cities')
    .select('id, name, is_active, service_paused')
    .eq('id', pin.city_id)
    .maybeSingle()

  if (!city) return { ...base, areaName: pin.area_name || null }

  return {
    served: !!city.is_active,
    paused: !!city.service_paused,
    pincode,
    areaName: pin.area_name || null,
    cityName: city.name,
    cityId: city.id,
    lat: null,
    lng: null,
  }
}

/**
 * Live GPS → reverse geocode → compare against admin active cities/pincodes.
 * If GPS fails, falls back to profile pincode (if provided).
 */
export async function checkLiveServiceArea(
  fallbackPincode?: string | null,
): Promise<ServiceAreaResult> {
  const empty: ServiceAreaResult = {
    served: false,
    paused: false,
    pincode: fallbackPincode || null,
    areaName: null,
    cityName: null,
    cityId: null,
    lat: null,
    lng: null,
  }

  const readGps = (): Promise<GeolocationPosition | null> =>
    new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null)
        return
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
      )
    })

  const pos = await readGps()
  let geo: ReverseGeo | null = null

  if (pos) {
    try {
      geo = await reverseGeocode(pos.coords.latitude, pos.coords.longitude)
    } catch {
      geo = null
    }
  }

  // Prefer GPS pincode; else try matching area name against DB; else profile fallback
  let pinToCheck = geo?.pincode || null

  if (!pinToCheck && geo?.areaName) {
    const areaName = geo.areaName.toLowerCase()
    const { data: allPins } = await supabase
      .from('pincodes')
      .select('pincode, area_name')
      .eq('is_active', true)
    const matched = (allPins || []).find((p: { pincode: string; area_name: string | null }) => {
      const dbArea = (p.area_name || '').toLowerCase()
      return dbArea && (areaName.includes(dbArea) || dbArea.includes(areaName))
    })
    if (matched?.pincode) pinToCheck = matched.pincode
  }

  if (!pinToCheck && fallbackPincode && fallbackPincode.length === 6) {
    pinToCheck = fallbackPincode
  }

  if (!pinToCheck) {
    return {
      ...empty,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      areaName: geo?.areaName ?? null,
      cityName: geo?.cityName ?? null,
    }
  }

  const result = await checkPincodeServiceArea(pinToCheck)
  return {
    ...result,
    lat: geo?.lat ?? null,
    lng: geo?.lng ?? null,
    areaName: result.areaName || geo?.areaName || null,
    cityName: result.cityName || geo?.cityName || null,
  }
}

export type WaitlistPayload = {
  userId?: string | null
  email: string
  pincode?: string | null
  areaName?: string | null
  cityName?: string | null
  lat?: number | null
  lng?: number | null
  source?: string
}

/** Store interest so admin can notify when the area goes live */
export async function submitServiceAreaWaitlist(payload: WaitlistPayload) {
  const email = payload.email.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Please enter a valid email address.' }
  }

  const row = {
    user_id: payload.userId || null,
    email,
    pincode: payload.pincode || null,
    area_name: payload.areaName || null,
    city_name: payload.cityName || null,
    lat: payload.lat ?? null,
    lng: payload.lng ?? null,
    source: payload.source || 'app',
  }

  const { data: existing } = await supabase
    .from('service_area_waitlist')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existing?.id) {
    const { error } = await supabase
      .from('service_area_waitlist')
      .update({
        user_id: row.user_id,
        pincode: row.pincode,
        area_name: row.area_name,
        city_name: row.city_name,
        lat: row.lat,
        lng: row.lng,
        source: row.source,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    if (error) return { error: error.message }
    return { ok: true as const }
  }

  const { error } = await supabase.from('service_area_waitlist').insert(row)
  if (error) return { error: error.message }
  return { ok: true as const }
}
