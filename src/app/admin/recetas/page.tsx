'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Recipe } from '@/types/database'

function fmt(d: string) {
  return new Date(d).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminRecetasPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [msg, setMsg] = useState('')

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
    setMsg('')
    try {
      const res = await fetch('/api/admin/trigger-recipes', { method: 'POST' })
      const json = await res.json()
      if (res.ok) {
        setMsg(`✅ Generadas ${json.generated} recetas`)
        await load()
      } else {
        setMsg(`❌ Error: ${json.error}`)
      }
    } catch (e) {
      setMsg(`❌ Error de red`)
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 28, fontWeight: 700, margin: 0, color: '#1B2B1E' }}>Recetas IA</h1>
          <p style={{ margin: '4px 0 0', color: '#6B7A6F', fontSize: 14 }}>Gestión de recetas generadas automáticamente</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {msg && <span style={{ fontSize: 13, color: msg.startsWith('✅') ? '#2D6A4F' : '#C44536' }}>{msg}</span>}
          <button
            onClick={regenerar}
            disabled={regenerating}
            style={{
              height: 44, padding: '0 20px', borderRadius: 100, background: '#1F4B35', color: '#fff',
              fontWeight: 600, fontSize: 14, border: 0, cursor: regenerating ? 'default' : 'pointer',
              opacity: regenerating ? .6 : 1, display: 'inline-flex', alignItems: 'center', gap: 8,
            }}
          >
            {regenerating ? '⏳ Generando...' : '🤖 Regenerar ahora'}
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#6B7A6F' }}>Cargando...</p>
      ) : recipes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#6B7A6F' }}>
          <p>No hay recetas aún.</p>
          <p style={{ fontSize: 13 }}>Haz clic en "Regenerar ahora" para generar las primeras.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {recipes.map(r => (
            <div key={r.id} style={{
              background: '#fff', border: `1px solid ${r.active ? '#D8F3DC' : '#E4E9E5'}`,
              borderRadius: 14, padding: '18px 20px', display: 'flex', gap: 16, alignItems: 'flex-start',
              opacity: r.active ? 1 : .55,
            }}>
              <span style={{ fontSize: 36, lineHeight: 1, flexShrink: 0 }}>{r.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 17, color: '#1B2B1E' }}>{r.title}</span>
                  <span style={{ background: '#EFF8F1', color: '#2D6A4F', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 100 }}>{r.tag}</span>
                  {r.active
                    ? <span style={{ background: '#D8F3DC', color: '#1F4B35', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 100 }}>● Activa</span>
                    : <span style={{ background: '#EEF1ED', color: '#6B7A6F', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 100 }}>Inactiva</span>
                  }
                </div>
                <p style={{ margin: 0, fontSize: 13, color: '#6B7A6F', lineHeight: 1.45 }}>{r.description}</p>
                <div style={{ marginTop: 6, fontSize: 12, color: '#94A3B8', display: 'flex', gap: 12 }}>
                  <span>⏱ {r.time_minutes} min</span>
                  <span>👤 {r.servings} porciones</span>
                  <span>{r.difficulty}</span>
                  <span>{fmt(r.generated_at)}</span>
                </div>
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {r.ingredients.map(ing => (
                    <span key={ing.name} style={{ background: '#F8F9FA', border: '1px solid #E4E9E5', borderRadius: 100, padding: '3px 8px', fontSize: 11, color: '#3A4A3E' }}>
                      {ing.qty} {ing.unit} {ing.name}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => toggleActive(r.id, r.active)}
                style={{
                  flexShrink: 0, height: 36, padding: '0 14px', borderRadius: 8,
                  background: r.active ? '#FDE6CC' : '#D8F3DC',
                  color: r.active ? '#D96B12' : '#1F4B35',
                  border: 0, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                }}
              >
                {r.active ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
