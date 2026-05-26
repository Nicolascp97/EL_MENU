/**
 * notify.ts — Módulo centralizado de notificaciones Telegram
 *
 * Todos los mensajes que el sistema envía a Celso pasan por aquí.
 * Usa la Telegram Bot API (más confiable que CallMeBot/WhatsApp).
 *
 * Variables de entorno requeridas:
 *   TELEGRAM_BOT_TOKEN  → token del bot (BotFather)
 *   TELEGRAM_CHAT_ID    → chat_id del dueño del bot (se obtiene tras enviar un mensaje)
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

async function sendTelegram(message: string): Promise<void> {
  const token  = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) {
    console.log('[notify] Telegram no configurado. Mensaje omitido:\n', message)
    return
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: chatId, text: message }),
      signal:  controller.signal,
    })
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

  await sendTelegram(msg)
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

  await sendTelegram(msg)
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

  await sendTelegram(msg)
}

// ─── 4. Mayorista APROBADO ────────────────────────────────────────────────────

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

  await sendTelegram(msg)
}

// ─── 5. Alerta de STOCK BAJO ─────────────────────────────────────────────────

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

  await sendTelegram(msg)
}
