import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'node:crypto'

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
  const waNumber = process.env.NEXT_PUBLIC_WA_NUMBER
  if (!apiKey || !waNumber) return

  const itemLines = (order.items ?? [])
    .slice(0, 4)
    .map(i => `• ${i.product_name} x${i.qty} ${i.unit}`)
    .join('\n')
  const extra = order.items.length > 4 ? `\n+${order.items.length - 4} productos más` : ''

  const msg = [
    `🥦 NUEVO PEDIDO El Menú (Amipass)`,
    `#${order.id.slice(0, 8).toUpperCase()}`,
    `💰 $${order.total.toLocaleString('es-CL')}`,
    `📱 ${order.phone}`,
    `📍 ${order.commune} — ${order.address}`,
    ``,
    itemLines + extra,
  ].join('\n')

  const url = `https://api.callmebot.com/whatsapp.php?phone=${waNumber}&text=${encodeURIComponent(msg)}&apikey=${apiKey}`
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), 5000)
  try {
    await fetch(url, { signal: controller.signal })
  } catch {
    // No crítico
  } finally {
    clearTimeout(id)
  }
}

/**
 * Webhook de Amipass/Pluxee.
 *
 * Este endpoint se configura como "returnUrl" al crear la transacción.
 * Amipass puede invocar tanto GET (redirect del usuario) como POST
 * (notificación server-to-server). Ambos se manejan aquí.
 *
 * TODO: ajusta los nombres de campos según la documentación real de Amipass:
 *  - Nombre del campo que contiene el orderId (puede ser "orderId", "external_ref", etc.)
 *  - Nombre del campo de estado ("status", "result", "transactionStatus", etc.)
 *  - Valor para aprobado ("approved", "APPROVED", "00", etc.)
 *  - Header de firma ("x-amipass-signature", "x-signature", etc.)
 */
async function handleWebhook(req: NextRequest): Promise<Response> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    return NextResponse.json({ error: 'Configuración incompleta.' }, { status: 500 })
  }

  let orderId: string | null = null
  let approved = false
  let rawBody = ''

  if (req.method === 'POST') {
    const contentType = req.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      rawBody = await req.text()
      const data = JSON.parse(rawBody) as { orderId?: string; status?: string }
      orderId = data.orderId ?? null
      // TODO: ajusta el valor de estado aprobado según la API real
      approved = data.status?.toUpperCase() === 'APPROVED'
    } else {
      // form-encoded
      const form = await req.formData()
      orderId = (form.get('orderId') as string) ?? null
      approved = (form.get('status') as string)?.toUpperCase() === 'APPROVED'
    }
  } else {
    // GET — redirect del navegador del usuario
    const url = new URL(req.url)
    orderId = url.searchParams.get('orderId')
    approved = url.searchParams.get('status')?.toUpperCase() === 'APPROVED'
  }

  if (!orderId) {
    return NextResponse.redirect(`${appUrl}/checkout/confirmacion?status=error`, { status: 303 })
  }

  // Verificación de firma HMAC-SHA256 (solo en POST con body)
  const secretKey = process.env.AMIPASS_SECRET_KEY
  if (secretKey && req.method === 'POST' && rawBody) {
    // TODO: ajusta el header de firma según la documentación de Amipass
    const receivedSig = req.headers.get('x-amipass-signature') ?? ''
    if (receivedSig) {
      const expectedSig = crypto
        .createHmac('sha256', secretKey)
        .update(rawBody)
        .digest('hex')
      if (receivedSig !== expectedSig) {
        console.error('[Amipass] Firma de webhook inválida')
        return NextResponse.json({ error: 'Firma inválida.' }, { status: 401 })
      }
    }
  }

  const admin = createAdminClient()

  const { data: order } = await admin
    .from('orders')
    .select('id, payment_status, total, phone, commune, address, items')
    .eq('id', orderId)
    .eq('payment_method', 'amipass')
    .maybeSingle()

  if (!order) {
    return NextResponse.redirect(`${appUrl}/checkout/confirmacion?status=error`, { status: 303 })
  }

  // Idempotencia: si ya se procesó, redirigir al estado correcto
  if (order.payment_status !== 'pendiente') {
    const redirectStatus = order.payment_status === 'pagado' ? 'success' : 'failed'
    return NextResponse.redirect(
      `${appUrl}/checkout/confirmacion?status=${redirectStatus}&orderId=${order.id}`,
      { status: 303 }
    )
  }

  // Actualizar solo si sigue pendiente (guard de idempotencia)
  await admin
    .from('orders')
    .update({
      payment_status: approved ? 'pagado' : 'fallido',
      status: approved ? 'nuevo' : 'cancelado',
    })
    .eq('id', orderId)
    .eq('payment_status', 'pendiente')

  if (approved) {
    notifyWhatsApp(order as OrderRow).catch(() => {})
  }

  return NextResponse.redirect(
    `${appUrl}/checkout/confirmacion?status=${approved ? 'success' : 'failed'}&orderId=${orderId}`,
    { status: 303 }
  )
}

export const POST = handleWebhook
export const GET = handleWebhook
