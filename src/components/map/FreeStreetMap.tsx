import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { Map as MapLibreMap, Marker, GeoJSONSource } from 'maplibre-gl'
import { Images } from '../../lib/customImages'
import type { LatLng } from '../../lib/mapUtils'

export type MapMarker = {
  id: string
  position: LatLng
  kind?: 'user' | 'bike' | 'pickup' | 'destination' | 'dp'
  label?: string
}

type Props = {
  center?: LatLng | null
  zoom?: number
  markers?: MapMarker[]
  /** Search radius in meters drawn as a circle around center */
  radiusMeters?: number
  className?: string
  style?: React.CSSProperties
  interactive?: boolean
  onReady?: (map: MapLibreMap) => void
}

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

function circleGeoJSON(center: LatLng, radiusMeters: number, points = 64): any {
  const coords: [number, number][] = []
  const earth = 6371000
  const lat = (center.lat * Math.PI) / 180
  const lng = (center.lng * Math.PI) / 180
  for (let i = 0; i <= points; i++) {
    const bearing = (i / points) * 2 * Math.PI
    const lat2 = Math.asin(
      Math.sin(lat) * Math.cos(radiusMeters / earth) +
        Math.cos(lat) * Math.sin(radiusMeters / earth) * Math.cos(bearing)
    )
    const lng2 =
      lng +
      Math.atan2(
        Math.sin(bearing) * Math.sin(radiusMeters / earth) * Math.cos(lat),
        Math.cos(radiusMeters / earth) - Math.sin(lat) * Math.sin(lat2)
      )
    coords.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI])
  }
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [coords] },
  }
}

function markerEl(kind: MapMarker['kind'], label?: string): HTMLElement {
  const el = document.createElement('div')
  el.style.width = '36px'
  el.style.height = '36px'
  el.style.display = 'flex'
  el.style.alignItems = 'center'
  el.style.justifyContent = 'center'
  el.style.borderRadius = '50%'
  el.style.border = '2px solid rgba(255,255,255,0.9)'
  el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.45)'
  el.style.overflow = 'hidden'

  if (kind === 'bike' || kind === 'dp') {
    el.style.background = '#A6B300'
    const img = document.createElement('img')
    img.src = Images.bikeMarker
    img.alt = label || 'Partner'
    img.style.width = '22px'
    img.style.height = '22px'
    img.style.objectFit = 'contain'
    img.onerror = () => {
      img.remove()
      el.textContent = 'B'
      el.style.color = '#0B0B0B'
      el.style.fontWeight = '700'
      el.style.fontSize = '14px'
    }
    el.appendChild(img)
  } else if (kind === 'pickup') {
    el.style.background = '#3b82f6'
    el.style.color = '#fff'
    el.style.fontSize = '12px'
    el.style.fontWeight = '700'
    el.textContent = 'P'
  } else if (kind === 'destination') {
    el.style.background = '#ef4444'
    el.style.color = '#fff'
    el.style.fontSize = '12px'
    el.style.fontWeight = '700'
    el.textContent = 'D'
  } else {
    el.style.background = '#3b82f6'
    el.style.width = '18px'
    el.style.height = '18px'
    el.style.border = '3px solid #fff'
  }
  return el
}

/**
 * Free street map (MapLibre + OpenFreeMap / OSM) — no Leaflet, no API key.
 */
export default function FreeStreetMap({
  center,
  zoom = 14,
  markers = [],
  radiusMeters,
  className = '',
  style,
  interactive = true,
  onReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markersRef = useRef<globalThis.Map<string, Marker>>(new globalThis.Map())
  const readyRef = useRef(false)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const c = center || { lat: 17.385, lng: 78.4867 }
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [c.lng, c.lat],
      zoom,
      attributionControl: { compact: true },
      interactive,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.on('load', () => {
      readyRef.current = true
      map.addSource('scan-radius', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'scan-radius-fill',
        type: 'fill',
        source: 'scan-radius',
        paint: { 'fill-color': '#A6B300', 'fill-opacity': 0.12 },
      })
      map.addLayer({
        id: 'scan-radius-line',
        type: 'line',
        source: 'scan-radius',
        paint: { 'line-color': '#A6B300', 'line-width': 2, 'line-opacity': 0.55 },
      })
      onReady?.(map)
    })
    mapRef.current = map
    return () => {
      markersRef.current.forEach(m => m.remove())
      markersRef.current.clear()
      map.remove()
      mapRef.current = null
      readyRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !center) return
    map.easeTo({ center: [center.lng, center.lat], duration: 600 })
  }, [center?.lat, center?.lng])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => {
      const src = map.getSource('scan-radius') as GeoJSONSource | undefined
      if (!src || !center || !radiusMeters) {
        src?.setData({ type: 'FeatureCollection', features: [] })
        return
      }
      src.setData({
        type: 'FeatureCollection',
        features: [circleGeoJSON(center, radiusMeters)],
      })
    }
    if (readyRef.current) apply()
    else map.once('load', apply)
  }, [center?.lat, center?.lng, radiusMeters])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const existing = markersRef.current
    const nextIds = new Set(markers.map(m => m.id))
    existing.forEach((marker, id) => {
      if (!nextIds.has(id)) {
        marker.remove()
        existing.delete(id)
      }
    })
    markers.forEach(m => {
      const prev = existing.get(m.id)
      if (prev) {
        prev.setLngLat([m.position.lng, m.position.lat])
        return
      }
      const marker = new maplibregl.Marker({ element: markerEl(m.kind, m.label) })
        .setLngLat([m.position.lng, m.position.lat])
        .addTo(map)
      existing.set(m.id, marker)
    })
  }, [markers])

  return (
    <div
      ref={containerRef}
      className={`free-street-map ${className}`}
      style={{ width: '100%', height: '100%', minHeight: 200, ...style }}
    />
  )
}
