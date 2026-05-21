'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '')
}

/* 21 comunas disponibles */
const AVAILABLE = new Set([
  'providencia','nunoa','lascondes','vitacura','lobarnechea','lareina',
  'santiago',
  'estacioncentral','cerrillos','maipu',
  'macul','penalolen','laflorida','puentealto','sanjoaquin','sanmiguel',
  'lacisterna','elbosque','lagranja','sanramon','pedroaguirrecerda',
])

const COMMUNE_LIST = [
  'Cerrillos','El Bosque','Estación Central',
  'La Cisterna','La Florida','La Granja','La Reina','Las Condes',
  'Lo Barnechea','Macul','Maipú','Ñuñoa','Pedro Aguirre Cerda',
  'Peñalolén','Providencia','Puente Alto',
  'San Joaquín','San Miguel','San Ramón',
  'Santiago','Vitacura',
]

const S_AVAIL   = { fillColor:'#22C55E', fillOpacity:0.52, color:'#15803D', weight:2.0, opacity:0.90 }
const S_UNAVAIL = { fillColor:'#94A3B8', fillOpacity:0.25, color:'#94A3B8', weight:1.0, opacity:0.65 }
const S_HOVER   = { fillOpacity:0.68, weight:2.5 }

const BIZ: [number, number]    = [-33.490, -70.598]
const CENTER: [number, number] = [-33.47,  -70.64]
const ZOOM = 10

export default function ZonesMap() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<any>(null)

  useEffect(() => {
    const container = mapContainer.current
    if (!container || mapRef.current) return

    let map: any = null

    async function boot() {
      const L = (await import('leaflet')).default

      map = L.map(container!, {
        center: CENTER,
        zoom: ZOOM,
        zoomControl: false,
        scrollWheelZoom: false,
        dragging: false,
        touchZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        attributionControl: true,
      })
      mapRef.current = map

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> ' +
          '© <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
        opacity: 0.90,
      }).addTo(map)

      try {
        const res = await fetch('/comunal-rm.geojson')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: any = await res.json()

        L.geoJSON(data, {
          style: (f) => {
            const k = norm(f?.properties?.NAME_3 ?? '')
            return AVAILABLE.has(k) ? { ...S_AVAIL } : { ...S_UNAVAIL }
          },
          onEachFeature: (f, layer) => {
            const raw: string = f?.properties?.NAME_3 ?? ''
            const key = norm(raw)
            const avail = AVAILABLE.has(key)

            const displayName = COMMUNE_LIST.find(n => norm(n) === key) ?? raw

            if (avail) {
              layer.bindPopup(
                `<div style="font-family:Inter,system-ui,sans-serif;min-width:150px;padding:2px 0">` +
                `<div style="display:flex;align-items:center;gap:7px;margin-bottom:5px">` +
                `<span style="width:7px;height:7px;border-radius:50%;background:#22C55E;flex-shrink:0"></span>` +
                `<strong style="font-size:13px;color:#1B2B1E">${displayName}</strong>` +
                `</div>` +
                `<p style="font-size:11px;color:#15803D;font-weight:700;margin:0 0 3px">✓ Hacemos despacho aquí</p>` +
                `<p style="font-size:11px;color:#6B7A6F;margin:0">$2.990 · Mínimo $20.000</p>` +
                `</div>`,
                { closeButton: false, className: 'zm-popup', maxWidth: 210 }
              )
              layer.on('click',     () => layer.openPopup())
              layer.on('mouseover', () => (layer as any).setStyle({ ...S_AVAIL, ...S_HOVER }))
              layer.on('mouseout',  () => (layer as any).setStyle({ ...S_AVAIL }))
            }
          },
        }).addTo(map)
      } catch (err) {
        console.error('[ZonesMap]', err)
      }

      const dot = L.divIcon({
        html: `<div style="width:10px;height:10px;border-radius:50%;background:#1B2B1E;` +
              `box-shadow:0 0 0 3px rgba(27,43,30,.18),0 0 0 7px rgba(27,43,30,.07)"></div>`,
        className: '',
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      })
      L.marker(BIZ, { icon: dot, zIndexOffset: 1000 }).addTo(map)
        .bindPopup(
          `<div style="font-family:Inter,system-ui,sans-serif;padding:2px 0;min-width:130px">` +
          `<strong style="font-size:12px;color:#1B2B1E;display:block;margin-bottom:2px">El Menú · Macul</strong>` +
          `<span style="font-size:11px;color:#6B7A6F">Los Olmos 3967</span>` +
          `</div>`,
          { closeButton: false, className: 'zm-popup' }
        )
    }

    boot()
    return () => {
      if (map) { map.remove(); mapRef.current = null }
    }
  }, [])

  return <div ref={mapContainer} style={{ width:'100%', height:'100%' }} />
}
