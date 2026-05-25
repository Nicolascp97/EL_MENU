import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createWebpayPlus } from '@/lib/transbank'

/**
 * Endpoint de retorno que Transbank invoca después del flujo de pago.
 *
 * Casos posibles:
 * 1. Pago completado              → form POST con `token_ws` (sin TBK_TOKEN).
 * 2. Pago cancelado por el usuario→ form POST con `TBK_TOKEN` (sin token_ws).
 * 3. Error en formulario de pago  → llegan AMBOS: token_ws + TBK_TOKEN.
 *    (usuario hizo click en "intentar nuevamente" tras error de pantalla)
 *    → NO hacer commit; marcar como fallido.
 * 4. Timeout (>5 min sin acción)  → llega solo TBK_ORDEN_COMPRA + TBK_ID_SESION.
 *    → buscar orden por buy_order y marcar como cancelado.
 */

type OrderRow = {
  id: string
  total: number
  phone: string
  commune: string
  address: string
  items: { product_name: string; qty: number; unit: string }[]
}

/** Traduce el código de tipo de pago de Transbank a texto legible. */
function traducirTipoPago(code: string | undefined): string {
  switch (code) {
    case 'VD': return 'Débito / Redcompra'
    case 'VN': return 'Crédito — Sin cuotas'
    case 'VC': return 'Crédito — Con cuotas'
    case 'S2': return 'Crédito — 2 cuotas sin interés'
    case 'SI': return 'Sin interés'
    case 'NC': return 'N cuotas sin interés'
    case 'P':  return 'Prepago'
    default:   return code ?? 'Tarjeta'
  }
}

async function notifyWhatsApp(order: OrderRow) {
  const apiKey = process.env.CALLMEBOT_API_KEY
  const phone  = process.env.NEXT_PUBLIC_WA_NUMBER
  if (!apiKey || !phone) return

  const itemLines = (order.items ?? [])
    .slice(0, 4)
    .map(i => `• ${i.product_name} x${i.qty} ${i.unit}`)
    .join('\n')
  const extra = order.items.length > 4 ? `\n+${order.items.length - 4} productos más` : ''

  const msg = [
    `🥦 NUEVO PEDIDO El Menú`,
    `#${order.id.slice(0, 8).toUpperCase()}`,
    `💰 $${order.total.toLocaleString('es-CL')}`,
    `📱 ${order.phone}`,
    `📍 ${order.commune} — ${order.address}`,
    ``,
    itemLines + extra,
  ].join('\n')

  const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(msg)}&apikey=${apiKey}`
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), 5000)
  try {
    await fetch(url, { signal: controller.signal })
  } catch {
    // Ignorar errores de notificación (no críticos)
  } finally {
    clearTimeout(id)
  }
}

async function handleReturn(req: Request): Promise<Response> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    console.error('NEXT_PUBLIC_APP_URL no está configurado')
    return NextResponse.json({ error: 'Configuración del servidor incompleta.' }, { status: 500 })
  }

  let tokenWs:  string | null = null
  let tbkToken: string | null = null
  let tbkOrden: string | null = null   // TBK_ORDEN_COMPRA (presente en timeout y error)

  if (req.method === 'POST') {
    const form = await req.formData()
    tokenWs  = (form.get('token_ws')        as string) ?? null
    tbkToken = (form.get('TBK_TOKEN')       as string) ?? null
    tbkOrden = (form.get('TBK_ORDEN_COMPRA') as string) ?? null
  } else {
    const url = new URL(req.url)
    tokenWs  = url.searchParams.get('token_ws')
    tbkToken = url.searchParams.get('TBK_TOKEN')
    tbkOrden = url.searchParams.get('TBK_ORDEN_COMPRA')
  }

  const admin = createAdminClient()

  // ── Caso 3: Error en formulario — llegan AMBOS tokens ───────────────────────
  // Transbank envía token_ws + TBK_TOKEN cuando el usuario hace "intentar nuevamente"
  // tras un error en pantalla. NO se debe hacer commit; es una sesión inválida.
  if (tokenWs && tbkToken) {
    console.warn('[Transbank] Error en formulario: llegaron token_ws y TBK_TOKEN juntos. Abortando.')
    await admin
      .from('orders')
      .update({ payment_status: 'fallido', status: 'cancelado' })
      .eq('transbank_token', tokenWs)
      .eq('payment_status', 'pendiente')
    return NextResponse.redirect(`${appUrl}/checkout/confirmacion?status=error`, { status: 303 })
  }

  // ── Caso 2: Cancelado por el usuario — solo TBK_TOKEN ───────────────────────
  if (tbkToken && !tokenWs) {
    const { data: order } = await admin
      .from('orders')
      .update({ payment_status: 'fallido', status: 'cancelado' })
      .eq('transbank_token', tbkToken)
      .select('id')
      .maybeSingle()
    return NextResponse.redirect(
      `${appUrl}/checkout/confirmacion?status=cancelled${order ? `&orderId=${order.id}` : ''}`,
      { status: 303 }
    )
  }

  // ── Caso 4: Timeout — solo TBK_ORDEN_COMPRA, sin tokens ─────────────────────
  // El usuario abrió el formulario pero no hizo nada por más de 5 minutos.
  if (!tokenWs && !tbkToken) {
    if (tbkOrden) {
      // Buscar la orden pendiente cuyo buy_order coincide.
      // buy_order = uuid.replace(/-/g,'').slice(0,26), así que buscamos en órdenes
      // recientes (últimos 15 min) y comparamos en memoria.
      const since = new Date(Date.now() - 15 * 60 * 1000).toISOString()
      const { data: recientes } = await admin
        .from('orders')
        .select('id')
        .eq('payment_status', 'pendiente')
        .gte('created_at', since)

      const match = recientes?.find(
        o => o.id.replace(/-/g, '').slice(0, 26) === tbkOrden
      )

      if (match) {
        await admin
          .from('orders')
          .update({ payment_status: 'fallido', status: 'cancelado' })
          .eq('id', match.id)
          .eq('payment_status', 'pendiente')

        return NextResponse.redirect(
          `${appUrl}/checkout/confirmacion?status=cancelled&orderId=${match.id}`,
          { status: 303 }
        )
      }
    }
    // Sin TBK_ORDEN_COMPRA o sin match → redirigir a error genérico
    return NextResponse.redirect(`${appUrl}/checkout/confirmacion?status=error`, { status: 303 })
  }

  // ── Caso 1: Pago completado/rechazado — solo token_ws ───────────────────────
  try {
    // 1. Verificar idempotencia: solo procesar si aún está pendiente
    const { data: existingOrder } = await admin
      .from('orders')
      .select('id, payment_status, total, phone, commune, address, items')
      .eq('transbank_token', tokenWs)
      .maybeSingle()

    if (!existingOrder) {
      return NextResponse.redirect(`${appUrl}/checkout/confirmacion?status=error`, { status: 303 })
    }

    if (existingOrder.payment_status !== 'pendiente') {
      const status = existingOrder.payment_status === 'pagado' ? 'success' : 'failed'
      return NextResponse.redirect(
        `${appUrl}/checkout/confirmacion?status=${status}&orderId=${existingOrder.id}`,
        { status: 303 }
      )
    }

    const tx     = createWebpayPlus()
    const result = await tx.commit(tokenWs!)

    const authorized =
      result?.response_code === 0 && String(result?.status).toUpperCase() === 'AUTHORIZED'

    // 2. Verificar que el monto coincida
    if (authorized && result.amount !== existingOrder.total) {
      console.error(`[Transbank] Monto no coincide: esperado ${existingOrder.total}, recibido ${result.amount}. Order: ${existingOrder.id}`)
      await admin.from('orders')
        .update({ payment_status: 'fallido', status: 'cancelado' })
        .eq('id', existingOrder.id)
        .eq('payment_status', 'pendiente')
      return NextResponse.redirect(`${appUrl}/checkout/confirmacion?status=error`, { status: 303 })
    }

    // 3. Extraer datos del comprobante (requeridos por Transbank para validación)
    const cardLast4 = result?.card_detail?.card_number
      ? String(result.card_detail.card_number).slice(-4)
      : null

    const transbankFields = authorized ? {
      transbank_authorization_code: result.authorization_code ?? null,
      transbank_card_last4:         cardLast4,
      transbank_payment_type:       result.payment_type_code ?? null,
      transbank_installments:       result.installments_number ?? 0,
      transbank_transaction_date:   result.transaction_date ?? null,
    } : {}

    // 4. Actualizar solo si sigue pendiente (guard idempotencia)
    const { data: order } = await admin
      .from('orders')
      .update({
        payment_status: authorized ? 'pagado' : 'fallido',
        status:         authorized ? 'nuevo'  : 'cancelado',
        ...transbankFields,
      })
      .eq('transbank_token', tokenWs!)
      .eq('payment_status', 'pendiente')
      .select('id, total, phone, commune, address, items')
      .maybeSingle()

    if (authorized && order) {
      notifyWhatsApp(order as OrderRow).catch(() => {})
    }

    return NextResponse.redirect(
      `${appUrl}/checkout/confirmacion?status=${authorized ? 'success' : 'failed'}${
        order ? `&orderId=${order.id}` : `&orderId=${existingOrder.id}`
      }`,
      { status: 303 }
    )
  } catch (err) {
    // En catch: NO cancelar automáticamente — puede que el pago sí se haya procesado
    console.error('[Transbank] Error en commit:', err)
    return NextResponse.redirect(`${appUrl}/checkout/confirmacion?status=error`, { status: 303 })
  }
}

// Transbank usa POST en producción, pero en integración puede redirigir con GET
export const POST = handleReturn
export const GET  = handleReturn
