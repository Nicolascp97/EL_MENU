import Link from 'next/link'
import { CheckCircle2, XCircle, AlertCircle, Phone, Banknote } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPrice } from '@/lib/utils'
import Navbar from '@/components/catalog/Navbar'
import type { Order } from '@/types/database'
import ConfirmarPedidoWhatsAppButton from './ConfirmarPedidoWhatsAppButton'
import ClearCartOnConfirm from './ClearCartOnConfirm'
import TransferReminderPopup from './TransferReminderPopup'

export const dynamic = 'force-dynamic'

type SP = Promise<{ status?: string; orderId?: string }>

/** Traduce el código de tipo de pago de Transbank a texto legible. */
function traducirTipoPago(code: string | null | undefined): string {
  switch (code) {
    case 'VD': return 'Débito / Redcompra'
    case 'VN': return 'Crédito — Sin cuotas'
    case 'VC': return 'Crédito — Con cuotas'
    case 'S2': return 'Crédito — 2 cuotas sin interés'
    case 'SI': return 'Crédito — Sin interés'
    case 'NC': return 'Crédito — N cuotas sin interés'
    case 'P':  return 'Prepago'
    default:   return code ?? '—'
  }
}

function formatFecha(isoString: string | null | undefined): string {
  if (!isoString) return '—'
  try {
    return new Date(isoString).toLocaleString('es-CL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Santiago',
    })
  } catch {
    return isoString
  }
}

export default async function ConfirmacionPage({ searchParams }: { searchParams: SP }) {
  const params   = await searchParams
  const status   = params.status ?? 'error'
  const orderId  = params.orderId

  // Extendemos el tipo con los campos Transbank opcionales y los campos que
  // existen en la tabla pero no están en el tipo `Order` (name, customer_type).
  type OrderWithTbk = Order & {
    name?: string | null
    customer_type?: 'minorista' | 'mayorista' | null
    transbank_authorization_code?: string | null
    transbank_card_last4?: string | null
    transbank_payment_type?: string | null
    transbank_installments?: number | null
    transbank_transaction_date?: string | null
  }

  let order: OrderWithTbk | null = null
  if (orderId) {
    const admin = createAdminClient()
    const { data } = await admin.from('orders').select('*').eq('id', orderId).single<OrderWithTbk>()
    order = data
  }

  const isSuccess   = status === 'success'
  const isCancelled = status === 'cancelled'
  const isTransfer  = status === 'transfer'

  // ¿Tiene datos de comprobante Transbank completos?
  const hasReceipt = isSuccess && order?.transbank_authorization_code

  return (
    <div className="min-h-screen bg-gray-50">
      <ClearCartOnConfirm status={status} />
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">

          {/* ── Ícono + título ── */}
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
              {isSuccess   && '¡Pago aprobado! Falta 1 paso'}
              {isTransfer  && '¡Pedido recibido!'}
              {isCancelled && 'Pago cancelado'}
              {!isSuccess && !isTransfer && !isCancelled && 'No pudimos procesar el pago'}
            </h1>
            <p className="text-gray-600 mt-2 text-sm">
              {isSuccess   && 'Para que el restaurante reciba tu pedido, toca el botón de WhatsApp de abajo.'}
              {isTransfer  && 'Ya estamos esperando tu transferencia. Envía el comprobante por WhatsApp para confirmar el despacho.'}
              {isCancelled && 'No se cobró nada. Podés volver al catálogo y reintentar cuando quieras.'}
              {!isSuccess && !isTransfer && !isCancelled && 'No te cobraron nada. Probá de nuevo o contáctanos si el problema persiste.'}
            </p>
          </div>

          {/* ── Resumen del pedido ── */}
          {order && (
            <div className="mt-6 bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Resumen del pedido
              </p>
              <div className="flex justify-between">
                <span className="text-gray-500">N° de orden</span>
                <span className="font-mono font-semibold">#{order.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total</span>
                <span className="font-semibold tabular-nums">{formatPrice(order.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Productos</span>
                <span>{order.items.length} ítem{order.items.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Despacho a</span>
                <span className="text-right max-w-[60%]">{order.address}, {order.commune}</span>
              </div>
              {isTransfer && (
                <div className="flex justify-between pt-1 border-t border-gray-200">
                  <span className="text-gray-500">Método</span>
                  <span className="font-semibold" style={{ color: '#E8621A' }}>Transferencia bancaria</span>
                </div>
              )}
            </div>
          )}

          {/* ── Botón naranjo: confirmar pedido por WhatsApp del cliente ── */}
          {order && (isSuccess || isTransfer) && (
            <ConfirmarPedidoWhatsAppButton
              order={{
                id:             order.id,
                total:          order.total,
                address:        `${order.address}, ${order.commune}`,
                name:           order.name,
                customer_type:  order.customer_type,
                payment_method: order.payment_method,
                items:          order.items,
              }}
            />
          )}

          {/* ── Comprobante Transbank (requerido por Transbank para validación) ── */}
          {hasReceipt && order && (
            <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2 text-sm">
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-3">
                Comprobante de pago Webpay
              </p>
              <div className="flex justify-between">
                <span className="text-gray-500">Código autorización</span>
                <span className="font-mono font-bold text-emerald-800">
                  {order.transbank_authorization_code}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Fecha y hora</span>
                <span>{formatFecha(order.transbank_transaction_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tipo de pago</span>
                <span>{traducirTipoPago(order.transbank_payment_type)}</span>
              </div>
              {order.transbank_installments != null && order.transbank_installments > 1 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Cuotas</span>
                  <span>{order.transbank_installments}</span>
                </div>
              )}
              {order.transbank_card_last4 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Tarjeta</span>
                  <span className="font-mono">**** **** **** {order.transbank_card_last4}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-emerald-200 pt-2 mt-1">
                <span className="text-gray-500">Monto cobrado</span>
                <span className="font-bold text-emerald-800">{formatPrice(order.total)}</span>
              </div>
            </div>
          )}

          {/* ── Instrucciones de transferencia ── */}
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

          {/* ── Popup recordatorio transferencia (aparece a los 3s) ── */}
          {isTransfer && order && (
            <TransferReminderPopup
              order={{
                id:             order.id,
                total:          order.total,
                address:        `${order.address}, ${order.commune}`,
                name:           order.name,
                customer_type:  order.customer_type,
                payment_method: order.payment_method,
                items:          order.items,
              }}
              waNumber={process.env.NEXT_PUBLIC_WA_NUMBER ?? '56954952395'}
            />
          )}

          {/* ── Botones de acción ── */}
          <div className="mt-6 flex flex-col gap-2">
            {/* botón "Enviar comprobante" eliminado — reemplazado por el popup automático */}

            <Link
              href="/catalogo"
              className={`block w-full text-center px-4 py-3 rounded-full text-sm font-semibold ${
                isSuccess || isTransfer
                  ? 'border border-gray-300 text-gray-800 hover:bg-gray-50'
                  : 'text-white'
              }`}
              style={isSuccess || isTransfer ? undefined : { background: '#1B2B1E' }}
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
