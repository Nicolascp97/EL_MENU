import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { UserRole, OrderItem } from '@/types/database'

type Body = {
  items: { product_id: string; qty: number }[]
  address: string
  commune: string
  phone: string
  name: string
  notes?: string
}

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
    `🥦 PEDIDO POR TRANSFERENCIA — El Menú`,
    `#${order.id.slice(0, 8).toUpperCase()}`,
    `💰 $${order.total.toLocaleString('es-CL')}`,
    `📱 ${order.phone}`,
    `📍 ${order.commune} — ${order.address}`,
    `⚠️ Pendiente de confirmación de pago`,
    ``,
    itemLines + extra,
  ].join('\n')

  const url = `https://api.callmebot.com/whatsapp.php?phone=${waNumber}&text=${encodeURIComponent(msg)}&apikey=${apiKey}`
  await fetch(url).catch(() => {})
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
      return NextResponse.json({ error: `${p.name}: solo quedan ${p.stock} ${p.unit}.` }, { status: 400 })
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

  notifyWhatsApp(order as OrderRow).catch(() => {})

  return NextResponse.json({ ok: true, orderId: order.id })
}
