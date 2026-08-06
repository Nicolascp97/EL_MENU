import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatUnitInfo } from '@/lib/orderMessage'
import type { Product } from '@/types/database'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

/** Mismo mínimo que valida el checkout (MIN_MAYORISTA en /api/checkout). */
const MIN_MAYORISTA = 60_000

type CartMode = 'minorista' | 'mayorista'

const TILDES: Record<string, string> = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' }

/** "plátano" → "platano" */
const sinTildes = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/**
 * Variantes de acentuación de una búsqueda.
 *
 * El cliente escribe "platano" y en la base el producto es "Plátano": `ilike` no
 * cruza la tilde, así que la búsqueda devolvía 0 filas y Menucito contestaba que
 * no existía. Genera la forma sin tildes más una variante con tilde en cada
 * vocal — lineal, no combinatorio, y en castellano la tilde es siempre una sola.
 */
function variantesAcento(q: string): string[] {
  const base = sinTildes(q)
  const out = new Set([q, base])
  for (let i = 0; i < base.length; i++) {
    const t = TILDES[base[i].toLowerCase()]
    if (t) out.add(base.slice(0, i) + t + base.slice(i + 1))
  }
  return [...out]
}

/** Deja el término apto para un filtro `or=(name.ilike.*…*)` de PostgREST. */
const limpiar = (q: string) =>
  q.replace(/[%_,().*"\\]/g, '').trim().slice(0, 40)

/**
 * Precio que se le va a cobrar realmente por este producto.
 *
 * Un producto `wholesale_only` solo se vende en formato mayorista, así que
 * siempre va a precio mayorista — incluso si el cliente está navegando el
 * catálogo minorista, porque al agregarlo el carrito pasa a modo mayorista.
 * Espeja `itemPrice()` de useCart y el cálculo de unitPrice del checkout.
 */
function efectivo(p: Product, mode: CartMode) {
  const comoMayorista = (mode === 'mayorista' || p.wholesale_only) && p.price_wholesale != null
  const price = comoMayorista ? p.price_wholesale! : p.price
  const unit  = comoMayorista && p.unit_wholesale ? p.unit_wholesale : p.unit
  const qty   = comoMayorista && p.unit_wholesale
    ? (p.unit_qty_wholesale ?? p.unit_qty ?? 1)
    : (p.unit_qty ?? 1)
  return { price, formato: formatUnitInfo(1, unit, qty) }
}

const SYSTEM = `Eres Menucito, el asistente virtual de El Menú — verdulería online con despacho a domicilio en Santiago, Chile.

Tu misión: ayudar a encontrar productos frescos, armar el pedido y guiar al checkout de forma rápida y amable.

PERSONALIDAD: amable, directa, chilena natural. Usas "tú". Respuestas cortas (máximo 3 oraciones). Puedes usar 1-2 emojis.

FLUJO IDEAL:
1. Entender qué busca el cliente
2. Buscar productos con buscar_productos
3. Mostrar resultados y preguntar cantidades
4. Cuando el cliente confirme con cantidades específicas, llamar agregar_al_carrito
5. Cuando esté listo para pagar, decirle que haga clic en "Ir al checkout"

FORMATO DE RESPUESTA — MUY IMPORTANTE:
- NUNCA uses tablas markdown, guiones separadores (---), ni formato | col | col |
- Cuando muestres productos, usa SIEMPRE este formato exacto:
  [Frase intro corta, ej: "Tengo dos opciones:" o "Encontré esto:"]
  - [Nombre] a $[precio] [la/por] [formato en lenguaje natural]
  - [Nombre] a $[precio] [la/por] [formato en lenguaje natural]
  [Pregunta de cierre, ej: "¿Cuál te acomoda y cuánto necesitas?"]
- Convierte el campo "formato" a lenguaje natural: "1 kg" → "el kilo", "Unidad" → "la unidad",
  "Caja" → "la caja", "17 kg" → "el saco de 17 kg", "Docena" → "la docena"
- Cuando un producto tenga formato minorista y mayorista, muéstralos como dos líneas y deja
  claro cuál es el grande, ej: "Plátano a $1.550 el kilo" y "Caja de Plátanos a $22.000 la caja"
- Las tarjetas de productos se muestran automáticamente bajo tu texto — no repitas info extra
- Para otras respuestas (sin productos): máximo 2 oraciones, directas y amables

BÚSQUEDA DE PRODUCTOS — MUY IMPORTANTE:
- Usa SIEMPRE la forma singular con tilde correcta: "limón" NO "limones", "tomate" NO "tomates", "palta" NO "paltas"
- Si no encuentras con el nombre completo, busca con solo la raíz: "lim" para limón, "tom" para tomate
- Nunca asumas que un producto no existe sin haber buscado primero
- Si el cliente pide un formato grande (caja, malla, saco, docena, pack) busca solo el nombre
  del producto — "plátano", no "caja de plátano". La búsqueda devuelve todos sus formatos.

FORMATOS MAYORISTAS (caja, malla, saco, docena, pack, 500g, 1kg):
- Muchos productos vienen en dos formatos: el minorista (por kilo o unidad) y el mayorista
  (caja, malla, saco...). buscar_productos devuelve AMBOS, cada uno con su precio y formato.
- Los formatos grandes tienen "solo_mayorista": true. Cualquier cliente puede comprarlos,
  no hace falta cuenta de empresa ni registro.
- REGLA: cuando el cliente pida un formato grande, ofrécelo con su precio real. Si el
  producto existe pero solo en formato por kilo, dilo — nunca inventes un precio de caja.
- Al agregar un producto "solo_mayorista" el pedido completo pasa a precio mayorista y el
  mínimo sube a $${MIN_MAYORISTA.toLocaleString('es-CL')}. Avísale al cliente en la misma frase
  en que confirmas, breve: "Ojo que con la caja el pedido pasa a mayorista, mínimo $60.000."
- Si el cliente ya está en el catálogo mayorista, no repitas el aviso: ya está en ese modo.

SELECCIÓN DESDE TARJETA:
- Si el mensaje comienza con "[seleccionó:", el cliente hizo clic en una tarjeta y el producto YA fue agregado al carrito automáticamente
- En ese caso: confirma brevemente (ej: "¡Listo! 🛒 [nombre] ya está en tu carrito.") y pregunta si quiere algo más o ir al checkout
- NUNCA llames agregar_al_carrito en este caso

PRECIOS Y LOGÍSTICA:
- Despacho mínimo: $20.000 minorista · $${MIN_MAYORISTA.toLocaleString('es-CL')} mayorista. Costo envío: $2.990
- Cobertura: 27 comunas de Santiago (usa ver_zonas para detalles)
- Se paga con tarjeta (Webpay) o por transferencia bancaria
- Los precios que te devuelve buscar_productos ya vienen ajustados al tipo de pedido del
  cliente: usa el campo "precio" tal cual, nunca lo recalcules

REGLAS:
- Nunca inventes precios ni productos — siempre usa las herramientas
- No proceses pagos ni datos bancarios
- Si no puedes ayudar, indica el WhatsApp +56954952395`

const tools: Anthropic.Messages.Tool[] = [
  {
    name: 'buscar_productos',
    description:
      'Busca productos del catálogo por nombre. Úsala siempre que el cliente mencione un ' +
      'producto específico o tipo de producto, incluso si pide un formato grande (caja, malla, ' +
      'saco, docena). Devuelve TODOS los formatos de ese producto: el minorista por kilo o ' +
      'unidad y el mayorista en caja/malla/saco, cada uno con su precio real y su formato. ' +
      'Los formatos grandes vienen con "solo_mayorista": true.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description:
            'Solo el nombre del producto, en singular y sin el formato. ' +
            'Ej: "tomate", "palta", "plátano", "cebolla". ' +
            'NO escribas "caja de plátano" ni "malla de cebolla" — busca "plátano" y "cebolla".',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'ver_zonas',
    description: 'Obtiene las zonas de despacho, comunas cubiertas y precios de envío.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'agregar_al_carrito',
    description:
      'Agrega productos al carrito del cliente. Llámala SOLO cuando el cliente confirmó ' +
      'explícitamente qué quiere y en qué cantidad. Requiere haber llamado buscar_productos ' +
      'antes para tener los product_id. Sirve igual para formatos mayoristas (caja, malla, ' +
      'saco): si agregas uno, el carrito pasa solo a modo mayorista y la respuesta te lo ' +
      'confirma en "pedido" — menciónalo al cliente junto con el mínimo.',
    input_schema: {
      type: 'object' as const,
      properties: {
        items: {
          type: 'array',
          description: 'Productos a agregar al carrito',
          items: {
            type: 'object',
            properties: {
              product_id: { type: 'string', description: 'UUID exacto del producto (del resultado de buscar_productos)' },
              qty: { type: 'number', description: 'Cantidad a agregar (número entero positivo)' },
            },
            required: ['product_id', 'qty'],
          },
        },
      },
      required: ['items'],
    },
  },
]

type ApiMessage = { role: 'user' | 'assistant'; content: string }

// Rate limiting simple en memoria (por proceso)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 20
const RATE_WINDOW = 60_000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

function sanitizeCartSummary(raw: string): string {
  return raw
    .slice(0, 500)
    .replace(/[\r\n]+/g, ', ')
    .replace(/[<>{}[\]]/g, '')
    .trim()
}

export async function POST(req: NextRequest) {
  // Feature flag: CHAT_ENABLED=false desactiva el agente IA temporalmente
  if (process.env.CHAT_ENABLED === 'false') {
    return NextResponse.json(
      { message: 'Menucito está descansando por ahora 🌙 Vuelve pronto.' },
      { status: 503 }
    )
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Demasiadas consultas. Intenta en un minuto.' }, { status: 429 })
  }

  let body: { messages: ApiMessage[]; cartSummary?: string; mode?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  // En qué catálogo está el cliente. Define qué precio y formato ve, y por eso
  // se valida en vez de confiar en el string que llegue.
  const mode: CartMode = body.mode === 'mayorista' ? 'mayorista' : 'minorista'

  const MAX_MESSAGES = 30
  const MAX_MSG_LEN = 2000
  const MAX_CART = 500
  const VALID_ROLES = new Set(['user', 'assistant'])

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: 'Sin mensajes' }, { status: 400 })
  }
  if (body.messages.length > MAX_MESSAGES) {
    return NextResponse.json({ error: 'Historial muy largo' }, { status: 400 })
  }
  if (body.messages.some(m => !VALID_ROLES.has(m.role) || typeof m.content !== 'string' || m.content.length > MAX_MSG_LEN)) {
    return NextResponse.json({ error: 'Mensaje inválido' }, { status: 400 })
  }
  if (body.cartSummary && body.cartSummary.length > MAX_CART) {
    body.cartSummary = body.cartSummary.slice(0, MAX_CART)
  }

  const admin = createAdminClient()
  const cartCtx =
    `\n\n[TIPO DE PEDIDO ACTUAL (solo lectura)]: ${mode}` +
    (body.cartSummary
      ? `\n[CARRITO DEL CLIENTE (solo lectura)]: ${sanitizeCartSummary(body.cartSummary)}`
      : '')

  let currentMsgs: Anthropic.Messages.MessageParam[] = body.messages.map(m => ({
    role: m.role,
    content: m.content,
  }))

  const shownProducts: Product[] = []
  const pendingCartItems: { product_id: string; qty: number }[] = []

  try {
  for (let i = 0; i < 5; i++) {
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM + cartCtx,
      tools,
      messages: currentMsgs,
    })

    if (resp.stop_reason === 'end_turn') {
      const text = resp.content
        .filter((c): c is Anthropic.Messages.TextBlock => c.type === 'text')
        .map(c => c.text)
        .join('')

      let addedToCart: { product: Product; qty: number }[] = []
      if (pendingCartItems.length > 0) {
        const ids = pendingCartItems.map(i => i.product_id)
        const { data } = await admin
          .from('products')
          .select('*, category:categories(id, name, slug, order, emoji)')
          .in('id', ids)
        if (data) {
          addedToCart = pendingCartItems
            .map(item => ({
              product: data.find(p => p.id === item.product_id) as Product,
              qty: item.qty,
            }))
            .filter(i => i.product != null)
        }
      }

      // Modo en que debe quedar el carrito. Un producto wholesale_only obliga a
      // mayorista: el checkout lo rechaza ("es solo para cuentas empresa") si el
      // pedido va como minorista, y así el cliente no podía terminar la compra.
      const cartMode: CartMode =
        mode === 'mayorista' || addedToCart.some(i => i.product.wholesale_only)
          ? 'mayorista'
          : 'minorista'

      return NextResponse.json({
        message: text,
        products: shownProducts.length > 0 ? shownProducts : undefined,
        addedToCart: addedToCart.length > 0 ? addedToCart : undefined,
        cartMode,
      })
    }

    if (resp.stop_reason !== 'tool_use') break

    const toolUses = resp.content.filter(
      (c): c is Anthropic.Messages.ToolUseBlock => c.type === 'tool_use'
    )
    currentMsgs = [...currentMsgs, { role: 'assistant', content: resp.content }]

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = []

    for (const tu of toolUses) {
      let result: unknown

      if (tu.name === 'buscar_productos') {
        const rawQuery = (tu.input as { query: string }).query.trim()

        const stripped = rawQuery
          .replace(/ones$/i, 'on')
          .replace(/nes$/i, 'n')
          .replace(/les$/i, 'l')
          .replace(/es$/i, '')
          .replace(/s$/i, '')

        // Singular/plural × variantes de tilde, en UNA sola consulta.
        const terminos = [...new Set(
          [rawQuery, stripped]
            .flatMap(variantesAcento)
            .map(limpiar)
            .filter(q => q.length >= 2),
        )]

        // Ya NO se filtra wholesale_only: excluirlo dejaba 31 de 127 productos
        // vendibles (todas las cajas, mallas y sacos) invisibles para Menucito,
        // que respondía "no existe" o solo daba el precio por kilo. El catálogo
        // mayorista está abierto a todos, así que estos formatos SÍ se pueden
        // vender — solo suben el mínimo del pedido a MIN_MAYORISTA.
        let found: Product[] = []
        if (terminos.length > 0) {
          const { data } = await admin
            .from('products')
            .select('*, category:categories(id, name, slug, order, emoji)')
            .eq('active', true)
            .or(terminos.map(t => `name.ilike.*${t}*`).join(','))
            .gt('stock', 0)
            .order('wholesale_only')   // primero los formatos chicos, luego los grandes
            .order('name')
            .limit(8)
          found = (data ?? []) as Product[]
        }

        found.forEach(p => {
          if (!shownProducts.find(s => s.id === p.id)) shownProducts.push(p)
        })

        result = found.map(p => {
          const { price, formato } = efectivo(p, mode)
          return {
            id:             p.id,
            nombre:         p.name,
            precio:         price,
            formato,
            solo_mayorista: p.wholesale_only,
            stock:          p.stock,
            categoria:      p.category?.name,
          }
        })

        if (found.length === 0) {
          result = { message: `No encontré productos que coincidan con "${rawQuery}". Intenta con otro nombre.` }
        }
      } else if (tu.name === 'ver_zonas') {
        const { data } = await admin
          .from('zones')
          .select('name, communes, delivery_price, min_order, min_order_wholesale')
        result = data
      } else if (tu.name === 'agregar_al_carrito') {
        const { items } = tu.input as { items: { product_id: string; qty: number }[] }
        items.forEach(item => {
          if (!pendingCartItems.find(p => p.product_id === item.product_id)) {
            pendingCartItems.push({ product_id: item.product_id, qty: Math.max(1, Math.floor(item.qty)) })
          }
        })

        // Le confirmamos al modelo si el pedido quedó mayorista, para que avise
        // del mínimo en la misma respuesta en vez de dejar al cliente descubrirlo
        // recién en el checkout.
        const agregados  = items.map(i => shownProducts.find(p => p.id === i.product_id))
        const haceMayor  = agregados.some(p => p?.wholesale_only)
        const pedido: CartMode = mode === 'mayorista' || haceMayor ? 'mayorista' : 'minorista'

        result = {
          success: true,
          added:   items.length,
          pedido,
          minimo:  pedido === 'mayorista' ? MIN_MAYORISTA : 20_000,
          aviso:   haceMayor && mode !== 'mayorista'
            ? `Agregaste un formato mayorista, así que el pedido pasó a precios mayoristas y el mínimo es $${MIN_MAYORISTA.toLocaleString('es-CL')}. Avísale al cliente.`
            : undefined,
        }
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: JSON.stringify(result),
      })
    }

    currentMsgs = [...currentMsgs, { role: 'user', content: toolResults }]
  }
  } catch (err: unknown) {
    const msg = String((err as { message?: string }).message ?? err).slice(0, 400)
    console.error('[chat] Anthropic error:', msg)
    return NextResponse.json({ message: 'Tuve un problema al procesar tu consulta. Por favor intenta de nuevo.' })
  }

  return NextResponse.json({
    message: 'Tuve un problema al procesar tu consulta. Por favor intenta de nuevo.',
  })
}
