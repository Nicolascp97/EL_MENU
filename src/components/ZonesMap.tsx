'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

// ── Zone metadata ──────────────────────────────────────────────
const FILL   = { oriente: '#16A34A', norte: '#DC2626', sur: '#D97706' } as const
const BG     = { oriente: '#DCFCE7', norte: '#FEE2E2', sur: '#FEF3C7' } as const

interface ZoneMeta { label: string; communes: string; emoji: string }
const META: Record<string, ZoneMeta> = {
  oriente: {
    label:   'Zona Oriente',
    emoji:   '🥑',
    communes: 'Providencia · Ñuñoa · Las Condes · Vitacura · Lo Barnechea · La Reina',
  },
  norte: {
    label:   'Zona Norte · Centro · Poniente',
    emoji:   '🍊',
    communes: 'Santiago · Recoleta · Independencia · Renca · Quilicura · Huechuraba · Pudahuel · Estación Central · Cerrillos · Maipú',
  },
  sur: {
    label:   'Zona Sur',
    emoji:   '🍅',
    communes: 'Macul · Peñalolén · La Florida · Puente Alto · San Joaquín · San Miguel · La Cisterna · El Bosque · La Granja · San Ramón · Pedro Aguirre Cerda',
  },
}

// Keys are NFD-normalized (no accents, lowercase)
const COMMUNE_ZONE: Record<string, keyof typeof FILL> = {
  providencia: 'oriente', nunoa: 'oriente', 'las condes': 'oriente',
  vitacura: 'oriente', 'lo barnechea': 'oriente', 'la reina': 'oriente',
  santiago: 'norte', recoleta: 'norte', independencia: 'norte',
  renca: 'norte', quilicura: 'norte', huechuraba: 'norte',
  pudahuel: 'norte', 'estacion central': 'norte', cerrillos: 'norte', maipu: 'norte',
  macul: 'sur', penalolen: 'sur', 'la florida': 'sur', 'puente alto': 'sur',
  'san joaquin': 'sur', 'san miguel': 'sur', 'la cisterna': 'sur',
  'el bosque': 'sur', 'la granja': 'sur', 'san ramon': 'sur',
  'pedro aguirre cerda': 'sur',
}

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

function tooltipHTML(zone: keyof typeof FILL): string {
  const m = META[zone]
  const fill = FILL[zone]
  const bg   = BG[zone]
  return (
    `<div style="font-family:Inter,system-ui,sans-serif;min-width:220px;max-width:280px;padding:2px 0">` +
    `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">` +
    `<span style="width:10px;height:10px;border-radius:50%;background:${fill};flex-shrink:0"></span>` +
    `<strong style="font-size:14px;color:#1B2B1E;line-height:1.2">${m.label}</strong>` +
    `</div>` +
    `<p style="font-size:11px;color:#6B7A6F;line-height:1.6;margin:0 0 10px;letter-spacing:.01em">${m.communes}</p>` +
    `<div style="display:flex;align-items:center;justify-content:space-between;background:${bg};border-radius:10px;padding:8px 12px">` +
    `<span style="font-size:11px;color:#374151;font-weight:600">Despacho a domicilio</span>` +
    `<strong style="font-size:16px;color:#1B2B1E;letter-spacing:-.5px">$2.990</strong>` +
    `</div>` +
    `</div>`
  )
}

const BIZ: [number, number] = [-33.490, -70.598] // Los Olmos 3967, Macul

export default function ZonesMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || mapRef.current) return

    let map: any = null

    async function boot() {
      const L = (await import('leaflet')).default

      map = L.map(container!, {
        center: [-33.47, -70.64],
        zoom: 10,
        zoomControl: false,
        scrollWheelZoom: false,
        attributionControl: true,
      })
      mapRef.current = map

      // CartoDB Positron — light, minimal, premium feel
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        {
          attribution:
            '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> ' +
            '© <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 19,
        }
      ).addTo(map)

      // ── GeoJSON zones ──────────────────────────────────────────
      try {
        const res = await fetch(
          'https://raw.githubusercontent.com/fcortes/Chile-GeoJSON/master/Comunal.geojson'
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = await res.json()

        L.geoJSON(data, {
          filter(f) {
            return Number(f?.properties?.COD_REGI) === 13
          },
          style(f) {
            const raw: string = f?.properties?.NOM_COM ?? ''
            const zone = COMMUNE_ZONE[norm(raw)]
            if (!zone) {
              return {
                fillColor: '#E5E7EB',
                fillOpacity: 0.35,
                color: '#D1D5DB',
                weight: 0.8,
                opacity: 0.7,
              }
            }
            return {
              fillColor:   FILL[zone],
              fillOpacity: 0.28,
              color:       FILL[zone],
              weight:      1.8,
              opacity:     0.75,
            }
          },
          onEachFeature(f, layer) {
            const raw: string = f?.properties?.NOM_COM ?? ''
            const zone = COMMUNE_ZONE[norm(raw)]
            if (!zone) return

            layer.bindTooltip(tooltipHTML(zone), {
              sticky: true,
              opacity: 1,
              className: 'zm-tooltip',
            })

            layer.on('mouseover', () =>
              (layer as any).setStyle({
                fillOpacity: 0.52,
                weight: 2.5,
              })
            )
            layer.on('mouseout', () =>
              (layer as any).setStyle({
                fillOpacity: 0.28,
                weight: 1.8,
              })
            )
          },
        }).addTo(map)
      } catch (err) {
        console.error('[ZonesMap] GeoJSON error:', err)
      }

      // ── Business marker ────────────────────────────────────────
      const logoIcon = L.divIcon({
        html:
          `<div style="` +
          `width:46px;height:46px;border-radius:50%;` +
          `background:#fff;` +
          `box-shadow:0 4px 16px rgba(0,0,0,.22),0 0 0 3px #16A34A,0 0 0 5px rgba(22,163,74,.2);` +
          `display:grid;place-items:center;` +
          `">` +
          `<img src="/logo/elmenu-color.png" style="width:32px;height:32px;object-fit:contain" alt="El Menú" />` +
          `</div>`,
        className: 'zm-logo-icon',
        iconSize:   [46, 46],
        iconAnchor: [23, 23],
        popupAnchor:[0, -28],
      })

      L.marker(BIZ, { icon: logoIcon, zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:Inter,system-ui,sans-serif;padding:4px 0;min-width:160px">` +
          `<strong style="font-size:13px;color:#1B2B1E;display:block;margin-bottom:4px">El Menú</strong>` +
          `<span style="font-size:12px;color:#6B7A6F;display:block;margin-bottom:4px">Los Olmos 3967, Macul</span>` +
          `<span style="font-size:11px;font-weight:600;color:#2D6A4F">Lun–Sáb · 8:00–20:00</span>` +
          `</div>`,
          { closeButton: false, className: 'zm-popup' }
        )
    }

    boot()

    return () => {
      if (map) {
        map.remove()
        mapRef.current = null
      }
    }
  }, [])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
