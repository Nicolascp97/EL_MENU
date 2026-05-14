'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Zone } from '@/types/database'
import { formatPrice } from '@/lib/utils'

type Draft = Partial<Zone>

function fieldStyle(focus?: boolean): React.CSSProperties {
  return {
    width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 14,
    border: `1.5px solid ${focus ? '#1F4B35' : '#D5E8D9'}`,
    outline: 'none', background: '#fff', color: '#1B2B1E', boxSizing: 'border-box',
  }
}

export default function AdminZonasPage() {
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Record<string, Draft>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [newCommune, setNewCommune] = useState<Record<string, string>>({})
  const [flash, setFlash] = useState<{ id: string; text: string; ok: boolean } | null>(null)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const sb = createClient()

  async function load() {
    const { data } = await sb.from('zones').select('*').order('name')
    setZones(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function startEdit(zone: Zone) {
    setEditing(e => ({ ...e, [zone.id]: { ...zone } }))
  }

  function cancelEdit(id: string) {
    setEditing(e => { const n = { ...e }; delete n[id]; return n })
  }

  function patchDraft(id: string, patch: Partial<Zone>) {
    setEditing(e => ({ ...e, [id]: { ...e[id], ...patch } }))
  }

  async function saveZone(id: string) {
    const draft = editing[id]
    if (!draft) return
    setSaving(id)
    const { error } = await sb.from('zones').update(draft).eq('id', id)
    setSaving(null)
    if (error) {
      setFlash({ id, text: 'Error al guardar', ok: false })
    } else {
      setZones(z => z.map(z2 => z2.id === id ? { ...z2, ...draft } : z2))
      cancelEdit(id)
      setFlash({ id, text: 'Guardado correctamente', ok: true })
      setTimeout(() => setFlash(null), 2500)
    }
  }

  function addCommune(zoneId: string) {
    const val = newCommune[zoneId]?.trim()
    if (!val) return
    const current = editing[zoneId]?.communes ?? zones.find(z => z.id === zoneId)?.communes ?? []
    if (current.includes(val)) return
    if (!editing[zoneId]) startEdit(zones.find(z => z.id === zoneId)!)
    patchDraft(zoneId, { communes: [...current, val] })
    setNewCommune(n => ({ ...n, [zoneId]: '' }))
  }

  function removeCommune(zoneId: string, commune: string) {
    if (!editing[zoneId]) startEdit(zones.find(z => z.id === zoneId)!)
    const current = editing[zoneId]?.communes ?? zones.find(z => z.id === zoneId)?.communes ?? []
    patchDraft(zoneId, { communes: current.filter(c => c !== commune) })
  }

  return (
    <div style={{ maxWidth: 840, margin: '0 auto', padding: '32px 24px' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 26, fontWeight: 700, margin: '0 0 4px', color: '#1B2B1E' }}>
          Zonas de despacho
        </h1>
        <p style={{ margin: 0, color: '#6B7A6F', fontSize: 13 }}>
          Configura precios, mínimos de compra y comunas por zona.
        </p>
      </div>

      {loading ? (
        <p style={{ color: '#6B7A6F' }}>Cargando zonas...</p>
      ) : zones.length === 0 ? (
        <p style={{ color: '#9DC4AA' }}>No hay zonas configuradas.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {zones.map(zone => {
            const draft = editing[zone.id]
            const isEditing = !!draft
            const current = draft ?? zone
            const isSaving = saving === zone.id
            const flashThis = flash?.id === zone.id

            return (
              <div key={zone.id} style={{
                background: '#fff', borderRadius: 16, border: `1.5px solid ${isEditing ? '#1F4B35' : '#E8F1E9'}`,
                padding: '22px 24px', boxShadow: '0 1px 4px rgba(0,0,0,.04)',
                transition: 'border-color .2s',
              }}>
                {/* Zone header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      width: 36, height: 36, background: '#F0FFF4', borderRadius: 10,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2D6A4F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </span>
                    <div>
                      <p style={{ margin: 0, fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 18, color: '#1B2B1E' }}>
                        {zone.name}
                      </p>
                      <p style={{ margin: 0, fontSize: 12, color: '#9DC4AA' }}>
                        {zone.communes.length} comunas
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {flashThis && (
                      <span style={{ fontSize: 12, fontWeight: 500, color: flash!.ok ? '#2D6A4F' : '#C44536' }}>
                        {flash!.ok ? '✓' : '✗'} {flash!.text}
                      </span>
                    )}
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => cancelEdit(zone.id)}
                          style={{
                            padding: '7px 14px', borderRadius: 8, border: '1px solid #D5E8D9',
                            background: '#fff', color: '#6B7A6F', fontSize: 13, cursor: 'pointer',
                          }}
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => saveZone(zone.id)}
                          disabled={isSaving}
                          style={{
                            padding: '7px 16px', borderRadius: 8, border: 0,
                            background: '#1F4B35', color: '#fff', fontSize: 13, fontWeight: 600,
                            cursor: isSaving ? 'default' : 'pointer', opacity: isSaving ? .7 : 1,
                          }}
                        >
                          {isSaving ? 'Guardando...' : 'Guardar'}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => startEdit(zone)}
                        style={{
                          padding: '7px 16px', borderRadius: 8, border: '1px solid #D5E8D9',
                          background: '#F0FFF4', color: '#1F4B35', fontSize: 13, fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        Editar
                      </button>
                    )}
                  </div>
                </div>

                {/* Price fields */}
                <div className="zone-fields" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: 'Costo despacho', key: 'delivery_price' as keyof Zone },
                    { label: 'Mínimo minorista', key: 'min_order' as keyof Zone },
                    { label: 'Mínimo mayorista', key: 'min_order_wholesale' as keyof Zone },
                  ].map(({ label, key }) => {
                    const fid = `${zone.id}-${key}`
                    return (
                      <div key={key}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7A6F', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.4px' }}>
                          {label}
                        </label>
                        {isEditing ? (
                          <input
                            type="number"
                            value={current[key] as number}
                            onChange={e => patchDraft(zone.id, { [key]: Number(e.target.value) })}
                            onFocus={() => setFocusedField(fid)}
                            onBlur={() => setFocusedField(null)}
                            style={fieldStyle(focusedField === fid)}
                          />
                        ) : (
                          <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1B2B1E', letterSpacing: '-0.3px' }}>
                            {formatPrice(zone[key] as number)}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Communes */}
                <div>
                  <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: '#6B7A6F', textTransform: 'uppercase', letterSpacing: '.4px' }}>
                    Comunas incluidas
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: isEditing ? 10 : 0 }}>
                    {(current.communes ?? []).map(c => (
                      <span
                        key={c}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: '#F0FFF4', border: '1px solid #D8F3DC',
                          borderRadius: 100, padding: '4px 10px', fontSize: 12, color: '#1F4B35',
                        }}
                      >
                        {c}
                        {isEditing && (
                          <button
                            onClick={() => removeCommune(zone.id, c)}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: 14, height: 14, borderRadius: '50%', border: 0,
                              background: '#B7E4C7', color: '#1F4B35', cursor: 'pointer',
                              fontSize: 11, lineHeight: 1, padding: 0, marginLeft: 2,
                            }}
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                    {(current.communes ?? []).length === 0 && (
                      <span style={{ fontSize: 12, color: '#9DC4AA' }}>Sin comunas</span>
                    )}
                  </div>
                  {isEditing && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="text"
                        placeholder="Agregar comuna..."
                        value={newCommune[zone.id] ?? ''}
                        onChange={e => setNewCommune(n => ({ ...n, [zone.id]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && addCommune(zone.id)}
                        style={{ ...fieldStyle(), maxWidth: 220 }}
                      />
                      <button
                        onClick={() => addCommune(zone.id)}
                        style={{
                          padding: '8px 14px', borderRadius: 8, border: 0,
                          background: '#D8F3DC', color: '#1F4B35', fontSize: 13,
                          fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        + Agregar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        @media (max-width: 580px) {
          .zone-fields { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
