/**
 * units.ts — Cómo se le muestra al cliente cuánto se lleva por cada unidad.
 *
 * En la base conviven dos convenciones para `unit`, y las dos son válidas:
 *
 *   A) Clave limpia + cantidad aparte:  unit='gr',  unit_qty=250  → "250 gr"
 *   B) String descriptivo autocontenido: unit='malla 17kg'        → "Malla 17 kg"
 *
 * Este módulo las normaliza a una sola forma para que todas las pantallas
 * muestren lo mismo. Es una función pura y sin dependencias a propósito: así se
 * puede testear con `node --test` sin levantar Next ni React.
 */

type ProductPresentationInput = {
  price: number
  price_wholesale: number | null
  unit: string
  unit_wholesale: string | null
  unit_qty: number | null | undefined
  unit_qty_wholesale: number | null | undefined
}

type PresentationOptions = {
  wholesale?: boolean
}

type UnitBase = 'kg' | 'gr' | 'unid'

export type Presentation = {
  envase: string | null
  cantidad: number | null
  base: UnitBase | null
  label: string
  perMeasure: string | null
}

type CleanUnit = { singular: string; plural: string; base: UnitBase | null; envase?: string }

const CLEAN_UNITS: Record<string, CleanUnit> = {
  kg:     { singular: 'kg',      plural: 'kg',        base: 'kg' },
  gr:     { singular: 'gr',      plural: 'gr',        base: 'gr' },
  unid:   { singular: 'Unidad',  plural: 'unidades',  base: 'unid' },
  paq:    { singular: 'Paquete', plural: 'paquetes',  base: null, envase: 'Paquete' },
  ramo:   { singular: 'Ramo',    plural: 'ramos',     base: null, envase: 'Ramo' },
  bolsa:  { singular: 'Bolsa',   plural: 'bolsas',    base: null, envase: 'Bolsa' },
  maceta: { singular: 'Maceta',  plural: 'macetas',   base: null, envase: 'Maceta' },
  caja:   { singular: 'Caja',    plural: 'cajas',     base: null, envase: 'Caja' },
  saco:   { singular: 'Saco',    plural: 'sacos',     base: null, envase: 'Saco' },
  malla:  { singular: 'Malla',   plural: 'mallas',    base: null, envase: 'Malla' },
  atado:  { singular: 'Atado',   plural: 'atados',    base: null, envase: 'Atado' },
}

/** Envases que pueden declarar un contenido ("caja 18kg"). El panel admin
 *  muestra el campo de contenido solo para estos. */
export const ENVASE_UNITS = Object.keys(CLEAN_UNITS).filter(k => CLEAN_UNITS[k].envase)

/** Bases medibles que puede tener el contenido de un envase. */
export const CONTENT_BASES = ['kg', 'gr', 'unid'] as const

const MEASURE_PATTERN = 'kg|kilos?|gr|g|gramos?|unid(?:ades?)?|u'

/** Formato CLP. Se define acá en vez de importar `formatPrice` de lib/utils
 *  para que units.ts no arrastre clsx/tailwind-merge y siga siendo testeable
 *  con `node --test` puro. Si cambia el formato en utils, cambiar también acá. */
function formatPrice(value: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(Math.round(value))
}

function asPositiveNumber(value: number | null | undefined): number | null {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace(/\.0+$/, '')
}

function normalizeBase(value: string): UnitBase | null {
  const normalized = value.toLowerCase()
  if (normalized === 'kg' || normalized === 'kilo' || normalized === 'kilos') return 'kg'
  if (normalized === 'gr' || normalized === 'g' || normalized === 'gramo' || normalized === 'gramos') return 'gr'
  if (normalized === 'u' || normalized.startsWith('unid')) return 'unid'
  return null
}

function titleCase(value: string): string {
  return value.replace(/\b\p{L}/gu, char => char.toUpperCase())
}

function displayBase(base: UnitBase, quantity: number): string {
  if (base === 'unid') return quantity === 1 ? 'Unidad' : 'unidades'
  return base
}

/** Nombre bonito del envase: 'malla' → 'Malla', 'paq' → 'Paquete'. */
function envaseLabel(raw: string): string {
  return CLEAN_UNITS[raw.toLowerCase()]?.envase ?? titleCase(raw)
}

function pricePerMeasure(price: number, quantity: number | null, base: UnitBase | null): string | null {
  if (quantity == null || quantity === 1 || base == null) return null
  if (base === 'gr') return `${formatPrice(price / (quantity / 1_000))} el kilo`
  if (base === 'kg') return `${formatPrice(price / quantity)} el kilo`
  return `${formatPrice(price / quantity)} c/u`
}

/**
 * Unidad descriptiva que ya trae su propia cantidad al frente: "1 kg", "3 unid",
 * "1 paq". Se resuelve como clave limpia usando esa cantidad, de modo que
 * "1 paq" muestre "Paquete" y no "1 Paq".
 */
function matchCountedCleanUnit(unit: string): { clean: CleanUnit; quantity: number } | null {
  const match = /^(\d+(?:[.,]\d+)?)\s+(\p{L}+)$/u.exec(unit.trim())
  if (!match) return null

  const quantity = Number(match[1].replace(',', '.'))
  const clean = CLEAN_UNITS[match[2].toLowerCase()]
  if (!clean || !Number.isFinite(quantity) || quantity <= 0) return null

  return { clean, quantity }
}

/**
 * Unidad descriptiva con envase y contenido: "malla 17kg", "caja 14u",
 * "saco 24kg", "paq 12u". Devuelve el envase y la medida que trae adentro.
 */
function parseDescriptiveUnit(unit: string) {
  const match = new RegExp(`(?:^|\\s|\\()(\\d+(?:[.,]\\d+)?)\\s*(${MEASURE_PATTERN})\\b`, 'iu').exec(unit)
  if (!match || match.index == null) return null

  const quantity = Number(match[1].replace(',', '.'))
  const base = normalizeBase(match[2])
  if (!Number.isFinite(quantity) || quantity <= 0 || base == null) return null

  const before = unit.slice(0, match.index).trim().replace(/[\s(]+$/, '')
  const envase = before ? envaseLabel(before) : null
  const medida = `${formatNumber(quantity)} ${displayBase(base, quantity)}`

  return { envase, quantity, base, label: envase ? `${envase} ${medida}` : medida }
}

/**
 * Resuelve una presentación de producto sin alterar los datos de venta.
 * Mantiene el mismo fallback mayorista de los endpoints de checkout
 * (ver src/app/api/checkout/route.ts): si no hay unidad mayorista, cae a la
 * minorista, y la cantidad mayorista cae a la minorista.
 */
export function resolvePresentation(
  product: ProductPresentationInput,
  { wholesale = false }: PresentationOptions = {},
): Presentation {
  const usesWholesaleUnit = wholesale && Boolean(product.unit_wholesale?.trim())
  const unit = ((usesWholesaleUnit ? product.unit_wholesale : product.unit) ?? '').trim() || product.unit
  const quantity = asPositiveNumber(
    usesWholesaleUnit ? product.unit_qty_wholesale ?? product.unit_qty : product.unit_qty,
  )
  const price = wholesale && product.price_wholesale != null ? product.price_wholesale : product.price

  const counted = matchCountedCleanUnit(unit)
  const clean = counted?.clean ?? CLEAN_UNITS[unit.toLowerCase()]

  if (clean) {
    const displayedQuantity = counted?.quantity ?? quantity ?? 1
    const label = clean.base
      ? `${formatNumber(displayedQuantity)} ${displayBase(clean.base, displayedQuantity)}`
      : displayedQuantity === 1
        ? clean.singular
        : `${formatNumber(displayedQuantity)} ${clean.plural}`

    return {
      envase: clean.envase ?? null,
      cantidad: clean.base ? displayedQuantity : displayedQuantity === 1 ? null : displayedQuantity,
      base: clean.base,
      label,
      perMeasure: pricePerMeasure(price, displayedQuantity, clean.base),
    }
  }

  const descriptive = parseDescriptiveUnit(unit)
  if (descriptive) {
    return {
      envase: descriptive.envase,
      cantidad: descriptive.quantity,
      base: descriptive.base,
      label: descriptive.label,
      perMeasure: pricePerMeasure(price, descriptive.quantity, descriptive.base),
    }
  }

  return {
    envase: titleCase(unit),
    cantidad: null,
    base: null,
    label: titleCase(unit),
    perMeasure: null,
  }
}

/** Descompone un `unit` descriptivo en envase + contenido, para poder
 *  precargar los campos del panel admin. Devuelve null si no es un envase
 *  con contenido declarado. */
export function splitEnvaseContent(unit: string): { envase: string; qty: number; base: UnitBase } | null {
  const trimmed = (unit ?? '').trim()
  if (!trimmed || CLEAN_UNITS[trimmed.toLowerCase()] || matchCountedCleanUnit(trimmed)) return null

  const match = new RegExp(`^(\\p{L}+)\\s*\\(?\\s*(\\d+(?:[.,]\\d+)?)\\s*(${MEASURE_PATTERN})\\b`, 'iu').exec(trimmed)
  if (!match) return null

  const envase = match[1].toLowerCase()
  const qty = Number(match[2].replace(',', '.'))
  const base = normalizeBase(match[3])
  if (!CLEAN_UNITS[envase]?.envase || !Number.isFinite(qty) || qty <= 0 || base == null) return null

  return { envase, qty, base }
}

/** Arma el `unit` descriptivo que se guarda en la base: ('caja', 18, 'kg') → 'caja 18kg'. */
export function buildEnvaseUnit(envase: string, qty: number | null | undefined, base: string): string {
  const amount = asPositiveNumber(qty)
  if (!amount) return envase
  return `${envase} ${formatNumber(amount)}${base}`
}
