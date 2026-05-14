import { createClient } from '@/lib/supabase/server'
import OrdersRealtimeClient from '@/components/admin/OrdersRealtimeClient'
import type { Order } from '@/types/database'

export const dynamic = 'force-dynamic'

async function getOrders(): Promise<Order[]> {
  const supabase = await createClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayISO = today.toISOString()

  const [{ data: active }, { data: todayDone }] = await Promise.all([
    supabase
      .from('orders').select('*')
      .not('status', 'eq', 'entregado').not('status', 'eq', 'cancelado')
      .order('created_at', { ascending: false }).limit(50),
    supabase
      .from('orders').select('*')
      .gte('created_at', todayISO)
      .in('status', ['entregado', 'cancelado'])
      .order('created_at', { ascending: false }),
  ])

  return [
    ...(active as Order[] ?? []),
    ...(todayDone as Order[] ?? []),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export default async function AdminOrdersPage() {
  const orders = await getOrders()
  return <OrdersRealtimeClient initialOrders={orders} />
}
