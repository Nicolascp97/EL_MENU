/**
 * notify.ts — Módulo centralizado de notificaciones al dueño
 *
 * Todos los avisos que el sistema manda al negocio pasan por aquí.
 * Hace POST a un workflow de n8n, que formatea el mensaje y lo envía por
 * WhatsApp (YCloud) al número del dueño.
 *
 * Variables de entorno requeridas:
 *   N8N_WEBHOOK_BASE_URL  → base del webhook n8n (ej: https://xxx.app.n8n.cloud/webhook)
 *   N8N_WEBHOOK_SECRET    → secreto que valida el nodo "Validar Secret" del workflow
 */

const TIMEOUT_MS = 6_000
const WEBHOOK_PATH = 'elmenu-notificaciones'

type OrderRow = {
  id:      string
  total:   number
  phone:   string
  commune: string
  address: string
  items:   { product_name: string; qty: number; unit: string }[]
}

type StockItem = {
  name:  string
  stock: number
  unit:  string
}

// ─── Core ────────────────────────────────────────────────────────────────────

async function sendToN8n(event: string, data: Record<string, unknown>): Promise<void> {
  const base   = process.env.N8N_WEBHOOK_BASE_URL
  const secret = process.env.N8N_WEBHOOK_SECRET
  if (!base || !secret) {
    console.log(`[notify] n8n no configurado. Evento omitido: ${event}`, data)
    return
  }
  const url = `${base.replace(/\/$/, '')}/${WEBHOOK_PATH}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-webhook-secret': secret,
      },
      body:   JSON.stringify({ event, ...data }),
      signal: controller.signal,
    })
  } catch {
    // No crítico — la operación original ya fue exitosa
  } finally {
    clearTimeout(timer)
  }
}

/** Formatea los ítems del pedido en texto multilínea, un producto por línea. */
function formatItems(items: OrderRow['items']): string {
  return items
    .map(i => `• ${i.product_name} ×${i.qty} ${i.unit}`)
    .join('\n')
}

const shortId = (id: string) => id.slice(0, 8).toUpperCase()
const clp     = (n: number) => n.toLocaleString('es-CL')

// ─── 1. Nuevo pedido por TRANSFERENCIA ───────────────────────────────────────

export async function notifyPedidoTransferencia(order: OrderRow): Promise<void> {
  await sendToN8n('pedido_transferencia', {
    id:      shortId(order.id),
    total:   clp(order.total),
    phone:   order.phone,
    commune: order.commune,
    address: order.address,
    items:   formatItems(order.items),
  })
}

// ─── 2. Nuevo pedido por WEBPAY (pago aprobado) ──────────────────────────────

export async function notifyPedidoWebpay(order: OrderRow): Promise<void> {
  await sendToN8n('pedido_webpay', {
    id:      shortId(order.id),
    total:   clp(order.total),
    phone:   order.phone,
    commune: order.commune,
    address: order.address,
    items:   formatItems(order.items),
  })
}

// ─── 3. Nueva solicitud de registro MAYORISTA ────────────────────────────────

export async function notifyRegistroMayorista(data: {
  name:  string
  email: string
  phone: string
}): Promise<void> {
  await sendToN8n('registro_mayorista', {
    name:  data.name,
    email: data.email,
    phone: data.phone || 'No indicó',
  })
}

// ─── 4. Mayorista APROBADO ────────────────────────────────────────────────────

export async function notifyMayoristaAprobado(data: {
  name:  string
  email: string
}): Promise<void> {
  await sendToN8n('mayorista_aprobado', {
    name:  data.name,
    email: data.email,
  })
}

// ─── 5. Alerta de STOCK BAJO ─────────────────────────────────────────────────

export async function notifyStockBajo(items: StockItem[]): Promise<void> {
  if (items.length === 0) return
  await sendToN8n('stock_bajo', {
    items: items
      .map(i => `• ${i.name}: ${i.stock} ${i.unit} restante${i.stock !== 1 ? 's' : ''}`)
      .join('\n'),
  })
}
