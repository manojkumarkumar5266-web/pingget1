export type GeoAddressParts = {
  house_no: string
  street: string
  area: string
  city: string
  pincode: string
  landmark: string
  lat: number
  lng: number
  display: string
}

function pick(obj: Record<string, string | undefined>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k]
    if (v && String(v).trim()) return String(v).trim()
  }
  return ''
}

/** Reverse-geocode lat/lng via OpenStreetMap Nominatim (no API key). */
export async function reverseGeocode(lat: number, lng: number): Promise<GeoAddressParts | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}&addressdetails=1&zoom=18`
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) return null
  const json = await res.json()
  const a = (json?.address || {}) as Record<string, string | undefined>
  const house = pick(a, ['house_number', 'housenumber'])
  const street = pick(a, ['road', 'residential', 'pedestrian', 'footway', 'street'])
  const area = pick(a, ['suburb', 'neighbourhood', 'quarter', 'village', 'hamlet', 'city_district'])
  const city = pick(a, ['city', 'town', 'municipality', 'county', 'state_district'])
  const pincode = (pick(a, ['postcode']) || '').replace(/\D/g, '').slice(0, 6)
  return {
    house_no: house,
    street,
    area,
    city,
    pincode,
    landmark: pick(a, ['amenity', 'building', 'tourism', 'shop']),
    lat,
    lng,
    display: json?.display_name || [house, street, area, city, pincode].filter(Boolean).join(', '),
  }
}

export async function searchPlace(query: string): Promise<{ lat: number; lng: number; display: string }[]> {
  const q = query.trim()
  if (q.length < 3) return []
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&addressdetails=1&limit=6`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) return []
  const json = await res.json()
  return (Array.isArray(json) ? json : []).map((row: any) => ({
    lat: Number(row.lat),
    lng: Number(row.lon),
    display: String(row.display_name || ''),
  })).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng))
}
