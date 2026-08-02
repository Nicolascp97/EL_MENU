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

import { clp, shortId, catalogUrl, formatItems } from './orderMessage'

const TIMEOUT_MS = 7_000
const WEBHOOK_PATH = 'elmenu-notificaciones'
/** Intentos totales por aviso. n8n cloud a veces tarda en despertar el workflow
 *  y devuelve 5xx o corta la conexión en el primer POST. */
const MAX_ATTEMPTS = 3
/** Espera antes del intento 2 y del 3. Peor caso total: 3×7s + 3s ≈ 24s,
 *  por eso las rutas que notifican declaran `maxDuration = 30`. */
const BACKOFF_MS = [1_000, 2_000]

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

type OrderRow = {
  id:            string
  total:         number
  phone:         string
  commune:       string
  address:       string
  name?:         string | null
  customer_type?: 'minorista' | 'mayorista' | null
  items:         { product_name: string; qty: number; unit: string; unit_price: number; unit_qty?: number | null }[]
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
    // Antes esto era console.log y pasaba desapercibido. Ahora es error visible:
    // si falta la config, NINGÚN aviso se manda y hay que enterarse.
    console.error(
      `[notify] n8n NO configurado (falta N8N_WEBHOOK_BASE_URL o N8N_WEBHOOK_SECRET). ` +
      `Aviso PERDIDO para evento "${event}".`,
      data,
    )
    return
  }
  const url = `${base.replace(/\/$/, '')}/${WEBHOOK_PATH}`
  const body = JSON.stringify({ event, ...data })

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: {
          'Content-Type':    'application/json',
          'x-webhook-secret': secret,
        },
        body,
        signal: controller.signal,
      })
      if (res.ok) {
        console.log(`[notify] aviso "${event}" enviado a n8n OK (${res.status}, intento ${attempt}).`)
        return
      }
      // n8n respondió pero con error (workflow inactivo, secreto malo, 4xx/5xx).
      // Los 4xx no se arreglan reintentando: se aborta de inmediato.
      const text = await res.text().catch(() => '')
      const fatal = res.status >= 400 && res.status < 500
      console.error(
        `[notify] n8n respondió ${res.status} para evento "${event}" (intento ${attempt}/${MAX_ATTEMPTS}).` +
        (fatal ? ' Error de configuración, no se reintenta.' : ''),
        { url, status: res.status, body: text.slice(0, 500) },
      )
      if (fatal) return
    } catch (err) {
      // Timeout o error de red: típicamente n8n dormido, caído o suspendido.
      const reason = err instanceof Error && err.name === 'AbortError'
        ? `timeout tras ${TIMEOUT_MS}ms (n8n no respondió)`
        : (err instanceof Error ? err.message : String(err))
      console.error(
        `[notify] fallo enviando evento "${event}" a n8n (${reason}, intento ${attempt}/${MAX_ATTEMPTS}).`,
        { url },
      )
    } finally {
      clearTimeout(timer)
    }

    if (attempt < MAX_ATTEMPTS) await sleep(BACKOFF_MS[attempt - 1])
  }

  // Se agotaron los intentos. El pedido ya está guardado en la DB y visible en
  // /admin; lo único que se perdió es el aviso por WhatsApp.
  console.error(
    `[notify] AVISO PERDIDO: evento "${event}" no llegó a n8n tras ${MAX_ATTEMPTS} intentos.`,
    data,
  )
}

// ─── 1. Nuevo pedido por TRANSFERENCIA ───────────────────────────────────────

export async function notifyPedidoTransferencia(order: OrderRow): Promise<void> {
  await sendToN8n('pedido_transferencia', {
    id:            shortId(order.id),
    total:         clp(order.total),
    name:          order.name ?? 'Sin nombre',
    customer_type: order.customer_type ?? 'minorista',
    catalog_url:   catalogUrl(order.customer_type),
    phone:         order.phone,
    commune:       order.commune,
    address:       order.address,
    items:         formatItems(order.items),
  })
}

// ─── 2. Nuevo pedido por WEBPAY (pago aprobado) ──────────────────────────────

export async function notifyPedidoWebpay(order: OrderRow): Promise<void> {
  await sendToN8n('pedido_webpay', {
    id:            shortId(order.id),
    total:         clp(order.total),
    name:          order.name ?? 'Sin nombre',
    customer_type: order.customer_type ?? 'minorista',
    catalog_url:   catalogUrl(order.customer_type),
    phone:         order.phone,
    commune:       order.commune,
    address:       order.address,
    items:         formatItems(order.items),
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
