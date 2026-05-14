'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'

/* ── norm: lowercase + remove diacritics + remove spaces ────────────
   GADM NAME_3 has no spaces ("ElBosque", "LasCondes"), so we strip
   spaces from both sides when matching.                              */
function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '')
}

/* ── Available communes (norm keys, no spaces, no accents) ──────── */
const AVAILABLE = new Set([
  'providencia','nunoa','lascondes','vitacura','lobarnechea','lareina',
  'santiago','recoleta','independencia','renca','quilicura','huechuraba',
  'pudahuel','estacioncentral','cerrillos','maipu',
  'macul','penalolen','laflorida','puentealto','sanjoaquin','sanmiguel',
  'lacisterna','elbosque','lagranja','sanramon','pedroaguirrecerda',
])

/* Display names for autocomplete — sorted A→Z */
const COMMUNE_LIST = [
  'Cerrillos','El Bosque','Estación Central','Huechuraba','Independencia',
  'La Cisterna','La Florida','La Granja','La Reina','Las Condes',
  'Lo Barnechea','Macul','Maipú','Ñuñoa','Pedro Aguirre Cerda',
  'Peñalolén','Providencia','Pudahuel','Puente Alto','Quilicura',
  'Recoleta','Renca','San Joaquín','San Miguel','San Ramón',
  'Santiago','Vitacura',
].sort()

/* ── Layer styles ────────────────────────────────────────────────── */
const S_AVAIL   = { fillColor:'#22C55E', fillOpacity:0.38, color:'#16A34A', weight:1.5, opacity:0.70 }
const S_UNAVAIL = { fillColor:'#94A3B8', fillOpacity:0.15, color:'#CBD5E1', weight:0.6, opacity:0.45 }
const S_HOVER   = { fillOpacity:0.55, weight:2.0 }
const S_HI      = { fillColor:'#16A34A', fillOpacity:0.62, color:'#15803D', weight:2.5, opacity:0.95 }

const BIZ: [number, number]    = [-33.490, -70.598]
const CENTER: [number, number] = [-33.47,  -70.64]
const ZOOM = 10

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.93)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.09),0 1px 4px rgba(0,0,0,0.05)',
}

export default function ZonesMap() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<any>(null)
  const layersRef    = useRef<Record<string, any>>({})
  const hiRef        = useRef<string | null>(null)
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [search, setSearch] = useState('')
  const [open, setOpen]     = useState(false)
  const [status, setStatus] = useState<'idle'|'found'|'notfound'>('idle')

  const suggestions = useMemo(() => {
    const q = norm(search)
    if (!q) return []
    return COMMUNE_LIST.filter(n => norm(n).includes(q)).slice(0, 6)
  }, [search])

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

    setStatus(AVAILABLE.has(key) ? 'found' : 'notfound')
    setSearch(name)
    setOpen(false)

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const l = layersRef.current[key]
      if (l) l.setStyle({ ...S_AVAIL })
      hiRef.current = null
    }, 3500)
  }, [])

  const handleSearch = useCallback(() => {
    const q = norm(search)
    if (!q) return
    const match =
      COMMUNE_LIST.find(n => norm(n) === q) ??
      COMMUNE_LIST.find(n => norm(n).startsWith(q)) ??
      COMMUNE_LIST.find(n => norm(n).includes(q))
    if (match) {
      flyTo(match)
    } else {
      setStatus('notfound')
      setOpen(false)
    }
  }, [search, flyTo])

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
        /* Local file — no external dependency, no 404 risk */
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

            /* Use proper display name from COMMUNE_LIST if possible */
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
    <div style={{ position:'relative', width:'100%', height:'100%' }}>

      {/* Search bar */}
      <div style={{ position:'absolute', top:12, left:12, right:12, zIndex:1000, pointerEvents:'auto' }}>
        <div style={{ ...glass, borderRadius:14, overflow:'hidden' }}>

          <div style={{ display:'flex', alignItems:'center', paddingLeft:13, paddingRight:6 }}>
            <svg width="15" height="15" fill="none" stroke="#9CA3AF" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{ flexShrink:0 }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setOpen(true); setStatus('idle') }}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              onFocus={() => search && setOpen(true)}
              placeholder="¿Tu comuna tiene despacho?"
              style={{
                flex:1, height:44, border:0, background:'transparent',
                fontSize:14, color:'#1B2B1E', outline:'none',
                padding:'0 10px',
                fontFamily:'Inter,system-ui,sans-serif',
                WebkitAppearance:'none',
              }}
            />
            {search && (
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={() => { setSearch(''); setStatus('idle'); setOpen(false) }}
                aria-label="Limpiar"
                style={{ border:0, background:'none', cursor:'pointer', padding:'0 7px', color:'#9CA3AF', lineHeight:1, flexShrink:0 }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>

          {open && suggestions.length > 0 && (
            <div style={{ borderTop:'1px solid rgba(0,0,0,0.05)' }}>
              {suggestions.map(name => (
                <button
                  key={name}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => flyTo(name)}
                  style={{
                    display:'flex', alignItems:'center', gap:9,
                    width:'100%', padding:'10px 14px',
                    background:'none', border:0, cursor:'pointer',
                    textAlign:'left', fontSize:13, color:'#1B2B1E',
                    fontFamily:'Inter,system-ui,sans-serif',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(34,197,94,.07)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <span style={{ width:6, height:6, borderRadius:'50%', background:'#22C55E', flexShrink:0 }} />
                  {name}
                </button>
              ))}
            </div>
          )}

          {status !== 'idle' && (
            <div style={{
              display:'flex', alignItems:'center', gap:7,
              padding:'9px 14px',
              borderTop:'1px solid rgba(0,0,0,0.05)',
              fontSize:12, fontWeight:600,
              color: status === 'found' ? '#15803D' : '#B91C1C',
              background: status === 'found' ? 'rgba(34,197,94,.06)' : 'rgba(239,68,68,.05)',
              fontFamily:'Inter,system-ui,sans-serif',
            }}>
              {status === 'found'
                ? <><span>🚚</span><span>Sí, hacemos despacho a esa comuna</span></>
                : <><span style={{ fontSize:11 }}>✕</span><span>Aún no llegamos a esa zona</span></>}
            </div>
          )}
        </div>
      </div>

      {/* Leaflet map */}
      <div ref={mapContainer} style={{ width:'100%', height:'100%' }} />


    </div>
  )
}
