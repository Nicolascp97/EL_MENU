import Link from 'next/link'
import { CheckCircle2, XCircle, AlertCircle, Phone, Banknote } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPrice } from '@/lib/utils'
import Navbar from '@/components/catalog/Navbar'
import type { Order } from '@/types/database'

export const dynamic = 'force-dynamic'

type SP = Promise<{ status?: string; orderId?: string }>

export default async function ConfirmacionPage({ searchParams }: { searchParams: SP }) {
  const params = await searchParams
  const status = params.status ?? 'error'
  const orderId = params.orderId

  let order: Order | null = null
  if (orderId) {
    const admin = createAdminClient()
    const { data } = await admin.from('orders').select('*').eq('id', orderId).single<Order>()
    order = data
  }

  const isSuccess   = status === 'success'
  const isCancelled = status === 'cancelled'
  const isTransfer  = status === 'transfer'

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <div className="text-center">
            {isSuccess ? (
              <CheckCircle2 className="mx-auto text-emerald-600" size={72} strokeWidth={1.5} />
            ) : isTransfer ? (
              <Banknote className="mx-auto" size={72} strokeWidth={1.5} style={{ color: '#E8621A' }} />
            ) : isCancelled ? (
              <AlertCircle className="mx-auto text-amber-500" size={72} strokeWidth={1.5} />
            ) : (
              <XCircle className="mx-auto text-rose-600" size={72} strokeWidth={1.5} />
            )}
            <h1 className="text-2xl md:text-3xl font-bold mt-4" style={{ fontFamily: 'var(--font-fraunces)' }}>
              {isSuccess  && '¡Pedido confirmado!'}
              {isTransfer && '¡Pedido recibido!'}
              {isCancelled && 'Pago cancelado'}
              {!isSuccess && !isTransfer && !isCancelled && 'No pudimos procesar el pago'}
            </h1>
            <p className="text-gray-600 mt-2 text-sm">
              {isSuccess  && 'Recibimos tu pedido y lo estamos preparando. Te avisamos por WhatsApp cuando salga el despacho.'}
              {isTransfer && 'Ya estamos esperando tu transferencia. Envía el comprobante por WhatsApp para confirmar el despacho.'}
              {isCancelled && 'No se cobró nada. Podés volver al catálogo y reintentar cuando quieras.'}
              {!isSuccess && !isTransfer && !isCancelled && 'No te cobraron nada. Probá de nuevo o contactanos si el problema persiste.'}
            </p>
          </div>

          {order && (
            <div className="mt-6 bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Número</span><span className="font-mono font-semibold">#{order.id.slice(0, 8)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-semibold tabular-nums">{formatPrice(order.total)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Productos</span><span>{order.items.length}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Despacho a</span><span className="text-right max-w-[60%]">{order.address}, {order.commune}</span></div>
              {isTransfer && (
                <div className="flex justify-between pt-1 border-t border-gray-200">
                  <span className="text-gray-500">Método</span>
                  <span className="font-semibold" style={{ color: '#E8621A' }}>Transferencia bancaria</span>
                </div>
              )}
            </div>
          )}

          {/* Instrucciones de transferencia */}
          {isTransfer && (
            <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm space-y-2">
              <p className="font-semibold text-orange-900">¿Cómo confirmar tu pedido?</p>
              <ol className="list-decimal list-inside space-y-1 text-gray-700">
                <li>Realiza la transferencia por el monto indicado arriba.</li>
                <li>Toma una foto o captura del comprobante.</li>
                <li>Envíala por WhatsApp al <strong>+56 9 5495 2395</strong>.</li>
              </ol>
              <p className="text-gray-500 text-xs">Tu pedido se prepara y despacha una vez confirmado el pago.</p>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-2">
            {isSuccess && order && (
              <Link
                href={`/pedido/${order.id}`}
                className="block w-full text-center px-4 py-3 rounded-full text-white text-sm font-semibold"
                style={{ background: '#1B2B1E' }}
              >
                Ver detalle del pedido
              </Link>
            )}

            {isTransfer && (
              <a
                href={`https://wa.me/56954952395?text=${encodeURIComponent(`Hola! Realicé el pedido #${order?.id?.slice(0, 8).toUpperCase() ?? ''} y adjunto el comprobante de transferencia.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-full text-sm font-semibold text-white"
                style={{ background: '#E8621A' }}
              >
                <Phone size={14} /> Enviar comprobante por WhatsApp
              </a>
            )}

            <Link
              href="/catalogo"
              className={`block w-full text-center px-4 py-3 rounded-full text-sm font-semibold ${
                (isSuccess && order) || isTransfer
                  ? 'border border-gray-300 text-gray-800 hover:bg-gray-50'
                  : 'text-white'
              }`}
              style={(isSuccess && order) || isTransfer ? undefined : { background: '#1B2B1E' }}
            >
              {isSuccess || isTransfer ? 'Seguir comprando' : 'Volver al catálogo'}
            </Link>

            {!isSuccess && !isTransfer && (
              <a
                href="https://wa.me/56954952395?text=Hola!%20Tuve%20un%20problema%20con%20el%20pago"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-full text-sm font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100"
              >
                <Phone size={14} /> Avisarnos por WhatsApp
              </a>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
