export const USER_SEARCH_RADIUS_KEY = 'pingget_user_search_radius_km'
export const DEFAULT_USER_RADIUS_KM = 6

export function getUserSearchRadiusKm(): number {
  const raw = Number(localStorage.getItem(USER_SEARCH_RADIUS_KEY))
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_USER_RADIUS_KM
  return Math.min(20, Math.max(1, Math.round(raw)))
}

export function setUserSearchRadiusKm(km: number) {
  const next = Math.min(20, Math.max(1, Math.round(km)))
  localStorage.setItem(USER_SEARCH_RADIUS_KEY, String(next))
  return next
}

export function userRadiusMeters(): number {
  return getUserSearchRadiusKm() * 1000
}
