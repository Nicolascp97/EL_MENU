'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Recipe } from '@/types/database'

function daysAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'hoy'
  if (days === 1) return 'hace 1 día'
  return `hace ${days} días`
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      role="switch"
      aria-checked={checked}
      style={{
        width: 42, height: 24, borderRadius: 12, border: 0, cursor: 'pointer',
        background: checked ? '#22C55E' : '#D1D5DB',
        position: 'relative', transition: 'background .2s', flexShrink: 0, padding: 0,
      }}
    >
      <span style={{
        display: 'block', width: 18, height: 18, borderRadius: '50%',
        background: '#fff', position: 'absolute', top: 3,
        left: checked ? 21 : 3, transition: 'left .2s',
        boxShadow: '0 1px 3px rgba(0,0,0,.25)',
      }} />
    </button>
  )
}

export default function AdminRecetasPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const sb = createClient()

  async function load() {
    setLoading(true)
    const { data } = await sb.from('recipes').select('*').order('generated_at', { ascending: false })
    setRecipes(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggleActive(id: string, current: boolean) {
    await sb.from('recipes').update({ active: !current }).eq('id', id)
    setRecipes(r => r.map(rec => rec.id === id ? { ...rec, active: !current } : rec))
  }

  async function regenerar() {
    setRegenerating(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/trigger-recipes', { method: 'POST' })
      const json = await res.json()
      if (res.ok) {
        setMsg({ text: `${json.generated} recetas generadas correctamente`, ok: true })
        await load()
      } else {
        setMsg({ text: json.error ?? 'Error al generar recetas', ok: false })
      }
    } catch {
      setMsg({ text: 'Error de red', ok: false })
    } finally {
      setRegenerating(false)
    }
  }

  const activeCount = recipes.filter(r => r.active).length
  const inactiveCount = recipes.filter(r => !r.active).length
  const lastGenerated = recipes[0]?.generated_at

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 26, fontWeight: 700, margin: '0 0 6px', color: '#1B2B1E' }}>
            Recetas IA
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {lastGenerated && (
              <span style={{
                background: '#F0FFF4', color: '#2D6A4F', border: '1px solid #D8F3DC',
                fontSize: 12, fontWeight: 500, padding: '3px 10px', borderRadius: 100,
              }}>
                Última generación: {daysAgo(lastGenerated)}
              </span>
            )}
            {recipes.length > 0 && (
              <span style={{ color: '#6B7A6F', fontSize: 13 }}>
                {activeCount} activa{activeCount !== 1 ? 's' : ''} · {inactiveCount} inactiva{inactiveCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <button
            onClick={regenerar}
            disabled={regenerating}
            style={{
              height: 44, padding: '0 22px', borderRadius: 100,
              background: regenerating ? '#6B9B7A' : '#1F4B35', color: '#fff',
              fontWeight: 700, fontSize: 14, border: 0,
              cursor: regenerating ? 'default' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              boxShadow: regenerating ? 'none' : '0 2px 8px rgba(31,75,53,.3)',
              transition: 'background .2s, box-shadow .2s',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            {regenerating ? 'Generando con IA...' : 'Regenerar con IA'}
          </button>
          {msg && (
            <span style={{ fontSize: 13, color: msg.ok ? '#2D6A4F' : '#C44536', fontWeight: 500 }}>
              {msg.ok ? '✓' : '✗'} {msg.text}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: '#6B7A6F' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9DC4AA" strokeWidth="2" style={{ margin: '0 auto 10px', display: 'block', animation: 'spin 1s linear infinite' }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          Cargando recetas...
        </div>
      ) : recipes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: '#9DC4AA' }}>
          <p style={{ fontWeight: 600, color: '#3A4A3E', margin: '0 0 6px', fontSize: 16 }}>Sin recetas aún</p>
          <p style={{ fontSize: 13, margin: 0 }}>Haz clic en "Regenerar con IA" para generar el primer batch.</p>
        </div>
      ) : (
        <div className="recipes-admin-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
          {recipes.map(r => (
            <div key={r.id} style={{
              background: '#fff', borderRadius: 14, padding: '18px 20px',
              border: `1px solid ${r.active ? '#D8F3DC' : '#E8EDE9'}`,
              display: 'flex', gap: 14, alignItems: 'flex-start',
              opacity: r.active ? 1 : .6, transition: 'opacity .2s',
            }}>
              {/* Emoji */}
              <span style={{ fontSize: 38, lineHeight: 1, flexShrink: 0 }}>{r.emoji}</span>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 16, color: '#1B2B1E' }}>
                    {r.title}
                  </span>
                  <span style={{ background: '#F0FFF4', color: '#2D6A4F', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: '.4px' }}>
                    {r.tag}
                  </span>
                </div>
                <p style={{ margin: '0 0 6px', fontSize: 12, color: '#6B7A6F', lineHeight: 1.5 }}>{r.description}</p>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#9DC4AA', marginBottom: 8, flexWrap: 'wrap' }}>
                  <span>{r.time_minutes} min</span>
                  <span>{r.servings} porciones</span>
                  <span>{r.difficulty}</span>
                  <span>{fmt(r.generated_at)}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {r.ingredients.slice(0, 6).map(ing => (
                    <span key={ing.name} style={{
                      background: '#F8F9FA', border: '1px solid #E4E9E5',
                      borderRadius: 100, padding: '2px 8px', fontSize: 10, color: '#3A4A3E',
                    }}>
                      {ing.qty} {ing.unit} {ing.name}
                    </span>
                  ))}
                  {r.ingredients.length > 6 && (
                    <span style={{ fontSize: 10, color: '#9DC4AA', padding: '2px 4px' }}>
                      +{r.ingredients.length - 6} más
                    </span>
                  )}
                </div>
              </div>

              {/* Toggle */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <ToggleSwitch checked={r.active} onChange={() => toggleActive(r.id, r.active)} />
                <span style={{ fontSize: 10, color: r.active ? '#22C55E' : '#9DC4AA', fontWeight: 600 }}>
                  {r.active ? 'Activa' : 'Inactiva'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @media (min-width: 640px) {
          .recipes-admin-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
