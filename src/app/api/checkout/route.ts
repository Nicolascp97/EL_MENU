import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buyOrderFromUuid, createWebpayPlus } from '@/lib/transbank'
import type { UserRole, OrderItem } from '@/types/database'

type Body = {
  items: { product_id: string; qty: number }[]
  address: string
  commune: string
  phone: string
  notes?: string
}

export async function POST(req: Request) {
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

  // Identificar al usuario (puede ser invitado)
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
  const useWholesale = role === 'mayorista' || role === 'admin'

  // Service role para no depender de RLS al leer products/zones.
  const admin = createAdminClient()

  const productIds = body.items.map(i => i.product_id)
  const { data: products, error: pErr } = await admin
    .from('products')
    .select('id, name, price, price_wholesale, unit, stock, active, wholesale_only')
    .in('id', productIds)
  if (pErr || !products) {
    return NextResponse.json({ error: 'No pude consultar los productos.' }, { status: 500 })
  }

  const { data: zone } = await admin
    .from('zones')
    .select('*')
    .contains('communes', [body.commune])
    .maybeSingle()
  if (!zone) {
    return NextResponse.json({ error: `No despachamos a ${body.commune} todavía.` }, { status: 400 })
  }

  // Recalcular precios del servidor (no confiar en el cliente).
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

  const minOrder = useWholesale ? zone.min_order_wholesale : zone.min_order
  if (subtotal < minOrder) {
    const falta = minOrder - subtotal
    return NextResponse.json({
      error: `Pedido mínimo $${minOrder.toLocaleString('es-CL')}. Te faltan $${falta.toLocaleString('es-CL')}.`,
    }, { status: 400 })
  }

  const total = subtotal + zone.delivery_price

  // Crear order con payment_status = 'pendiente'
  const { data: order, error: oErr } = await admin
    .from('orders')
    .insert({
      user_id: user?.id ?? null,
      channel: 'web',
      status: 'nuevo',
      items: orderItems,
      total,
      address: body.address.trim(),
      commune: body.commune,
      phone: body.phone.trim(),
      notes: body.notes?.trim() || null,
      payment_status: 'pendiente',
    })
    .select()
    .single()
  if (oErr || !order) {
    return NextResponse.json({ error: 'No pude crear el pedido.' }, { status: 500 })
  }

  // Iniciar transacción Transbank
  const buyOrder = buyOrderFromUuid(order.id)
  const sessionId = `s${Date.now()}`.slice(0, 61)
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || `http://${req.headers.get('host') ?? 'localhost:3000'}`
  const returnUrl = `${appUrl}/api/transbank/return`

  try {
    const tx = createWebpayPlus()
    const tbk = await tx.create(buyOrder, sessionId, total, returnUrl)

    // Guardar token para matchear cuando vuelva el callback.
    await admin.from('orders').update({ transbank_token: tbk.token }).eq('id', order.id)

    return NextResponse.json({
      orderId: order.id,
      url: tbk.url,
      token: tbk.token,
    })
  } catch (e) {
    // Rollback lógico: marcamos el pedido como cancelado.
    await admin
      .from('orders')
      .update({ status: 'cancelado', payment_status: 'fallido' })
      .eq('id', order.id)
    const msg = e instanceof Error ? e.message : 'Error iniciando pago.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
