'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Order, OrderStatus } from '@/types/database'
import { formatPrice } from '@/lib/utils'
import { resolvePresentation } from '@/lib/units'

// ─── Tipos para solicitudes mayoristas ───────────────────────────────────────
type MayoristaRequest = {
  id:         string
  name:       string
  email:      string
  phone:      string | null
  created_at: string
  hasProfile: boolean
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  nuevo: 'Nuevo',
  preparando: 'Preparando',
  listo: 'Listo',
  en_camino: 'En camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

const STATUS_COLORS: Record<OrderStatus, string> = {
  nuevo: '#E9A23B',
  preparando: '#3B82F6',
  listo: '#8B5CF6',
  en_camino: '#06B6D4',
  entregado: '#52B788',
  cancelado: '#EF4444',
}

const PIPELINE: OrderStatus[] = ['nuevo', 'preparando', 'listo', 'en_camino']
const STATUS_FLOW: OrderStatus[] = ['nuevo', 'preparando', 'listo', 'en_camino', 'entregado']

type Props = { initialOrders: Order[] }

function isToday(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  return d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
}

export default function OrdersRealtimeClient({ initialOrders }: Props) {
  const [orders,    setOrders]    = useState<Order[]>(initialOrders)
  const [updating,  setUpdating]  = useState<string | null>(null)
  const [notifState, setNotifState] = useState<NotificationPermission>('default')
  const supabase = createClient()

  // ── Mayoristas pendientes ──────────────────────────────────────────────────
  const [mayoristas,       setMayoristas]       = useState<MayoristaRequest[]>([])
  const [mayoristaLoading, setMayoristaLoading] = useState(true)
  const [mayoristaAction,  setMayoristaAction]  = useState<string | null>(null)
  const [mayoristaToast,   setMayoristaToast]   = useState<string | null>(null)
  const [expanded,         setExpanded]         = useState(false)

  const loadMayoristas = useCallback(async () => {
    const res = await fetch('/api/admin/mayoristas')
    if (res.ok) {
      const data = await res.json()
      setMayoristas(data.pending ?? [])
      // Auto-expandir si hay pendientes
      if ((data.pending ?? []).length > 0) setExpanded(true)
    }
    setMayoristaLoading(false)
  }, [])

  useEffect(() => { loadMayoristas() }, [loadMayoristas])

  async function handleMayoristaAction(userId: string, action: 'approve' | 'reject') {
    setMayoristaAction(userId + action)
    const res = await fetch('/api/admin/mayoristas', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ userId, action }),
    })
    setMayoristaAction(null)
    if (res.ok) {
      setMayoristaToast(action === 'approve' ? '✅ Mayorista aprobado' : '❌ Solicitud rechazada')
      setTimeout(() => setMayoristaToast(null), 3500)
      await loadMayoristas()
    }
  }

  useEffect(() => {
    if ('Notification' in window) setNotifState(Notification.permission)
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
        if (payload.eventType === 'INSERT') {
          setOrders(prev => [payload.new as Order, ...prev])
          if (Notification.permission === 'granted') {
            new Notification('Nuevo pedido en El Menú', {
              body: `${(payload.new as Order).phone} — ${formatPrice((payload.new as Order).total)}`,
              icon: '/favicon.ico',
            })
          }
        }
        if (payload.eventType === 'UPDATE') {
          setOrders(prev => prev.map(o => o.id === payload.new.id ? payload.new as Order : o))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  async function updateStatus(orderId: string, status: OrderStatus) {
    setUpdating(orderId)
    await supabase.from('orders').update({ status }).eq('id', orderId)
    setUpdating(null)
  }

  async function requestNotif() {
    const p = await Notification.requestPermission()
    setNotifState(p)
  }

  // KPIs
  const todayOrders = orders.filter(o => isToday(o.created_at))
  const todayRevenue = todayOrders.reduce((s, o) => s + o.total, 0)
  const avgTicket = todayOrders.length ? todayRevenue / todayOrders.length : 0
  const urgentCount = orders.filter(o => o.status === 'nuevo').length

  const active = orders.filter(o => o.status !== 'entregado' && o.status !== 'cancelado')
  const done = orders.filter(o => o.status === 'entregado' || o.status === 'cancelado')

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 26, fontWeight: 700, margin: 0, color: '#1B2B1E' }}>
              Pedidos
            </h1>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: '#D8F3DC', color: '#1F4B35', fontSize: 11, fontWeight: 700,
              padding: '4px 10px', borderRadius: 100,
            }}>
              <span className="live-dot" />
              EN VIVO
            </span>
          </div>
          <p style={{ margin: 0, color: '#6B7A6F', fontSize: 13 }}>
            {active.length} en curso · {todayOrders.length} pedido{todayOrders.length !== 1 ? 's' : ''} hoy
          </p>
        </div>
        {notifState !== 'granted' && (
          <button
            onClick={requestNotif}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 10, border: '1px solid #D5E8D9', background: '#fff',
              color: '#3A4A3E', fontSize: 13, cursor: 'pointer',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            Activar alertas
          </button>
        )}
      </div>

      {/* ── Toast mayorista ───────────────────────────────────────── */}
      {mayoristaToast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: mayoristaToast.startsWith('✅') ? '#166534' : '#991B1B',
          color: '#fff', padding: '12px 20px', borderRadius: 12,
          fontWeight: 600, fontSize: 14, zIndex: 999,
          boxShadow: '0 4px 20px rgba(0,0,0,.25)',
        }}>
          {mayoristaToast}
        </div>
      )}

      {/* ── Solicitudes mayoristas pendientes ─────────────────────── */}
      {!mayoristaLoading && mayoristas.length > 0 && (
        <div style={{
          background: '#FFF8F3',
          border: '1.5px solid #E8621A',
          borderRadius: 14,
          marginBottom: 24,
          overflow: 'hidden',
        }}>
          {/* Header del bloque */}
          <button
            onClick={() => setExpanded(e => !e)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 20px', background: 'transparent', border: 'none',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 20 }}>🏢</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#1B2B1E', flex: 1 }}>
              {mayoristas.length} solicitud{mayoristas.length > 1 ? 'es' : ''} mayorista pendiente{mayoristas.length > 1 ? 's' : ''}
            </span>
            <span style={{
              background: '#E8621A', color: '#fff',
              fontSize: 12, fontWeight: 800,
              padding: '3px 10px', borderRadius: 99,
            }}>
              {mayoristas.length}
            </span>
            <span style={{ color: '#E8621A', fontSize: 18, fontWeight: 700 }}>
              {expanded ? '▲' : '▼'}
            </span>
          </button>

          {/* Lista de solicitudes */}
          {expanded && (
            <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {mayoristas.map(m => {
                const isLoading = mayoristaAction?.startsWith(m.id)
                return (
                  <div key={m.id} style={{
                    background: '#fff',
                    border: '1px solid #FDDCCC',
                    borderRadius: 10,
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#1B2B1E' }}>{m.name}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6B7A6F' }}>{m.email}</p>
                      {m.phone && (
                        <p style={{ margin: '1px 0 0', fontSize: 12, color: '#6B7A6F' }}>{m.phone}</p>
                      )}
                    </div>
                    {/* Fecha */}
                    <p style={{ margin: 0, fontSize: 11, color: '#9DC4AA', whiteSpace: 'nowrap' }}>
                      {new Date(m.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
                    </p>
                    {/* Botones */}
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button
                        onClick={() => handleMayoristaAction(m.id, 'approve')}
                        disabled={!!isLoading}
                        style={{
                          padding: '8px 14px', borderRadius: 8, border: 'none',
                          background: '#166534', color: '#fff',
                          fontWeight: 600, fontSize: 13, cursor: 'pointer',
                          opacity: isLoading ? .6 : 1,
                          display: 'flex', alignItems: 'center', gap: 5,
                        }}
                      >
                        ✅ {isLoading && mayoristaAction === m.id + 'approve' ? '...' : 'Aprobar'}
                      </button>
                      <button
                        onClick={() => handleMayoristaAction(m.id, 'reject')}
                        disabled={!!isLoading}
                        style={{
                          padding: '8px 12px', borderRadius: 8,
                          border: '1px solid #FECACA', background: '#FFF5F5',
                          color: '#991B1B', fontWeight: 600, fontSize: 13,
                          cursor: 'pointer', opacity: isLoading ? .6 : 1,
                        }}
                      >
                        {isLoading && mayoristaAction === m.id + 'reject' ? '...' : '❌'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* KPI Strip */}
      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        <KpiCard
          label="Pedidos hoy"
          value={String(todayOrders.length)}
          sub={`${orders.length} cargados`}
          accent="#2D6A4F"
        />
        <KpiCard
          label="Ingresos hoy"
          value={todayOrders.length ? formatPrice(todayRevenue) : '—'}
          sub="pedidos del día"
          accent="#3B82F6"
        />
        <KpiCard
          label="Ticket promedio"
          value={avgTicket ? formatPrice(avgTicket) : '—'}
          sub="por pedido hoy"
          accent="#8B5CF6"
        />
        <KpiCard
          label="Sin procesar"
          value={String(urgentCount)}
          sub={urgentCount > 0 ? 'requieren atención' : 'todo procesado'}
          accent={urgentCount > 0 ? '#E9A23B' : '#52B788'}
        />
      </div>

      {/* Pipeline Kanban */}
      {active.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ overflowX: 'auto', margin: '0 -8px', padding: '0 8px' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, minmax(210px, 1fr))',
            gap: 12, alignItems: 'start', minWidth: 720,
          }}>
            {PIPELINE.map(status => {
              const col = active.filter(o => o.status === status)
              return (
                <div key={status}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
                    paddingBottom: 10, borderBottom: `2px solid ${STATUS_COLORS[status]}30`,
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[status], flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, fontSize: 12, color: '#3A4A3E' }}>{STATUS_LABELS[status]}</span>
                    <span style={{
                      marginLeft: 'auto', background: STATUS_COLORS[status] + '20',
                      color: STATUS_COLORS[status], fontSize: 11, fontWeight: 700,
                      padding: '1px 8px', borderRadius: 100,
                    }}>{col.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {col.length === 0 ? (
                      <div style={{
                        borderRadius: 10, border: '1.5px dashed #D5E8D9',
                        padding: '20px 12px', textAlign: 'center', color: '#9DC4AA', fontSize: 12,
                      }}>
                        Vacío
                      </div>
                    ) : col.map(order => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        updating={updating === order.id}
                        onUpdateStatus={updateStatus}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Done section */}
      {done.length > 0 && (
        <details style={{ marginTop: 32 }}>
          <summary style={{ fontSize: 13, fontWeight: 500, color: '#6B7A6F', cursor: 'pointer', marginBottom: 12, userSelect: 'none' }}>
            Historial del día ({done.length} completados)
          </summary>
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', marginTop: 10 }}>
            {done.map(order => (
              <OrderCard key={order.id} order={order} updating={false} onUpdateStatus={updateStatus} />
            ))}
          </div>
        </details>
      )}

      <style>{`
        .live-dot {
          display: inline-block; width: 7px; height: 7px; border-radius: 50%;
          background: #22C55E; animation: livepulse 2s ease infinite;
        }
        @keyframes livepulse {
          0%   { box-shadow: 0 0 0 0 rgba(34,197,94,.6); }
          70%  { box-shadow: 0 0 0 7px rgba(34,197,94,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }
        @media (max-width: 640px) {
          .kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  )
}

function KpiCard({ label, value, sub, accent }: {
  label: string; value: string; sub: string; accent: string
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '18px 20px',
      border: '1px solid #E8F1E9', borderLeft: `3px solid ${accent}`,
      boxShadow: '0 1px 4px rgba(0,0,0,.04)',
    }}>
      <p style={{ margin: '0 0 6px', fontSize: 11, color: '#6B7A6F', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</p>
      <p style={{ margin: '0 0 3px', fontSize: 26, fontWeight: 800, color: '#1B2B1E', lineHeight: 1, letterSpacing: '-0.5px' }}>{value}</p>
      <p style={{ margin: 0, fontSize: 11, color: '#9DC4AA' }}>{sub}</p>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '64px 0', color: '#9DC4AA' }}>
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none" style={{ margin: '0 auto 16px', display: 'block' }}>
        <circle cx="36" cy="36" r="34" fill="#F0FFF4" stroke="#D8F3DC" strokeWidth="2" />
        <path d="M24 36h24M24 43h16M24 29h24" stroke="#52B788" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="48" cy="28" r="5" fill="#D8F3DC" stroke="#52B788" strokeWidth="1.5" />
        <path d="M46 28l1.5 1.5L50 26" stroke="#52B788" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p style={{ fontWeight: 700, color: '#3A4A3E', margin: '0 0 4px', fontSize: 16 }}>Todo al día</p>
      <p style={{ fontSize: 13, margin: 0 }}>No hay pedidos en curso ahora mismo</p>
    </div>
  )
}

function OrderCard({ order, updating, onUpdateStatus }: {
  order: Order
  updating: boolean
  onUpdateStatus: (id: string, status: OrderStatus) => void
}) {
  const currentIdx = STATUS_FLOW.indexOf(order.status as OrderStatus)
  const nextStatus = currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null
  const isWA = order.channel === 'whatsapp'
  const isCancellable = order.status !== 'entregado' && order.status !== 'cancelado'
  const [confirming, setConfirming] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const items = order.items as { product_name: string; qty: number; unit: string; unit_price: number; unit_qty?: number }[]
  const extraCount = items.length - 3

  function handleCancelClick() {
    if (!confirming) { setConfirming(true); return }
    onUpdateStatus(order.id, 'cancelado')
    setConfirming(false)
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #E8F1E9',
      padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.05)',
    }}>
      {/* Top row: ID + Total */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: '#1B2B1E' }}>
            #{order.id.slice(0, 8).toUpperCase()}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: '#9DC4AA' }}>
            {new Date(order.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
            {' · '}
            {isWA ? 'WhatsApp' : 'Web'}
          </p>
        </div>
        <p style={{ margin: 0, fontWeight: 800, fontSize: 20, color: '#1B2B1E', letterSpacing: '-0.5px', lineHeight: 1 }}>
          {formatPrice(order.total)}
        </p>
      </div>

      {/* Contact */}
      <p style={{ margin: '0 0 1px', fontSize: 12, fontWeight: 600, color: '#3A4A3E' }}>{order.phone}</p>
      <p style={{ margin: '0 0 10px', fontSize: 11, color: '#9DC4AA' }}>{order.address}, {order.commune}</p>

      {/* Items */}
      <div style={{ borderTop: '1px solid #F0F7F1', paddingTop: 8, marginBottom: 10 }}>
        {(showAll ? items : items.slice(0, 3)).map((item, i) => {
          const presentation = resolvePresentation({
            price: item.unit_price,
            price_wholesale: null,
            unit: item.unit,
            unit_wholesale: null,
            unit_qty: item.unit_qty,
            unit_qty_wholesale: null,
          })
          return (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6B7A6F', lineHeight: 1.7, gap: 8 }}>
            <span>{item.product_name} × {item.qty} {presentation.label}</span>
            <span style={{ whiteSpace: 'nowrap' }}>{formatPrice(item.unit_price * item.qty)}</span>
          </div>
          )
        })}

        {extraCount > 0 && (
          <button
            onClick={() => setShowAll(v => !v)}
            style={{
              margin: '6px 0 0', padding: 0, background: 'none', border: 'none',
              color: '#2D6A4F', fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {showAll ? '▲ Ver menos' : `▼ Ver ${extraCount} producto${extraCount !== 1 ? 's' : ''} más`}
          </button>
        )}

        {/* Detalle completo al expandir: nota + estado de pago */}
        {showAll && (
          <div style={{
            marginTop: 8, paddingTop: 8, borderTop: '1px dashed #E8F1E9',
            fontSize: 11, color: '#6B7A6F', lineHeight: 1.7,
          }}>
            {order.notes && (
              <p style={{ margin: '0 0 2px' }}>📝 <strong>Nota:</strong> {order.notes}</p>
            )}
            <p style={{ margin: 0 }}>
              💳 <strong>Pago:</strong>{' '}
              {order.payment_method === 'transfer' ? 'Transferencia'
                : order.payment_method === 'webpay' ? 'Webpay' : '—'}
              {' · '}
              {order.payment_status === 'pagado' ? '✅ Pagado'
                : order.payment_status === 'fallido' ? '❌ Fallido' : '⏳ Pendiente'}
            </p>
          </div>
        )}
      </div>

      {/* CTA principal */}
      {nextStatus && (
        <button
          onClick={() => onUpdateStatus(order.id, nextStatus)}
          disabled={updating}
          style={{
            width: '100%', padding: '9px', borderRadius: 8, border: 0,
            background: STATUS_COLORS[nextStatus], color: '#fff',
            fontWeight: 600, fontSize: 12, cursor: updating ? 'default' : 'pointer',
            opacity: updating ? .6 : 1,
          }}
        >
          {updating ? '...' : `Mover a ${STATUS_LABELS[nextStatus]}`}
        </button>
      )}

      {/* Cancelar pedido */}
      {isCancellable && (
        confirming ? (
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button
              onClick={handleCancelClick}
              disabled={updating}
              style={{
                flex: 1, padding: '8px', borderRadius: 8,
                border: 'none', background: '#EF4444', color: '#fff',
                fontWeight: 700, fontSize: 12, cursor: 'pointer',
                opacity: updating ? .6 : 1,
              }}
            >
              {updating ? '...' : '✓ Sí, cancelar'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              style={{
                padding: '8px 12px', borderRadius: 8,
                border: '1px solid #E5E7EB', background: '#F9FAFB',
                color: '#6B7280', fontWeight: 600, fontSize: 12, cursor: 'pointer',
              }}
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={handleCancelClick}
            disabled={updating}
            style={{
              width: '100%', marginTop: 6, padding: '7px', borderRadius: 8,
              border: '1px solid #FECACA', background: 'transparent',
              color: '#EF4444', fontWeight: 600, fontSize: 11,
              cursor: 'pointer', opacity: updating ? .5 : 1,
            }}
          >
            Cancelar pedido
          </button>
        )
      )}
    </div>
  )
}
