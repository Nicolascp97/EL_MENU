'use client'

import { useCallback, useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '')
}

/* 21 comunas disponibles (se eliminaron: pudahuel, quilicura, renca, huechuraba, independencia, recoleta) */
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
].sort()

const S_AVAIL   = { fillColor:'#22C55E', fillOpacity:0.38, color:'#16A34A', weight:1.5, opacity:0.70 }
const S_UNAVAIL = { fillColor:'#94A3B8', fillOpacity:0.15, color:'#CBD5E1', weight:0.6, opacity:0.45 }
const S_HOVER   = { fillOpacity:0.55, weight:2.0 }
const S_HI      = { fillColor:'#16A34A', fillOpacity:0.62, color:'#15803D', weight:2.5, opacity:0.95 }

const BIZ: [number, number]    = [-33.490, -70.598]
const CENTER: [number, number] = [-33.47,  -70.64]
const ZOOM = 10

export default function ZonesMap() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<any>(null)
  const layersRef    = useRef<Record<string, any>>({})
  const hiRef        = useRef<string | null>(null)
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flyTo = useCallback((name: string) => {
    const key   = norm(name)
    const layer = layersRef.current[key]
    if (!layer || !mapRef.current) return

    if (hiRef.current && hiRef.current !== key) {
      const prev = layersRef.current[hiRef.current]
      if (prev) prev.setStyle({ ...S_AVAIL })
    }

    mapRef.current.fitBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 13 })
    layer.setStyle({ ...S_HI })
    layer.openPopup()
    hiRef.current = key

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const l = layersRef.current[key]
      if (l) l.setStyle({ ...S_AVAIL })
      hiRef.current = null
    }, 3500)
  }, [])

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
        attributionControl: true,
      })
      mapRef.current = map

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> ' +
          '© <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
        opacity: 0.72,
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

            layersRef.current[key] = layer

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
              layer.on('mouseout',  () => {
                if (hiRef.current !== key) (layer as any).setStyle({ ...S_AVAIL })
              })
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
      if (timerRef.current) clearTimeout(timerRef.current)
      if (map) { map.remove(); mapRef.current = null }
    }
  }, [])

  return (
    <div style={{ display:'flex', width:'100%', height:'100%' }}>

      {/* Sidebar: lista de comunas siempre visible */}
      <div style={{
        width: 200,
        flexShrink: 0,
        overflowY: 'auto',
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        borderRight: '1px solid rgba(0,0,0,0.07)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <p style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '.10em',
          textTransform: 'uppercase',
          color: '#6B7A6F',
          padding: '14px 14px 8px',
          fontFamily: 'Inter,system-ui,sans-serif',
          borderBottom: '1px solid rgba(0,0,0,0.05)',
          flexShrink: 0,
        }}>
          Comunas con despacho
        </p>
        {COMMUNE_LIST.map(name => (
          <button
            key={name}
            onClick={() => flyTo(name)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              width: '100%',
              padding: '9px 14px',
              background: 'none',
              border: 0,
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: 12,
              color: '#1B2B1E',
              fontFamily: 'Inter,system-ui,sans-serif',
              flexShrink: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(34,197,94,.09)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', flexShrink: 0 }} />
            {name}
          </button>
        ))}
      </div>

      {/* Mapa Leaflet */}
      <div ref={mapContainer} style={{ flex: 1, height: '100%' }} />

    </div>
  )
}
