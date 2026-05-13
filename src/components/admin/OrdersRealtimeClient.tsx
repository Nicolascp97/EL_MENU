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

const STATUS_FLOW: OrderStatus[] = ['nuevo', 'preparando', 'listo', 'en_camino', 'entregado']

type Props = { initialOrders: Order[] }

export default function OrdersRealtimeClient({ initialOrders }: Props) {
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [updating, setUpdating] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
        if (payload.eventType === 'INSERT') {
          setOrders(prev => [payload.new as Order, ...prev])
          // Browser notification si el tab está en foco
          if (Notification.permission === 'granted') {
            new Notification('🛒 Nuevo pedido en El Menú!', {
              body: `Pedido de ${(payload.new as Order).phone} — ${formatPrice((payload.new as Order).total)}`,
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

  function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }

  const active = orders.filter(o => o.status !== 'entregado' && o.status !== 'cancelado')
  const done = orders.filter(o => o.status === 'entregado' || o.status === 'cancelado')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--green-dark)', fontFamily: 'var(--font-fraunces)' }}>
            Pedidos activos
          </h1>
          <p className="text-sm text-gray-500">{active.length} pedido{active.length !== 1 ? 's' : ''} en curso</p>
        </div>
        <button
          onClick={requestNotificationPermission}
          className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          🔔 Activar notificaciones
        </button>
      </div>

      {active.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-2">✅</p>
          <p>No hay pedidos pendientes</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {active.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              updating={updating === order.id}
              onUpdateStatus={updateStatus}
            />
          ))}
        </div>
      )}

      {done.length > 0 && (
        <details className="mt-8">
          <summary className="text-sm font-medium text-gray-500 cursor-pointer hover:text-gray-700 mb-3">
            Pedidos completados hoy ({done.length})
          </summary>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {done.map(order => (
              <OrderCard key={order.id} order={order} updating={false} onUpdateStatus={updateStatus} />
            ))}
          </div>
        </details>
      )}
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
  const isWhatsApp = order.channel === 'whatsapp'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-sm text-gray-900">#{order.id.slice(0, 8).toUpperCase()}</p>
          <p className="text-xs text-gray-500">
            {new Date(order.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
            {' · '}
            {isWhatsApp ? '📱 WhatsApp' : '🌐 Web'}
          </p>
        </div>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full text-white shrink-0"
          style={{ backgroundColor: STATUS_COLORS[order.status as OrderStatus] || '#999' }}
        >
          {STATUS_LABELS[order.status as OrderStatus] || order.status}
        </span>
      </div>

      <div className="text-sm space-y-0.5">
        <p className="font-medium text-gray-800">{order.phone}</p>
        <p className="text-gray-500 text-xs">{order.address}, {order.commune}</p>
      </div>

      <div className="space-y-1 text-xs text-gray-600">
        {(order.items as { product_name: string; qty: number; unit: string; unit_price: number }[]).map((item, i) => (
          <div key={i} className="flex justify-between">
            <span>{item.product_name} × {item.qty} {item.unit}</span>
            <span>{formatPrice(item.unit_price * item.qty)}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-gray-50">
        <p className="font-bold text-sm" style={{ color: 'var(--green-dark)' }}>
          {formatPrice(order.total)}
        </p>
        {nextStatus && (
          <button
            onClick={() => onUpdateStatus(order.id, nextStatus)}
            disabled={updating}
            className="text-xs font-medium px-3 py-1.5 rounded-full text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: STATUS_COLORS[nextStatus] }}
          >
            {updating ? '...' : `→ ${STATUS_LABELS[nextStatus]}`}
          </button>
        )}
      </div>
    </div>
  )
}
