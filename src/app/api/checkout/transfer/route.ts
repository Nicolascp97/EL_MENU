import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkOrigin } from '@/lib/csrf'
import { notifyPedidoTransferencia, notifyStockBajo } from '@/lib/notify'
import type { UserRole, OrderItem } from '@/types/database'

type Body = {
  items: { product_id: string; qty: number }[]
  address: string
  commune: string
  phone: string
  name: string
  notes?: string
}

// Rate limiting: máx 3 órdenes transfer/hora/IP
const transferRateMap = new Map<string, { count: number; resetAt: number }>()

function checkTransferRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = transferRateMap.get(ip)
  if (!entry || now > entry.resetAt) {
    transferRateMap.set(ip, { count: 1, resetAt: now + 3_600_000 })
    return true
  }
  if (entry.count >= 3) return false
  entry.count++
  return true
}


const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_ITEMS = 50

export async function POST(req: NextRequest) {
  const csrfError = checkOrigin(req)
  if (csrfError) return csrfError

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (process.env.NODE_ENV !== 'development' && !checkTransferRateLimit(ip)) {
    return NextResponse.json({
      error: 'Has realizado demasiadas solicitudes de transferencia. Intenta más tarde o contáctanos por WhatsApp.',
    }, { status: 429 })
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

  if (zone) {
    const minOrder = useWholesale ? zone.min_order_wholesale : zone.min_order
    if (subtotal < minOrder) {
      const falta = minOrder - subtotal
      return NextResponse.json({
        error: `Pedido mínimo $${minOrder.toLocaleString('es-CL')}. Te faltan $${falta.toLocaleString('es-CL')}.`,
      }, { status: 400 })
    }
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
      address: body.address.trim(),
      commune: body.commune,
      phone: body.phone.trim(),
      notes: body.notes?.trim() || null,
      payment_status: 'pendiente',
      payment_method: 'transfer',
    })
    .select()
    .single()
  if (oErr || !order) {
    return NextResponse.json({ error: 'No pude crear el pedido.' }, { status: 500 })
  }

  // Notificar nuevo pedido
  notifyPedidoTransferencia(order).catch(() => {})

  // Alerta de stock bajo: productos con ≤5 unidades después del pedido
  const updatedIds = orderItems.map(i => i.product_id)
  admin.from('products')
    .select('name, stock, unit')
    .in('id', updatedIds)
    .lte('stock', 5)
    .then(({ data }) => {
      if (data?.length) notifyStockBajo(data).catch(() => {})
    })
    .catch(() => {})

  return NextResponse.json({ ok: true, orderId: order.id })
}
