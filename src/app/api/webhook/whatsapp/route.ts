import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const SYSTEM_PROMPT = `Eres el asistente de WhatsApp de "El Menú", una verdulería en Macul, Santiago de Chile.
Tu nombre es "Meni". Eres amable, directo y hablas en español chileno casual (tuteo, "po", "cachai", "wena").

## Tu trabajo
- Responder preguntas sobre productos, precios y disponibilidad
- Tomar pedidos completos y confirmarlos
- Informar zonas de despacho y precios de envío
- Escalar a Celso cuando el cliente tiene una queja o situación especial

## Horario de El Menú
Lunes a Sábado: 8:00 a 20:00 hrs
Domingo: cerrado

## Reglas de pedido
1. Siempre confirmar dirección y comuna antes de crear el pedido
2. Mínimo de compra según zona (te lo doy como contexto)
3. Si el cliente consulta un producto y no hay stock, ofrecer alternativa similar
4. Confirmar el pedido con resumen completo antes de crear

## Formato de respuesta
- Mensajes cortos, máximo 3-4 líneas por respuesta
- Usa emojis con moderación (1-2 por mensaje máximo)
- Lista de productos con precio: "🥦 Brócoli — $1.190/unid"
- Nunca digas "como IA" ni menciones que eres un bot a menos que te lo pregunten directamente

## Si no sabes algo
Di: "Voy a consultar con Celso y te confirmo en un momento ✅"
Luego usa la herramienta escalar_humano.`

export async function POST(req: NextRequest) {
  try {
    // FIX-02: Timing-safe comparison para el webhook secret
    const secret = req.headers.get('x-webhook-secret') ?? ''
    const expectedSecret = process.env.N8N_WEBHOOK_SECRET ?? ''
    if (!expectedSecret || !secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    let secretValid = false
    try {
      const a = Buffer.from(secret)
      const b = Buffer.from(expectedSecret)
      secretValid = a.length === b.length && timingSafeEqual(a, b)
    } catch { secretValid = false }
    if (!secretValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { phone, message, conversation_id } = body

    if (!phone || !message) {
      return NextResponse.json({ error: 'Missing phone or message' }, { status: 400 })
    }

    const supabase = createAdminClient()

    let conversation = null
    if (conversation_id) {
      const { data } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversation_id)
        .single()
      conversation = data
      // FIX-24: Verificar ownership — ignorar si el ID no pertenece a este número
      if (conversation && conversation.wa_phone !== phone) {
        conversation = null
      }
    } else {
      const { data } = await supabase
        .from('conversations')
        .select('*')
        .eq('wa_phone', phone)
        .eq('status', 'activa')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      conversation = data
    }

    const messages = conversation?.messages || []

    const { data: products } = await supabase
      .from('products')
      .select('name, price, unit, stock, category:categories(name)')
      .eq('active', true)
      .order('name')

    const { data: zones } = await supabase
      .from('zones')
      .select('name, communes, delivery_price, min_order')

    // FIX-12: No exponer precios mayoristas en el contexto de WhatsApp
    const productContext = products?.map(p =>
      `• ${p.name}: $${p.price}/${p.unit} — stock: ${p.stock}`
    ).join('\n') || 'Sin productos cargados'

    const zoneContext = zones?.map(z =>
      `• ${z.name} (${z.communes.join(', ')}): despacho $${z.delivery_price}, mínimo $${z.min_order}`
    ).join('\n') || 'Sin zonas cargadas'

    const dynamicContext = `
## Productos disponibles hoy
${productContext}

## Zonas de despacho
${zoneContext}
`

    const updatedMessages = [
      ...messages,
      { role: 'user' as const, content: message, ts: new Date().toISOString() }
    ]

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT + '\n\n' + dynamicContext,
      messages: updatedMessages.slice(-20).map(m => ({
        role: m.role,
        content: m.content,
      })),
      tools: [
        {
          // FIX-01: No aceptar unit_price de la IA — el servidor calcula los precios
          name: 'crear_pedido',
          description: 'Crea un pedido confirmado cuando el cliente aprobó todos los ítems, dirección y commune. NO incluyas precios — el servidor los calcula.',
          input_schema: {
            type: 'object' as const,
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    product_name: { type: 'string', description: 'Nombre exacto del producto' },
                    qty: { type: 'number', description: 'Cantidad' },
                  },
                  required: ['product_name', 'qty'],
                },
              },
              address: { type: 'string' },
              commune: { type: 'string' },
              notes: { type: 'string' },
            },
            required: ['items', 'address', 'commune'],
          },
        },
        {
          name: 'escalar_humano',
          description: 'Escala la conversación a Celso cuando hay una queja, situación especial o el agente no puede resolver',
          input_schema: {
            type: 'object' as const,
            properties: {
              reason: { type: 'string', description: 'Razón de la escalada' },
            },
            required: ['reason'],
          },
        },
      ],
    })

    let assistantText = ''
    let orderId: string | null = null

    for (const block of response.content) {
      if (block.type === 'text') {
        assistantText = block.text
      }
      if (block.type === 'tool_use') {
        if (block.name === 'crear_pedido') {
          // FIX-01: Validar precios desde la DB, no confiar en la IA
          const input = block.input as {
            items: { product_name: string; qty: number; unit?: string }[]
            address: string
            commune: string
            notes?: string
          }

          const productNames = input.items.map(i => i.product_name)
          const { data: dbProducts } = await supabase
            .from('products')
            .select('id, name, price, unit, stock, active, wholesale_only')
            .in('name', productNames)
            .eq('active', true)

          const { data: zone } = await supabase
            .from('zones')
            .select('*')
            .contains('communes', [input.commune])
            .maybeSingle()

          if (!zone) {
            assistantText = `Lo siento, no despachamos a ${input.commune}. Puedo ayudarte con otra dirección.`
            break
          }

          const orderItems: { product_name: string; qty: number; unit_price: number; unit: string }[] = []
          let subtotal = 0
          let hasError = false

          for (const item of input.items) {
            const p = dbProducts?.find(x => x.name.toLowerCase() === item.product_name.toLowerCase())
            if (!p) { hasError = true; break }
            if (p.wholesale_only) { hasError = true; break }

            const qty = Math.max(1, Math.floor(Number(item.qty) || 1))
            if (qty > p.stock) { hasError = true; break }

            orderItems.push({ product_name: p.name, qty, unit_price: p.price, unit: p.unit })
            subtotal += p.price * qty
          }

          if (hasError || orderItems.length === 0) {
            assistantText = 'Hubo un problema validando los productos. ¿Puedes confirmar qué quieres pedir?'
            break
          }

          if (subtotal < zone.min_order) {
            assistantText = `El pedido mínimo es $${zone.min_order.toLocaleString('es-CL')}. Aún te faltan $${(zone.min_order - subtotal).toLocaleString('es-CL')}.`
            break
          }

          const total = subtotal + zone.delivery_price

          const { data: order } = await supabase.from('orders').insert({
            channel: 'whatsapp',
            status: 'nuevo',
            payment_status: 'pendiente', // FIX-20: payment_status explícito
            items: orderItems,
            total,
            address: input.address,
            commune: input.commune,
            phone,
            notes: input.notes || null,
          }).select().single()
          orderId = order?.id || null
        }
        if (block.name === 'escalar_humano') {
          await supabase
            .from('conversations')
            .update({ status: 'escalada' })
            .eq('wa_phone', phone)
            .eq('status', 'activa')
        }
      }
    }

    const finalMessages = [
      ...updatedMessages,
      { role: 'assistant' as const, content: assistantText, ts: new Date().toISOString() }
    ]

    if (conversation) {
      await supabase
        .from('conversations')
        .update({ messages: finalMessages, ...(orderId ? { order_id: orderId } : {}) })
        .eq('id', conversation.id)
    } else {
      await supabase.from('conversations').insert({
        wa_phone: phone,
        messages: finalMessages,
        status: 'activa',
        order_id: orderId,
      })
    }

    return NextResponse.json({ response: assistantText, order_id: orderId })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
