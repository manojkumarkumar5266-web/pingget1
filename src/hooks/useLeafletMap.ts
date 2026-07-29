import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { useTheme } from '../context'
import {
  TILE_URL_LIGHT, TILE_URL_DARK, TILE_ATTR_LIGHT, TILE_ATTR_DARK,
  DEFAULT_CENTER, DEFAULT_ZOOM,
} from '../lib/mapUtils'

export type MapHandle = {
  map: L.Map | null
  tileLayer: L.TileLayer | null
}

export function useLeafletMap(
  containerId: string,
  center?: [number, number],
  zoom?: number
) {
  const { theme } = useTheme()
  const mapRef = useRef<L.Map | null>(null)
  const tileRef = useRef<L.TileLayer | null>(null)
  const [ready, setReady] = useState(false)

  // Initialize map once
  useEffect(() => {
    const el = document.getElementById(containerId)
    if (!el || mapRef.current) return

    const map = L.map(el, {
      center: center || DEFAULT_CENTER,
      zoom: zoom || DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
    })
    mapRef.current = map

    // Leaflet frequently mis-measures the container when it is mounted inside
    // a flex/absolute layout. Force a reflow so tiles fill the element.
    requestAnimationFrame(() => {
      map.invalidateSize()
      setReady(true)
    })

    return () => {
      map.remove()
      mapRef.current = null
      tileRef.current = null
      setReady(false)
    }
  }, [containerId])

  // Swap tile layer when theme changes
  useEffect(() => {
    if (!mapRef.current || !ready) return
    if (tileRef.current) {
      mapRef.current.removeLayer(tileRef.current)
    }
    const url = TILE_URL_DARK
    const attr = TILE_ATTR_DARK
    tileRef.current = L.tileLayer(url, { attribution: attr, maxZoom: 19 })
    tileRef.current.addTo(mapRef.current)
  }, [theme, ready])

  return { map: mapRef.current, ready }
}
