/**
 * notify.ts — Módulo centralizado de notificaciones WhatsApp (CallMeBot)
 *
 * Todos los mensajes que el sistema envía a Celso pasan por aquí.
 * Cada función construye el texto, lo encodea y llama a CallMeBot.
 * Los errores nunca bloquean el flujo principal (try/catch interno).
 */

const TIMEOUT_MS = 6_000

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

async function sendWhatsApp(message: string): Promise<void> {
  const apiKey  = process.env.CALLMEBOT_API_KEY
  const waPhone = process.env.NEXT_PUBLIC_WA_NUMBER
  if (!apiKey || !waPhone) {
    console.log('[notify] CallMeBot no configurado. Mensaje omitido:\n', message)
    return
  }
  const url = `https://api.callmebot.com/whatsapp.php?phone=${waPhone}&text=${encodeURIComponent(message)}&apikey=${apiKey}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    await fetch(url, { signal: controller.signal })
  } catch {
    // No crítico — la operación original ya fue exitosa
  } finally {
    clearTimeout(timer)
  }
}

function itemLines(items: OrderRow['items']): string {
  const MAX = 4
  const lines = items
    .slice(0, MAX)
    .map(i => `• ${i.product_name} ×${i.qty} ${i.unit}`)
    .join('\n')
  const extra = items.length > MAX ? `\n+${items.length - MAX} producto${items.length - MAX > 1 ? 's' : ''} más` : ''
  return lines + extra
}

// ─── 1. Nuevo pedido por TRANSFERENCIA ───────────────────────────────────────

export async function notifyPedidoTransferencia(order: OrderRow): Promise<void> {
  const msg = [
    `🥦 PEDIDO — TRANSFERENCIA`,
    `#${order.id.slice(0, 8).toUpperCase()}`,
    ``,
    `💰 $${order.total.toLocaleString('es-CL')}`,
    `📱 ${order.phone}`,
    `📍 ${order.commune} — ${order.address}`,
    ``,
    `⚠️ Confirmar comprobante antes de preparar`,
    ``,
    itemLines(order.items),
  ].join('\n')

  await sendWhatsApp(msg)
}

// ─── 2. Nuevo pedido por WEBPAY (pago aprobado) ──────────────────────────────

export async function notifyPedidoWebpay(order: OrderRow): Promise<void> {
  const msg = [
    `✅ PEDIDO PAGADO — WEBPAY`,
    `#${order.id.slice(0, 8).toUpperCase()}`,
    ``,
    `💰 $${order.total.toLocaleString('es-CL')}`,
    `📱 ${order.phone}`,
    `📍 ${order.commune} — ${order.address}`,
    ``,
    itemLines(order.items),
  ].join('\n')

  await sendWhatsApp(msg)
}

// ─── 3. Nueva solicitud de registro MAYORISTA ────────────────────────────────

export async function notifyRegistroMayorista(data: {
  name:  string
  email: string
  phone: string
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.el-menu.cl'

  const msg = [
    `🏢 NUEVA SOLICITUD MAYORISTA`,
    ``,
    `👤 ${data.name}`,
    `📧 ${data.email}`,
    `📱 ${data.phone || 'No indicó'}`,
    ``,
    `→ Aprobar o rechazar:`,
    `${appUrl}/admin`,
  ].join('\n')

  await sendWhatsApp(msg)
}

// ─── 4. Mayorista APROBADO (aviso a Celso para confirmar al cliente) ─────────

export async function notifyMayoristaAprobado(data: {
  name:  string
  email: string
}): Promise<void> {
  const msg = [
    `✅ MAYORISTA APROBADO`,
    ``,
    `👤 ${data.name}`,
    `📧 ${data.email}`,
    ``,
    `Ya tiene acceso a precios mayoristas.`,
    `Recuerda avisarle por WhatsApp o email.`,
  ].join('\n')

  await sendWhatsApp(msg)
}

// ─── 5. Alerta de STOCK BAJO ─────────────────────────────────────────────────
// Se llama después de un pedido cuando algún producto queda con poco stock.

export async function notifyStockBajo(items: StockItem[]): Promise<void> {
  if (items.length === 0) return

  const lines = items
    .map(i => `• ${i.name}: ${i.stock} ${i.unit} restante${i.stock !== 1 ? 's' : ''}`)
    .join('\n')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.el-menu.cl'

  const msg = [
    `⚠️ STOCK BAJO — El Menú`,
    ``,
    `Los siguientes productos quedaron con poco stock:`,
    ``,
    lines,
    ``,
    `→ Actualizar en ${appUrl}/admin/productos`,
  ].join('\n')

  await sendWhatsApp(msg)
}
