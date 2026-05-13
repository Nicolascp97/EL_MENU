import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Phone, Clock, MapPin, Package, CreditCard } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/catalog/Navbar'
import { formatPrice } from '@/lib/utils'
import type { Order } from '@/types/database'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

const STATUS_LABEL: Record<Order['status'], string> = {
  nuevo: 'Recibido',
  preparando: 'Preparando',
  listo: 'Listo para despacho',
  en_camino: 'En camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

const STATUS_TINT: Record<Order['status'], string> = {
  nuevo: 'bg-blue-50 text-blue-800 border-blue-200',
  preparando: 'bg-amber-50 text-amber-800 border-amber-200',
  listo: 'bg-violet-50 text-violet-800 border-violet-200',
  en_camino: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  entregado: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  cancelado: 'bg-rose-50 text-rose-800 border-rose-200',
}

const PAYMENT_LABEL: Record<Order['payment_status'], string> = {
  pendiente: 'Pago pendiente',
  pagado: 'Pagado',
  fallido: 'Pago fallido',
}

export default async function PedidoPage({ params }: { params: Params }) {
  const { id } = await params

  // Validar acceso:
  // - Si el order es de un user (user_id no null), solo el dueño o admin pueden verlo.
  // - Si es de un guest (user_id null), cualquiera con la URL puede verlo (es razonable
  //   porque la URL contiene el UUID — vínculo de un solo uso desde la confirmación).
  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select('*')
    .eq('id', id)
    .maybeSingle<Order>()

  if (!order) notFound()

  if (order.user_id) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      // No logueado y el pedido tiene dueño → bloquear
      notFound()
    }
    if (user.id !== order.user_id) {
      // Distinto user → permitir solo si admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (profile?.role !== 'admin') notFound()
    }
  }

  const created = new Date(order.created_at).toLocaleString('es-CL', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Pedido</p>
            <h1 className="text-2xl font-bold font-mono text-gray-900">#{order.id.slice(0, 8)}</h1>
            <p className="text-sm text-gray-500 mt-1">{created}</p>
          </div>
          <span className={`text-[11px] font-bold uppercase tracking-wide rounded-full px-3 py-1 border ${STATUS_TINT[order.status]}`}>
            {STATUS_LABEL[order.status]}
          </span>
        </header>

        {/* Items */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Package size={16} className="text-gray-500" />
            <h2 className="font-semibold text-gray-900">Productos</h2>
          </div>
          <ul className="divide-y divide-gray-100">
            {order.items.map((it, i) => (
              <li key={i} className="px-5 py-3 flex justify-between items-baseline gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-gray-900 truncate">{it.product_name}</p>
                  <p className="text-xs text-gray-500">
                    {it.qty} × {formatPrice(it.unit_price)} / {it.unit}
                  </p>
                </div>
                <p className="text-sm font-semibold text-gray-900 tabular-nums shrink-0">
                  {formatPrice(it.unit_price * it.qty)}
                </p>
              </li>
            ))}
          </ul>
          <div className="px-5 py-4 border-t border-gray-100 flex justify-between font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatPrice(order.total)}</span>
          </div>
        </section>

        {/* Info de entrega + pago */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoCard icon={<MapPin size={16} />} title="Despacho">
            <p className="text-sm text-gray-900">{order.address}</p>
            <p className="text-sm text-gray-500">{order.commune}</p>
          </InfoCard>
          <InfoCard icon={<Phone size={16} />} title="Contacto">
            <p className="text-sm text-gray-900">{order.phone}</p>
            {order.notes && <p className="text-xs text-gray-500 mt-1">Notas: {order.notes}</p>}
          </InfoCard>
          <InfoCard icon={<CreditCard size={16} />} title="Pago">
            <p className="text-sm text-gray-900">{PAYMENT_LABEL[order.payment_status]}</p>
            <p className="text-xs text-gray-500">vía Webpay Transbank</p>
          </InfoCard>
          <InfoCard icon={<Clock size={16} />} title="Canal">
            <p className="text-sm text-gray-900 capitalize">{order.channel}</p>
          </InfoCard>
        </section>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Link
            href="/catalogo"
            className="flex-1 text-center px-4 py-3 rounded-full text-white text-sm font-semibold"
            style={{ background: '#1B2B1E' }}
          >
            Seguir comprando
          </Link>
          <a
            href={`https://wa.me/56954952395?text=Hola!%20Consulta%20por%20pedido%20%23${order.id.slice(0, 8)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center inline-flex items-center justify-center gap-2 px-4 py-3 rounded-full text-sm font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100"
          >
            <Phone size={14} /> Consultar por WhatsApp
          </a>
        </div>
      </main>
    </div>
  )
}

function InfoCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-wide">
        {icon}
        <span>{title}</span>
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}
