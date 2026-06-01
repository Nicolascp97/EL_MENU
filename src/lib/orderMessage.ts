/**
 * orderMessage.ts — Helpers compartidos para componer el mensaje del pedido.
 *
 * El mensaje pre-armado del botón "Confirmar pedido por WhatsApp" en la página
 * de confirmación y el payload que `notify.ts` envía a n8n leen desde acá, así
 * el formato queda sincronizado en ambos canales.
 */

export type OrderForMessage = {
  id:              string
  total:           number
  address:         string
  name?:           string | null
  customer_type?:  'minorista' | 'mayorista' | null
  payment_method?: 'webpay' | 'transfer' | null
  items:           { product_name: string; qty: number; unit: string; unit_price: number; unit_qty?: number | null }[]
}

/** Etiquetas legibles para el campo unit (lo que sale al cliente entre paréntesis). */
export const UNIT_LABELS: Record<string, string> = {
  kg:     'Kg',
  unid:   'Unidad',
  paq:    'Paquete',
  ramo:   'Ramo',
  bolsa:  'Bolsa',
  maceta: 'Maceta',
  caja:   'Caja',
  gr:     'gr',
}

/** Formatea la cantidad por unidad sin ceros decimales innecesarios:
 *  1 → "1", 250 → "250", 1.5 → "1.5". */
function formatUnitQty(n: number | null | undefined): string {
  const v = n == null ? 1 : Number(n)
  if (!Number.isFinite(v) || v <= 0) return '1'
  return Number.isInteger(v) ? String(v) : String(v).replace(/\.?0+$/, '')
}

/** Formato pedido por el cliente: 92,900  (coma como separador de miles). */
export const clp = (n: number) => n.toLocaleString('en-US')

export const shortId = (id: string) => id.slice(0, 8).toUpperCase()

/** URL del catálogo que delata si el pedido vino por mayorista o minorista. */
export function catalogUrl(customerType?: string | null): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.el-menu.cl').replace(/\/$/, '')
  return customerType === 'mayorista' ? `${base}/mayorista` : `${base}/catalogo`
}

/** Formato pedido por el cliente:  • 3 ALBAHACA (1 Paquete): CLP 3,000
 *  La presentación entre paréntesis usa unit_qty (cuánto va por unidad de
 *  venta) + unit. Ej: Aceituna retail → "(250 gr)", mayorista → "(1 Kg)". */
export function formatItems(items: OrderForMessage['items']): string {
  return items
    .map(i => {
      const label     = UNIT_LABELS[i.unit] ?? i.unit
      const qtyLabel  = formatUnitQty(i.unit_qty)
      const lineTotal = i.qty * i.unit_price
      return `• ${i.qty} ${i.product_name.toUpperCase()} (${qtyLabel} ${label}): CLP ${clp(lineTotal)}`
    })
    .join('\n')
}

/**
 * Mensaje pre-armado que el cliente envía al dueño desde su propio WhatsApp.
 * Debe quedar idéntico al que produce el workflow de n8n para
 * `pedido_transferencia` y `pedido_webpay`, así el dueño ve el mismo formato
 * en ambos canales.
 */
export function buildCustomerWhatsAppMessage(order: OrderForMessage): string {
  const pagoLine = order.payment_method === 'webpay'
    ? '• _Pago:_ *PAGADO*'
    : '• _Pago:_ PENDIENTE DE PAGO (comprobante)'

  return [
    'Hola, me gustaría comprar los siguientes productos:',
    '',
    formatItems(order.items),
    '',
    `*TOTAL:* CLP ${clp(order.total)}`,
    '',
    '',
    '*DATOS:*',
    '',
    `• _Nombre:_ ${order.name?.trim() || 'Sin nombre'}`,
    `• _Dirección:_ ${order.address}`,
    `• _Pedido:_ #${shortId(order.id)}`,
    pagoLine,
    catalogUrl(order.customer_type),
    'Gracias.',
  ].join('\n')
}
