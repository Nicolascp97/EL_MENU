import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Product } from '@/types/database'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

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
  - [Nombre] a $[precio] [la/por] [unidad natural]
  - [Nombre] a $[precio] [la/por] [unidad natural]
  [Pregunta de cierre, ej: "¿Cuál te acomoda y cuánto necesitas?"]
- Convierte la unidad a lenguaje natural: "1 kg" → "el kilo", "1 unidad" → "la unidad", "3 kg" → "los 3 kg", "saco 17kg" → "el saco de 17 kg"
- Las tarjetas de productos se muestran automáticamente bajo tu texto — no repitas info extra
- Para otras respuestas (sin productos): máximo 2 oraciones, directas y amables

BÚSQUEDA DE PRODUCTOS — MUY IMPORTANTE:
- Usa SIEMPRE la forma singular con tilde correcta: "limón" NO "limones", "tomate" NO "tomates", "palta" NO "paltas"
- Si no encuentras con el nombre completo, busca con solo la raíz: "lim" para limón, "tom" para tomate
- Nunca asumas que un producto no existe sin haber buscado primero

SELECCIÓN DESDE TARJETA:
- Si el mensaje comienza con "[seleccionó:", el cliente hizo clic en una tarjeta y el producto YA fue agregado al carrito automáticamente
- En ese caso: confirma brevemente (ej: "¡Listo! 🛒 [nombre] ya está en tu carrito.") y pregunta si quiere algo más o ir al checkout
- NUNCA llames agregar_al_carrito en este caso

PRECIOS Y LOGÍSTICA:
- Despacho mínimo: $20.000 (minorista), costo envío: $2.990
- Cobertura: 27 comunas de Santiago (usa ver_zonas para detalles)
- Pedidos solo por tarjeta vía Webpay

REGLAS:
- Nunca inventes precios ni productos — siempre usa las herramientas
- No proceses pagos ni datos bancarios
- Si no puedes ayudar, indica el WhatsApp +56954952395`

const tools: Anthropic.Messages.Tool[] = [
  {
    name: 'buscar_productos',
    description: 'Busca productos del catálogo por nombre. Úsala siempre que el cliente mencione un producto específico o tipo de producto.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Nombre o tipo de producto. Ej: "tomate", "palta", "naranja", "lechuga"',
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
    description: 'Agrega productos al carrito del cliente. Llámala SOLO cuando el cliente confirmó explícitamente qué quiere y en qué cantidad. Requiere haber llamado buscar_productos antes para tener los product_id.',
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

  let body: { messages: ApiMessage[]; cartSummary?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

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
  const cartCtx = body.cartSummary
    ? `\n\n[CARRITO DEL CLIENTE (solo lectura)]: ${sanitizeCartSummary(body.cartSummary)}`
    : ''

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

      return NextResponse.json({
        message: text,
        products: shownProducts.length > 0 ? shownProducts : undefined,
        addedToCart: addedToCart.length > 0 ? addedToCart : undefined,
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
        const candidates = [...new Set([rawQuery, stripped])].filter(q => q.length >= 2)

        let found: Product[] = []
        for (const q of candidates) {
          const safeLikeQuery = q
            .replace(/%/g, '\\%')
            .replace(/_/g, '\\_')
            .slice(0, 100)

          const { data } = await admin
            .from('products')
            .select('*, category:categories(id, name, slug, order, emoji)')
            .eq('active', true)
            .eq('wholesale_only', false)
            .ilike('name', `%${safeLikeQuery}%`)
            .gt('stock', 0)
            .order('name')
            .limit(6)
          found = (data ?? []) as Product[]
          if (found.length > 0) break
        }

        found.forEach(p => {
          if (!shownProducts.find(s => s.id === p.id)) shownProducts.push(p)
        })

        result = found.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          unit: p.unit,
          stock: p.stock,
          category: p.category?.name,
        }))

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
        result = { success: true, added: items.length }
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
