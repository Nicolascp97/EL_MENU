'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Order, OrderStatus } from '@/types/database'
import { formatPrice } from '@/lib/utils'

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
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [updating, setUpdating] = useState<string | null>(null)
  const [notifState, setNotifState] = useState<NotificationPermission>('default')
  const supabase = createClient()

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
        {(order.items as { product_name: string; qty: number; unit: string; unit_price: number }[]).slice(0, 3).map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6B7A6F', lineHeight: 1.7 }}>
            <span>{item.product_name} × {item.qty} {item.unit}</span>
            <span>{formatPrice(item.unit_price * item.qty)}</span>
          </div>
        ))}
        {(order.items as unknown[]).length > 3 && (
          <p style={{ margin: 0, fontSize: 11, color: '#9DC4AA' }}>
            +{(order.items as unknown[]).length - 3} producto{(order.items as unknown[]).length - 3 !== 1 ? 's' : ''} más
          </p>
        )}
      </div>

      {/* CTA */}
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
    </div>
  )
}
