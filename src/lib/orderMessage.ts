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

/**
 * Devuelve la descripción de unidad/presentación del producto.
 *
 * Hay dos tipos de `unit` en la base de datos:
 *  A) Clave limpia ('kg', 'gr', 'paq', 'unid'...) con UNIT_LABELS
 *     unit='gr', unit_qty=250  → "250 gr"
 *     unit='kg', unit_qty=1   → "Kg"  /  qty=3 → "Kg" (qty va antes del nombre)
 *  B) String descriptivo ('200 gr', '3 unid', '1 kg'...) → se muestra tal cual
 *     unit='200 gr'           → "200 gr"
 */
function formatUnitInfo(qty: number, unit: string, unit_qty: number | null | undefined): string {
  if (UNIT_LABELS[unit]) {
    const uqVal     = Number(unit_qty ?? 1)
    const hasSubQty = Number.isFinite(uqVal) && uqVal > 0 && uqVal !== 1
    if (hasSubQty) return `${formatUnitQty(unit_qty)} ${UNIT_LABELS[unit]}`
    return getUnitLabel(unit, qty)
  }
  // unit es un string descriptivo que ya incluye la cantidad por unidad
  return unit
}

/** Formato pedido por el cliente: 92,900  (coma como separador de miles). */
export const clp = (n: number) => n.toLocaleString('en-US')

export const shortId = (id: string) => id.slice(0, 8).toUpperCase()

/** URL del catálogo que delata si el pedido vino por mayorista o minorista. */
export function catalogUrl(customerType?: string | null): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.el-menu.cl').replace(/\/$/, '')
  return customerType === 'mayorista' ? `${base}/mayorista` : `${base}/catalogo`
}

/**
 * Formato de cada ítem: cantidad ANTES del nombre, unidad después del guion.
 *   "• 2 PALTA HASS GRANDE — 1 kg: CLP 7,600"
 *   "• 1 CHAMPIÑÓN 200G — 200 gr: CLP 1,990"
 *   "• 1 PICKLE ESPECIAL — 250 gr: CLP 1,800"
 *   "• 3 ALBAHACA — Paquetes: CLP 3,000"
 */
export function formatItems(items: OrderForMessage['items']): string {
  return items
    .map(i => {
      const lineTotal = i.qty * i.unit_price
      const unitInfo  = formatUnitInfo(i.qty, i.unit, i.unit_qty)
      return `• ${i.qty} ${i.product_name.toUpperCase()} — ${unitInfo}: CLP ${clp(lineTotal)}`
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
