'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, CheckCircle, XCircle, Clock, Building2, Phone, Mail, Calendar, RefreshCw } from 'lucide-react'

type MayoristaRecord = {
  id: string
  name: string
  phone: string | null
  email: string
  role: 'minorista' | 'mayorista'
  created_at: string
}

type ListData = {
  pending: MayoristaRecord[]
  approved: MayoristaRecord[]
}

const GREEN   = '#1B2B1E'
const GREEN_M = '#2D6A4F'
const ACCENT  = '#E8621A'
const BG      = '#F3F7F4'

function formatDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, type }: { msg: string; type: 'ok' | 'err' }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: type === 'ok' ? '#166534' : '#991B1B',
      color: '#fff', padding: '12px 20px', borderRadius: 12,
      fontWeight: 600, fontSize: 14, zIndex: 999,
      boxShadow: '0 4px 20px rgba(0,0,0,.25)',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      {type === 'ok' ? '✅' : '❌'} {msg}
    </div>
  )
}

// ─── Card de solicitante ──────────────────────────────────────────────────────
function PendingCard({
  record,
  onApprove,
  onReject,
  loading,
}: {
  record: MayoristaRecord
  onApprove: (id: string) => void
  onReject: (id: string) => void
  loading: string | null
}) {
  const isLoading = loading === record.id

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #D4E0D4',
      borderLeft: `4px solid ${ACCENT}`,
      borderRadius: 12,
      padding: '20px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: '#FFF3E0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
          }}>
            🏢
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: 16, color: GREEN, margin: 0 }}>{record.name}</p>
            <p style={{ fontSize: 12, color: '#856404', background: '#FFF3CD', padding: '2px 8px', borderRadius: 99, display: 'inline-block', marginTop: 4, fontWeight: 600 }}>
              ⏳ Pendiente de aprobación
            </p>
          </div>
        </div>
      </div>

      {/* Info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#4A6350', fontSize: 14 }}>
          <Mail size={13} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.email}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#4A6350', fontSize: 14 }}>
          <Phone size={13} style={{ flexShrink: 0 }} />
          <span>{record.phone ?? 'No indicó'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#4A6350', fontSize: 14 }}>
          <Calendar size={13} style={{ flexShrink: 0 }} />
          <span>Registrado: {formatDate(record.created_at)}</span>
        </div>
      </div>

      {/* Botones */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={() => onApprove(record.id)}
          disabled={isLoading}
          style={{
            flex: 1, minWidth: 130,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '10px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: '#166534', color: '#fff',
            fontWeight: 600, fontSize: 14,
            opacity: isLoading ? .6 : 1,
            transition: 'opacity .12s',
          }}
        >
          <CheckCircle size={15} />
          {isLoading ? 'Procesando…' : 'Aprobar mayorista'}
        </button>
        <button
          onClick={() => onReject(record.id)}
          disabled={isLoading}
          style={{
            flex: 1, minWidth: 110,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '10px 16px', borderRadius: 10,
            border: '1px solid #FECACA', cursor: 'pointer',
            background: '#FFF5F5', color: '#991B1B',
            fontWeight: 600, fontSize: 14,
            opacity: isLoading ? .6 : 1,
            transition: 'opacity .12s',
          }}
        >
          <XCircle size={15} />
          Rechazar
        </button>
      </div>
    </div>
  )
}

// ─── Fila de aprobado ─────────────────────────────────────────────────────────
function ApprovedRow({ record }: { record: MayoristaRecord }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #D4E0D4',
      borderLeft: '4px solid #166534',
      borderRadius: 12,
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap',
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 8,
        background: '#DCFCE7',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, flexShrink: 0,
      }}>
        🏪
      </div>
      <div style={{ flex: 1, minWidth: 160 }}>
        <p style={{ fontWeight: 700, fontSize: 15, color: GREEN, margin: 0 }}>{record.name}</p>
        <p style={{ fontSize: 13, color: '#4A6350', margin: '2px 0 0' }}>{record.email}</p>
      </div>
      {record.phone && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#4A6350', fontSize: 13 }}>
          <Phone size={12} />
          {record.phone}
        </div>
      )}
      <span style={{
        fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 99,
        background: '#DCFCE7', color: '#166534',
      }}>
        ✅ Mayorista activo
      </span>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function MayoristasAdminClient() {
  const [data, setData]         = useState<ListData>({ pending: [], approved: [] })
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState<'pending' | 'approved'>('pending')
  const [actionId, setActionId] = useState<string | null>(null)
  const [toast, setToast]       = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    const res = await fetch('/api/admin/mayoristas')
    if (res.ok) {
      const json = await res.json()
      setData(json)
    }
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  function showToast(msg: string, type: 'ok' | 'err') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleAction(userId: string, action: 'approve' | 'reject') {
    setActionId(userId)
    const res = await fetch('/api/admin/mayoristas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action }),
    })
    setActionId(null)

    if (res.ok) {
      if (action === 'approve') {
        showToast('Mayorista aprobado correctamente', 'ok')
        setTab('approved') // mostrar la pestaña de aprobados al aprobar
      } else {
        showToast('Solicitud rechazada', 'err')
      }
      await load(true)
    } else {
      const err = await res.json().catch(() => ({}))
      showToast(err.error ?? 'Ocurrió un error', 'err')
    }
  }

  // ─── Skeleton ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ height: 32, width: 220, background: '#E8F0E8', borderRadius: 8, marginBottom: 24 }} />
        {[1, 2].map(i => (
          <div key={i} style={{ height: 140, background: '#E8F0E8', borderRadius: 12, marginBottom: 14 }} />
        ))}
      </div>
    )
  }

  const pendingCount  = data.pending.length
  const approvedCount = data.approved.length

  return (
    <div style={{ padding: '28px 28px 40px', maxWidth: 820 }}>
      {toast && <Toast {...toast} />}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Building2 size={22} color={GREEN} />
            <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 26, color: GREEN, margin: 0 }}>
              Clientes mayoristas
            </h1>
            {pendingCount > 0 && (
              <span style={{
                background: ACCENT, color: '#fff',
                fontSize: 13, fontWeight: 700,
                padding: '3px 10px', borderRadius: 99,
              }}>
                {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p style={{ color: '#4A6350', fontSize: 14, margin: 0 }}>
            Gestiona los registros mayoristas sin salir del panel.
          </p>
        </div>

        <button
          onClick={() => load(true)}
          disabled={refreshing}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 9,
            border: '1px solid #D4E0D4', background: '#fff',
            color: '#4A6350', fontSize: 13, cursor: 'pointer',
            opacity: refreshing ? .6 : 1,
          }}
        >
          <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          Actualizar
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
        {[
          { key: 'pending',  label: 'Solicitudes pendientes', count: pendingCount },
          { key: 'approved', label: 'Mayoristas aprobados',   count: approvedCount },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: tab === t.key ? GREEN : '#fff',
              color: tab === t.key ? '#fff' : '#4A6350',
              fontWeight: tab === t.key ? 700 : 500,
              fontSize: 14,
              border: tab === t.key ? 'none' : '1px solid #D4E0D4',
            } as React.CSSProperties}
          >
            {t.key === 'pending' ? <Clock size={14} /> : <CheckCircle size={14} />}
            {t.label}
            <span style={{
              background: tab === t.key ? 'rgba(255,255,255,.2)' : '#E8F0E8',
              color: tab === t.key ? '#fff' : '#4A6350',
              fontSize: 12, fontWeight: 700,
              padding: '1px 7px', borderRadius: 99,
            }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Contenido */}
      {tab === 'pending' && (
        <div>
          {pendingCount === 0 ? (
            <EmptyState
              icon="🎉"
              title="No hay solicitudes pendientes"
              desc="Cuando un negocio se registre en el formulario mayorista, aparecerá aquí para que lo apruebes con un clic."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {data.pending.map(r => (
                <PendingCard
                  key={r.id}
                  record={r}
                  loading={actionId}
                  onApprove={id => handleAction(id, 'approve')}
                  onReject={id => handleAction(id, 'reject')}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'approved' && (
        <div>
          {approvedCount === 0 ? (
            <EmptyState
              icon="🏪"
              title="Aún no hay mayoristas aprobados"
              desc="Los clientes que apruebes desde la pestaña anterior aparecerán aquí."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.approved.map(r => (
                <ApprovedRow key={r.id} record={r} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* CSS para la animación del refresh */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

function EmptyState({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #D4E0D4', borderRadius: 14,
      padding: '48px 32px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
      <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, color: '#1B2B1E', marginBottom: 8 }}>{title}</h3>
      <p style={{ color: '#4A6350', fontSize: 15, maxWidth: 400, margin: '0 auto' }}>{desc}</p>
    </div>
  )
}
