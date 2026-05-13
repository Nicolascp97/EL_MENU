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
 *
 * Hacemos `tx.commit(token_ws)` para finalizar la transacción y actualizamos
 * el pedido. Después redirigimos a /checkout/confirmacion?status=...&orderId=...
 */
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
      .select('id')
      .maybeSingle()

    return NextResponse.redirect(
      `${appUrl}/checkout/confirmacion?status=${authorized ? 'success' : 'failed'}${
        order ? `&orderId=${order.id}` : ''
      }`,
      { status: 303 }
    )
  } catch {
    // Si commit falla, marcamos el order como fallido si lo encontramos.
    await admin
      .from('orders')
      .update({ payment_status: 'fallido', status: 'cancelado' })
      .eq('transbank_token', tokenWs)
    return NextResponse.redirect(`${appUrl}/checkout/confirmacion?status=error`, { status: 303 })
  }
}

export const POST = handleReturn
export const GET = handleReturn
