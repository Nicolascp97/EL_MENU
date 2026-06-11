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

/** Etiquetas legibles para el campo unit, singular. */
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

const UNIT_LABELS_PLURAL: Record<string, string> = {
  unid:   'Unidades',
  paq:    'Paquetes',
  ramo:   'Ramos',
  bolsa:  'Bolsas',
  maceta: 'Macetas',
  caja:   'Cajas',
}

function getUnitLabel(unit: string, qty: number): string {
  if (qty !== 1 && UNIT_LABELS_PLURAL[unit]) return UNIT_LABELS_PLURAL[unit]
  return UNIT_LABELS[unit] ?? unit
}

/** Formatea la cantidad por unidad sin ceros decimales innecesarios:
 *  1 → "1", 250 → "250", 1.5 → "1.5". */
function formatUnitQty(n: number | null | undefined): string {
  const v = n == null ? 1 : Number(n)
  if (!Number.isFinite(v) || v <= 0) return '1'
  return Number.isInteger(v) ? String(v) : String(v).replace(/\.?0+$/, '')
}

/** "3 Paquetes" | "2 × 250 gr" | "4 Kg" */
function formatQtyLabel(qty: number, unit: string, unit_qty: number | null | undefined): string {
  const uqVal     = Number(unit_qty ?? 1)
  const hasSubQty = Number.isFinite(uqVal) && uqVal > 0 && uqVal !== 1
  if (hasSubQty) {
    return `${qty} × ${formatUnitQty(unit_qty)} ${UNIT_LABELS[unit] ?? unit}`
  }
  return `${qty} ${getUnitLabel(unit, qty)}`
}

/** Formato pedido por el cliente: 92,900  (coma como separador de miles). */
export const clp = (n: number) => n.toLocaleString('en-US')

export const shortId = (id: string) => id.slice(0, 8).toUpperCase()

/** URL del catálogo que delata si el pedido vino por mayorista o minorista. */
export function catalogUrl(customerType?: string | null): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.el-menu.cl').replace(/\/$/, '')
  return customerType === 'mayorista' ? `${base}/mayorista` : `${base}/catalogo`
}

/** Formato de cada ítem del pedido.
 *  Ejemplos: "• TOMATE — 2 Kg: CLP 1,600"
 *            "• ALBAHACA — 3 Paquetes: CLP 3,000"
 *            "• ACEITUNA — 2 × 250 gr: CLP 2,000" */
export function formatItems(items: OrderForMessage['items']): string {
  return items
    .map(i => {
      const lineTotal  = i.qty * i.unit_price
      const qtyDisplay = formatQtyLabel(i.qty, i.unit, i.unit_qty)
      return `• ${i.product_name.toUpperCase()} — ${qtyDisplay}: CLP ${clp(lineTotal)}`
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
