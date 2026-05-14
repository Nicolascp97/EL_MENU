import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createWebpayPlus } from '@/lib/transbank'

/**
 * Endpoint de retorno que Transbank invoca después del flujo de pago.
 *
 * Casos posibles:
 * 1. Pago completado → form POST con `token_ws`.
 * 2. Pago cancelado por el usuario → form POST con `TBK_TOKEN`.
 * 3. Timeout o error → puede llegar GET con TBK_TOKEN/TBK_ORDEN_COMPRA.
 */

type OrderRow = {
  id: string
  total: number
  phone: string
  commune: string
  address: string
  items: { product_name: string; qty: number; unit: string }[]
}

async function notifyWhatsApp(order: OrderRow) {
  const apiKey = process.env.CALLMEBOT_API_KEY
  const phone = process.env.NEXT_PUBLIC_WA_NUMBER
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
  await fetch(url).catch(() => {})
}

async function handleReturn(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || `${url.protocol}//${url.host}`

  let tokenWs: string | null = null
  let tbkToken: string | null = null

  if (req.method === 'POST') {
    const form = await req.formData()
    tokenWs = (form.get('token_ws') as string) ?? null
    tbkToken = (form.get('TBK_TOKEN') as string) ?? null
  } else {
    tokenWs = url.searchParams.get('token_ws')
    tbkToken = url.searchParams.get('TBK_TOKEN')
  }

  const admin = createAdminClient()

  // Usuario canceló desde la pantalla de Transbank.
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

  if (!tokenWs) {
    return NextResponse.redirect(`${appUrl}/checkout/confirmacion?status=error`, { status: 303 })
  }

  try {
    const tx = createWebpayPlus()
    const result = await tx.commit(tokenWs)

    const authorized =
      result?.response_code === 0 && String(result?.status).toUpperCase() === 'AUTHORIZED'

    const { data: order } = await admin
      .from('orders')
      .update({
        payment_status: authorized ? 'pagado' : 'fallido',
        status: authorized ? 'nuevo' : 'cancelado',
      })
      .eq('transbank_token', tokenWs)
      .select('id, total, phone, commune, address, items')
      .maybeSingle()

    // Notificar al local por WhatsApp cuando el pago es exitoso
    if (authorized && order) {
      notifyWhatsApp(order as OrderRow).catch(() => {})
    }

    return NextResponse.redirect(
      `${appUrl}/checkout/confirmacion?status=${authorized ? 'success' : 'failed'}${
        order ? `&orderId=${order.id}` : ''
      }`,
      { status: 303 }
    )
  } catch {
    await admin
      .from('orders')
      .update({ payment_status: 'fallido', status: 'cancelado' })
      .eq('transbank_token', tokenWs)
    return NextResponse.redirect(`${appUrl}/checkout/confirmacion?status=error`, { status: 303 })
  }
}

export const POST = handleReturn
export const GET = handleReturn
