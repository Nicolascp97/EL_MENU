import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// Sistema de caché de contexto para ahorrar tokens
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
    // Verificar secreto del webhook (n8n lo envía en headers)
    const secret = req.headers.get('x-webhook-secret')
    if (secret !== process.env.N8N_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { phone, message, conversation_id } = body

    if (!phone || !message) {
      return NextResponse.json({ error: 'Missing phone or message' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Cargar o crear conversación
    let conversation = null
    if (conversation_id) {
      const { data } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversation_id)
        .single()
      conversation = data
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

    // Cargar contexto de productos (para el system prompt dinámico)
    const { data: products } = await supabase
      .from('products')
      .select('name, price, price_wholesale, unit, stock, category:categories(name)')
      .eq('active', true)
      .order('name')

    const { data: zones } = await supabase
      .from('zones')
      .select('name, communes, delivery_price, min_order')

    const productContext = products?.map(p =>
      `• ${p.name}: $${p.price}/${p.unit}${p.price_wholesale ? ` (mayorista: $${p.price_wholesale})` : ''} — stock: ${p.stock}`
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

    // Agregar mensaje del usuario al historial
    const updatedMessages = [
      ...messages,
      { role: 'user' as const, content: message, ts: new Date().toISOString() }
    ]

    // Llamar a Claude
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
          name: 'crear_pedido',
          description: 'Crea un pedido confirmado cuando el cliente aprobó todos los ítems, precio, dirección y commune',
          input_schema: {
            type: 'object' as const,
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    product_name: { type: 'string' },
                    qty: { type: 'number' },
                    unit_price: { type: 'number' },
                    unit: { type: 'string' },
                  },
                  required: ['product_name', 'qty', 'unit_price', 'unit'],
                },
              },
              address: { type: 'string', description: 'Dirección completa del cliente' },
              commune: { type: 'string', description: 'Comuna del cliente' },
              notes: { type: 'string', description: 'Notas adicionales del pedido' },
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

    // Procesar tool calls
    for (const block of response.content) {
      if (block.type === 'text') {
        assistantText = block.text
      }
      if (block.type === 'tool_use') {
        if (block.name === 'crear_pedido') {
          const input = block.input as {
            items: { product_name: string; qty: number; unit_price: number; unit: string }[]
            address: string
            commune: string
            notes?: string
          }
          const total = input.items.reduce((sum: number, i) => sum + i.unit_price * i.qty, 0)
          const { data: order } = await supabase.from('orders').insert({
            channel: 'whatsapp',
            status: 'nuevo',
            items: input.items,
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

    // Guardar conversación actualizada
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
