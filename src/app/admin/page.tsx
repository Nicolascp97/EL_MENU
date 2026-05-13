import { createClient } from '@/lib/supabase/server'
import OrdersRealtimeClient from '@/components/admin/OrdersRealtimeClient'
import type { Order } from '@/types/database'

export const dynamic = 'force-dynamic'

async function getOrders(): Promise<Order[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('orders')
    .select('*')
    .not('status', 'eq', 'entregado')
    .not('status', 'eq', 'cancelado')
    .order('created_at', { ascending: false })
    .limit(50)
  return (data as Order[]) || []
}

export default async function AdminOrdersPage() {
  const orders = await getOrders()
  return <OrdersRealtimeClient initialOrders={orders} />
}
