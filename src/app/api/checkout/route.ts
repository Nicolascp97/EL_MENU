import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buyOrderFromUuid, createWebpayPlus } from '@/lib/transbank'
import { checkOrigin } from '@/lib/csrf'
import type { UserRole, OrderItem } from '@/types/database'

type Body = {
  items: { product_id: string; qty: number }[]
  address: string
  commune: string
  phone: string
  name: string
  notes?: string
  is_mayorista?: boolean
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_ITEMS = 50
const MIN_MAYORISTA = 60_000

export async function POST(req: NextRequest) {
  // Feature flag: WEBPAY_ENABLED=false desactiva el pago con tarjeta temporalmente
  if (process.env.WEBPAY_ENABLED === 'false') {
    return NextResponse.json(
      { error: 'El pago con tarjeta no está disponible en este momento. Por favor usa transferencia bancaria.' },
      { status: 503 }
    )
  }

  const csrfError = checkOrigin(req)
  if (csrfError) return csrfError

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    console.error('NEXT_PUBLIC_APP_URL no está configurado')
    return NextResponse.json({ error: 'Configuración del servidor incompleta.' }, { status: 500 })
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (!body.items?.length) {
    return NextResponse.json({ error: 'Tu carrito está vacío.' }, { status: 400 })
  }
  if (!body.address?.trim() || !body.commune?.trim() || !body.phone?.trim()) {
    return NextResponse.json({ error: 'Completá dirección, comuna y teléfono.' }, { status: 400 })
  }

  if (body.items.length > MAX_ITEMS) {
    return NextResponse.json({ error: 'Demasiados productos en el carrito.' }, { status: 400 })
  }
  if (body.items.some(i => !UUID_RE.test(i.product_id))) {
    return NextResponse.json({ error: 'Producto inválido.' }, { status: 400 })
  }
  if (body.address.trim().length > 200) {
    return NextResponse.json({ error: 'Dirección demasiado larga.' }, { status: 400 })
  }
  if (body.phone.trim().length > 20) {
    return NextResponse.json({ error: 'Teléfono inválido.' }, { status: 400 })
  }
  if (body.notes && body.notes.length > 500) {
    return NextResponse.json({ error: 'Las notas no pueden superar 500 caracteres.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let role: UserRole = 'minorista'
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profile?.role) role = profile.role as UserRole
  }
  const useWholesale = role === 'mayorista' || role === 'admin' || body.is_mayorista === true

  const admin = createAdminClient()

  const productIds = body.items.map(i => i.product_id)
  const { data: products, error: pErr } = await admin
    .from('products')
    .select('id, name, price, price_wholesale, unit, stock, active, wholesale_only')
    .in('id', productIds)
  if (pErr || !products) {
    return NextResponse.json({ error: 'No pude consultar los productos.' }, { status: 500 })
  }

  // Retiro en tienda: no requiere zona ni despacho
  const isPickup = body.commune === 'Retiro en tienda' && body.address === 'Retiro en tienda'

  let zone: { delivery_price: number; min_order: number; min_order_wholesale: number } | null = null
  if (!isPickup) {
    const { data: zoneData } = await admin
      .from('zones')
      .select('*')
      .contains('communes', [body.commune])
      .maybeSingle()
    if (!zoneData) {
      return NextResponse.json({ error: `No despachamos a ${body.commune} todavía.` }, { status: 400 })
    }
    zone = zoneData
  }

  const orderItems: OrderItem[] = []
  let subtotal = 0
  for (const it of body.items) {
    const p = products.find(x => x.id === it.product_id)
    if (!p) {
      return NextResponse.json({ error: 'Hay un producto que ya no existe en el catálogo.' }, { status: 400 })
    }
    if (!p.active) {
      return NextResponse.json({ error: `${p.name} ya no está disponible.` }, { status: 400 })
    }
    if (p.wholesale_only && !useWholesale) {
      return NextResponse.json({ error: `${p.name} es solo para cuentas empresa.` }, { status: 403 })
    }
    const qty = Math.floor(Number(it.qty) || 0)
    if (qty <= 0) {
      return NextResponse.json({ error: `Cantidad inválida para ${p.name}.` }, { status: 400 })
    }
    if (qty > p.stock) {
      return NextResponse.json({
        error: `${p.name}: solo quedan ${p.stock} ${p.unit}.`,
      }, { status: 400 })
    }
    const unitPrice = useWholesale && p.price_wholesale != null ? p.price_wholesale : p.price
    orderItems.push({
      product_id: p.id,
      product_name: p.name,
      qty,
      unit_price: unitPrice,
      unit: p.unit,
    })
    subtotal += unitPrice * qty
  }

  const minOrder = useWholesale
    ? MIN_MAYORISTA
    : (zone?.min_order ?? 0)
  if (subtotal < minOrder) {
    const falta = minOrder - subtotal
    return NextResponse.json({
      error: `Pedido mínimo $${minOrder.toLocaleString('es-CL')}. Te faltan $${falta.toLocaleString('es-CL')}.`,
    }, { status: 400 })
  }

  const total = subtotal + (zone?.delivery_price ?? 0)

  const { data: order, error: oErr } = await admin
    .from('orders')
    .insert({
      user_id: user?.id ?? null,
      channel: 'web',
      status: 'nuevo',
      items: orderItems,
      total,
      name: body.name?.trim() || null,
      customer_type: useWholesale ? 'mayorista' : 'minorista',
      address: body.address.trim(),
      commune: body.commune,
      phone: body.phone.trim(),
      notes: body.notes?.trim() || null,
      payment_status: 'pendiente',
      payment_method: 'webpay',
    })
    .select()
    .single()
  if (oErr || !order) {
    return NextResponse.json({ error: 'No pude crear el pedido.' }, { status: 500 })
  }

  const buyOrder = buyOrderFromUuid(order.id)
  const sessionId = `s${Date.now()}`.slice(0, 61)
  const returnUrl = `${appUrl}/api/transbank/return`

  try {
    const tx = createWebpayPlus()
    const tbk = await tx.create(buyOrder, sessionId, total, returnUrl)

    await admin.from('orders').update({ transbank_token: tbk.token }).eq('id', order.id)

    return NextResponse.json({
      orderId: order.id,
      url: tbk.url,
      token: tbk.token,
    })
  } catch (e) {
    await admin
      .from('orders')
      .update({ status: 'cancelado', payment_status: 'fallido' })
      .eq('id', order.id)
    console.error('[Transbank] Error al iniciar transacción:', e)
    return NextResponse.json({ error: 'Error al iniciar el pago. Por favor intenta nuevamente.' }, { status: 500 })
  }
}
