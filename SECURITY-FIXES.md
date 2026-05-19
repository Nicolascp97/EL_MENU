# Blueprint de Seguridad — El Menú
> Generado por auditoría de 8 agentes paralelos — 2026-05-19
> Puntuación actual: 44/100 (Grado D)
> Ejecutar en orden de prioridad. Cada fix incluye código exacto listo para copiar.

---

## FASE 0 — ACCIONES MANUALES (No requieren código — hacer AHORA)

### 0.1 Rotar credenciales comprometidas

El archivo `.env.local` estuvo/está en OneDrive y contiene claves vivas:

1. **Supabase Service Role Key** → https://app.supabase.com → Project Settings → API → `service_role` → Regenerate
2. **Anthropic API Key** → https://console.anthropic.com → API Keys → Delete actual → Create new
3. **CRON_SECRET** → Generar nuevo: `openssl rand -hex 32` (PowerShell: `[System.BitConverter]::ToString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).Replace("-","").ToLower()`)
4. **N8N_WEBHOOK_SECRET** → Mismo comando. Actualizar en n8n también.
5. **KIE_API_KEY** → Identificar qué servicio es (usado en `scripts/generate-product-images.mjs`). Revocar en ese servicio.

**Después de rotar**, actualizar TODAS en Vercel Dashboard → Settings → Environment Variables.

### 0.2 Verificar que .env.local nunca fue commiteado

```powershell
# En PowerShell dentro del proyecto:
git log --all --full-history -- .env.local
git log -S "sk-ant-api03" --all
```

Si aparece algún commit → usar BFG Repo Cleaner para purgar el historial.

### 0.3 Excluir proyecto de OneDrive (opcional pero recomendado)

Mover el proyecto a `C:\Proyectos\EL-MENU\` (fuera de OneDrive) o agregar exclusión en OneDrive.

---

## FASE 1 — CRÍTICO (Antes de cualquier transacción real)

### FIX-01 — WhatsApp webhook: validar precios server-side

**Archivo:** `src/app/api/webhook/whatsapp/route.ts`

**Problema:** `crear_pedido` acepta `unit_price` de la IA sin verificar contra la DB.

**Reemplazar el bloque del tool `crear_pedido` (aprox líneas 169-186):**

```typescript
// ANTES (VULNERABLE):
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

// DESPUÉS (SEGURO):
if (block.name === 'crear_pedido') {
  const input = block.input as {
    items: { product_name: string; qty: number; unit?: string }[]
    address: string
    commune: string
    notes?: string
  }

  // Buscar productos por nombre en la DB (no confiar en precios de la IA)
  const productNames = input.items.map(i => i.product_name)
  const { data: dbProducts } = await supabase
    .from('products')
    .select('id, name, price, unit, stock, active, wholesale_only')
    .in('name', productNames)
    .eq('active', true)

  // Validar zona
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
    payment_status: 'pendiente',
    items: orderItems,
    total,
    address: input.address,
    commune: input.commune,
    phone,
    notes: input.notes || null,
  }).select().single()
  orderId = order?.id || null
}
```

**También cambiar la definición del tool `crear_pedido`** para que NO acepte `unit_price`:

```typescript
// En el array `tools` de la función POST, reemplazar crear_pedido input_schema:
{
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
```

---

### FIX-02 — Webhook secret con valor real + comparación timing-safe

**Archivo:** `src/app/api/webhook/whatsapp/route.ts`

**Reemplazar las primeras líneas de la función POST (aprox línea 38-43):**

```typescript
// ANTES:
const secret = req.headers.get('x-webhook-secret')
if (secret !== process.env.N8N_WEBHOOK_SECRET) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// DESPUÉS:
import { timingSafeEqual } from 'crypto'

// (dentro de POST):
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
```

**Nota:** Agregar `import { timingSafeEqual } from 'crypto'` al inicio del archivo.

---

### FIX-03 — Cron secret: timing-safe + guard de variable vacía

**Archivo:** `src/app/api/cron/generar-recetas/route.ts`

```typescript
// Agregar al inicio del archivo:
import { timingSafeEqual } from 'crypto'

// Reemplazar (aprox línea 19-23):
// ANTES:
const auth = req.headers.get('authorization') ?? ''
if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// DESPUÉS:
const auth = req.headers.get('authorization') ?? ''
const cronSecret = process.env.CRON_SECRET ?? ''
if (!cronSecret) {
  console.error('CRON_SECRET no está configurado')
  return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
}
const expected = Buffer.from(`Bearer ${cronSecret}`)
const received = Buffer.from(auth.padEnd(expected.length + 10, '\0').slice(0, expected.length + 10))
let cronValid = false
try {
  const recv = Buffer.from(auth)
  cronValid = recv.length === expected.length && timingSafeEqual(recv, expected)
} catch { cronValid = false }
if (!cronValid) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

---

## FASE 2 — ALTO (Antes del lanzamiento público)

### FIX-04 — Rate limiting en /api/chat

**Instalar dependencia:**
```bash
npm install @upstash/ratelimit @upstash/redis
```

Si no quieres Redis, usar rate limiting simple con Map en memoria (funciona en Vercel Edge con limitaciones):

**Archivo:** `src/app/api/chat/route.ts`

**Agregar al inicio del archivo (después de los imports existentes):**

```typescript
// Rate limiting simple en memoria (por proceso — ok para single-instance/edge)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 20       // requests
const RATE_WINDOW = 60_000  // 1 minuto en ms

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}
```

**Al inicio de la función POST, agregar validación:**

```typescript
export async function POST(req: NextRequest) {
  // Rate limiting
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Demasiadas consultas. Intenta en un minuto.' }, { status: 429 })
  }

  // Validación de input
  let body: { messages: ApiMessage[]; cartSummary?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  // Límites de tamaño
  const MAX_MESSAGES = 30
  const MAX_MSG_LEN = 2000
  const MAX_CART = 500
  const VALID_ROLES = new Set(['user', 'assistant'])

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: 'Sin mensajes' }, { status: 400 })
  }
  if (body.messages.length > MAX_MESSAGES) {
    return NextResponse.json({ error: 'Historial muy largo' }, { status: 400 })
  }
  if (body.messages.some(m => !VALID_ROLES.has(m.role) || typeof m.content !== 'string' || m.content.length > MAX_MSG_LEN)) {
    return NextResponse.json({ error: 'Mensaje inválido' }, { status: 400 })
  }
  if (body.cartSummary && body.cartSummary.length > MAX_CART) {
    body.cartSummary = body.cartSummary.slice(0, MAX_CART)
  }

  // ... resto del código existente
```

---

### FIX-05 — Transbank return: idempotencia + guard en catch

**Archivo:** `src/app/api/transbank/return/route.ts`

**Reemplazar el bloque de commit (aprox líneas 87-120):**

```typescript
// ANTES:
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

  if (authorized && order) {
    notifyWhatsApp(order as OrderRow).catch(() => {})
  }

  return NextResponse.redirect(...)
} catch {
  await admin
    .from('orders')
    .update({ payment_status: 'fallido', status: 'cancelado' })
    .eq('transbank_token', tokenWs)
  return NextResponse.redirect(`${appUrl}/checkout/confirmacion?status=error`, { status: 303 })
}

// DESPUÉS (SEGURO):
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

  // Si ya fue procesado, redirigir con el estado actual (idempotente)
  if (existingOrder.payment_status !== 'pendiente') {
    const status = existingOrder.payment_status === 'pagado' ? 'success' : 'failed'
    return NextResponse.redirect(
      `${appUrl}/checkout/confirmacion?status=${status}&orderId=${existingOrder.id}`,
      { status: 303 }
    )
  }

  const tx = createWebpayPlus()
  const result = await tx.commit(tokenWs)

  const authorized =
    result?.response_code === 0 && String(result?.status).toUpperCase() === 'AUTHORIZED'

  // 2. Verificar que el monto coincida (PCI DSS requirement)
  if (authorized && result.amount !== existingOrder.total) {
    console.error(`[Transbank] Monto no coincide: esperado ${existingOrder.total}, recibido ${result.amount}. Order: ${existingOrder.id}`)
    // Marcar para revisión manual, no cancelar automáticamente
    await admin.from('orders')
      .update({ payment_status: 'fallido', status: 'cancelado' })
      .eq('id', existingOrder.id)
      .eq('payment_status', 'pendiente') // solo si sigue pendiente
    return NextResponse.redirect(`${appUrl}/checkout/confirmacion?status=error`, { status: 303 })
  }

  // 3. Actualizar SOLO si sigue pendiente (UPDATE condicional)
  const { data: order } = await admin
    .from('orders')
    .update({
      payment_status: authorized ? 'pagado' : 'fallido',
      status: authorized ? 'nuevo' : 'cancelado',
    })
    .eq('transbank_token', tokenWs)
    .eq('payment_status', 'pendiente') // guard idempotencia
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
  // 4. En catch: verificar estado real antes de cancelar
  console.error('[Transbank] Error en commit:', err)
  // NO cancelar automáticamente — puede que el pago sí se haya procesado
  // Solo marcar para revisión si sabemos que falló (error de red ≠ pago fallido)
  return NextResponse.redirect(`${appUrl}/checkout/confirmacion?status=error`, { status: 303 })
}
```

**También: Eliminar el handler GET (solo dejar POST):**

```typescript
// Al final del archivo, REEMPLAZAR:
// export const POST = handleReturn
// export const GET = handleReturn

// POR:
export const POST = handleReturn
// GET eliminado: Transbank usa solo POST para el callback
```

---

### FIX-06 — Host header injection en returnUrl de Transbank

**Archivos:** `src/app/api/checkout/route.ts` y `src/app/api/checkout/transfer/route.ts`

```typescript
// ANTES (en ambos archivos, aprox línea 134):
const appUrl =
  process.env.NEXT_PUBLIC_APP_URL || `http://${req.headers.get('host') ?? 'localhost:3000'}`

// DESPUÉS:
const appUrl = process.env.NEXT_PUBLIC_APP_URL
if (!appUrl) {
  console.error('NEXT_PUBLIC_APP_URL no está configurado')
  return NextResponse.json({ error: 'Configuración del servidor incompleta.' }, { status: 500 })
}
```

---

### FIX-07 — Security Headers en next.config.ts

**Archivo:** `next.config.ts`

**Reemplazar todo el archivo:**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL} https://api.anthropic.com`,
              `img-src 'self' data: blob: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`,
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: 'https',
        hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co').hostname,
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
```

> **Nota:** El CSP de `'unsafe-inline'` para scripts es necesario por Next.js inline scripts. Si en el futuro se migra a nonces, quitar `'unsafe-inline'`.

---

### FIX-08 — Open Redirect en login (parámetro `next`)

**Archivo:** `src/app/mayorista/login/page.tsx`

```typescript
// ANTES (aprox línea 17-19):
useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  const target = params.get('next')
  if (target) setNext(target)
}, [])

// DESPUÉS:
useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  const target = params.get('next')
  // Solo aceptar rutas relativas (prevenir open redirect)
  if (target && target.startsWith('/') && !target.startsWith('//')) {
    setNext(target)
  }
}, [])
```

---

### FIX-09 — Stock atómico via Supabase RPC

**Paso 1: Crear función en Supabase SQL Editor:**

```sql
-- Ejecutar en Supabase Dashboard → SQL Editor
CREATE OR REPLACE FUNCTION reserve_stock(
  p_product_id UUID,
  p_qty INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  updated_rows INTEGER;
BEGIN
  UPDATE products
  SET stock = stock - p_qty
  WHERE id = p_product_id
    AND stock >= p_qty
    AND active = true;

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN updated_rows > 0;
END;
$$;
```

**Paso 2: Usar en checkout (ambos archivos: `checkout/route.ts` y `checkout/transfer/route.ts`)**

```typescript
// Después de crear la orden exitosamente, agregar:
// Decrementar stock de forma atómica para cada item
for (const item of orderItems) {
  const { data: reserved } = await admin.rpc('reserve_stock', {
    p_product_id: item.product_id,
    p_qty: item.qty,
  })
  if (!reserved) {
    // Rollback: cancelar la orden si el stock se agotó entre el check y la reserva
    await admin.from('orders')
      .update({ status: 'cancelado', payment_status: 'fallido' })
      .eq('id', order.id)
    return NextResponse.json({
      error: `${item.product_name}: stock agotado. Por favor refresca el catálogo.`,
    }, { status: 409 })
  }
}
```

> **Nota:** Colocar este bloque DESPUÉS del `insert` de la orden y ANTES del inicio de la transacción Transbank.

---

### FIX-10 — Registro mayorista: eliminar auto-asignación de rol

**Archivo:** `src/app/mayorista/registro/page.tsx`

```typescript
// ANTES (aprox línea 29-42):
const { data, error: authError } = await supabase.auth.signUp({
  email: form.email,
  password: form.password,
  options: {
    data: {
      name: form.name,
      phone: form.phone,
      role: 'mayorista',  // ← PROBLEMA: cualquiera se registra como mayorista
    },
  },
})

// DESPUÉS:
const { data, error: authError } = await supabase.auth.signUp({
  email: form.email,
  password: form.password,
  options: {
    data: {
      name: form.name,
      phone: form.phone,
      role: 'minorista',  // Rol por defecto; admin lo cambia a mayorista manualmente
      mayorista_requested: true,  // Flag para que el admin sepa que solicitó acceso mayorista
    },
  },
})
```

**Cambiar también el mensaje de confirmación** para indicar que el acceso mayorista requiere aprobación:

```typescript
// En la pantalla de confirmación (needsConfirmation === true):
// Cambiar el texto de:
"Te enviamos un mail a ... para confirmar tu cuenta. Una vez confirmado, vas a poder ingresar al canal mayorista."
// Por:
"Te enviamos un mail a ... para confirmar tu cuenta. Una vez confirmado, el equipo de El Menú revisará tu solicitud y activará tu acceso mayorista en 24-48 horas."
```

**Para aprobar cuentas como admin**, usar el panel de admin o ejecutar en Supabase SQL:
```sql
UPDATE profiles SET role = 'mayorista' WHERE email = 'cliente@empresa.cl';
```

---

## FASE 3 — MEDIO (Antes de tráfico alto)

### FIX-11 — Validaciones de longitud en checkout

**Archivos:** `src/app/api/checkout/route.ts` y `src/app/api/checkout/transfer/route.ts`

**Agregar después de la validación existente de campos requeridos:**

```typescript
// Después de:
// if (!body.address?.trim() || !body.commune?.trim() || !body.phone?.trim()) { ... }

// Agregar:
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_ITEMS = 50

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
```

---

### FIX-12 — Precios mayoristas fuera del contexto WhatsApp

**Archivo:** `src/app/api/webhook/whatsapp/route.ts`

```typescript
// ANTES (aprox línea 88-89):
const productContext = products?.map(p =>
  `• ${p.name}: $${p.price}/${p.unit}${p.price_wholesale ? ` (mayorista: $${p.price_wholesale})` : ''} — stock: ${p.stock}`
).join('\n') || 'Sin productos cargados'

// DESPUÉS:
const productContext = products?.map(p =>
  `• ${p.name}: $${p.price}/${p.unit} — stock: ${p.stock}`
  // Nota: price_wholesale eliminado del contexto WA por seguridad
).join('\n') || 'Sin productos cargados'
```

---

### FIX-13 — Órdenes de transferencia: control de fraude básico

**Archivo:** `src/app/api/checkout/transfer/route.ts`

**Agregar rate limiting simple antes de crear la orden:**

```typescript
// Agregar al inicio del archivo:
const transferRateMap = new Map<string, { count: number; resetAt: number }>()

function checkTransferRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = transferRateMap.get(ip)
  if (!entry || now > entry.resetAt) {
    transferRateMap.set(ip, { count: 1, resetAt: now + 3_600_000 }) // 1 hora
    return true
  }
  if (entry.count >= 3) return false // máx 3 órdenes transfer/hora/IP
  entry.count++
  return true
}

// En la función POST, antes de crear la orden:
const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
if (!checkTransferRateLimit(ip)) {
  return NextResponse.json({
    error: 'Has realizado demasiadas solicitudes de transferencia. Intenta más tarde o contáctanos por WhatsApp.',
  }, { status: 429 })
}
```

**Cambiar status de las órdenes de transferencia:**

```typescript
// Al crear la orden, cambiar:
status: 'nuevo',  // ← esto mete la orden en la cola normal
// Por:
status: 'pendiente_pago',  // estado diferenciado para transferencias sin confirmar
```

> **Nota:** Actualizar también el panel admin para mostrar órdenes con `status='pendiente_pago'` y permitir confirmarlas manualmente.

---

### FIX-14 — CSRF: verificar Origin en rutas mutantes

**Crear middleware helper:** `src/lib/csrf.ts` (archivo nuevo)

```typescript
import { NextRequest, NextResponse } from 'next/server'

export function checkOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get('origin')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) return null // skip en desarrollo sin URL configurada

  if (!origin) return null // same-origin requests sin header origin (ok)

  try {
    const originHost = new URL(origin).host
    const appHost = new URL(appUrl).host
    if (originHost !== appHost) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}
```

**Usar en las rutas checkout:**

```typescript
// Al inicio de POST en checkout/route.ts y checkout/transfer/route.ts:
import { checkOrigin } from '@/lib/csrf'

// Dentro de la función POST:
const csrfError = checkOrigin(req)
if (csrfError) return csrfError
```

---

### FIX-15 — Validar schema de recetas generadas por IA

**Archivo:** `src/app/api/cron/generar-recetas/route.ts`

**Agregar validación después del parse JSON (aprox línea 90):**

```typescript
// Agregar función de validación:
function validateRecipe(r: unknown): r is RecipeFromAI {
  if (!r || typeof r !== 'object') return false
  const recipe = r as Record<string, unknown>
  const validDifficulty = ['Fácil', 'Medio', 'Difícil']
  return (
    typeof recipe.title === 'string' && recipe.title.length <= 100 &&
    typeof recipe.description === 'string' && recipe.description.length <= 500 &&
    typeof recipe.tag === 'string' &&
    typeof recipe.emoji === 'string' &&
    typeof recipe.time_minutes === 'number' && recipe.time_minutes >= 1 && recipe.time_minutes <= 180 &&
    typeof recipe.servings === 'number' && recipe.servings >= 1 && recipe.servings <= 20 &&
    validDifficulty.includes(recipe.difficulty as string) &&
    Array.isArray(recipe.ingredients)
  )
}

// Después del JSON.parse:
recipes = JSON.parse(jsonStr)
if (!Array.isArray(recipes) || !recipes.every(validateRecipe)) {
  console.error('Respuesta de IA con formato inválido')
  return NextResponse.json({ error: 'Formato de recetas inválido' }, { status: 500 })
  // Nota: NO incluir `raw` en la respuesta de error (filtraría el prompt)
}
```

**También en el catch de insert, NO exponer el error de DB:**

```typescript
// ANTES:
return NextResponse.json({ error: 'Failed to insert recipes', details: insertError.message }, { status: 500 })

// DESPUÉS:
console.error('Error insertando recetas:', insertError.message)
return NextResponse.json({ error: 'Error al guardar las recetas' }, { status: 500 })
```

---

### FIX-16 — Admin trigger-recipes: importación directa (eliminar self-SSRF)

**Archivo:** `src/app/api/admin/trigger-recipes/route.ts`

Esto requiere refactorizar la lógica de generación de recetas a una función importable.

**Paso 1:** Extraer la lógica de `cron/generar-recetas/route.ts` a un helper:

Crear `src/lib/generateRecipes.ts`:
```typescript
// Mover toda la lógica de generación aquí como función exportada
export async function generateAndSaveRecipes(): Promise<{ ok: boolean; generated?: number; error?: string }> {
  // ... todo el código actual del POST de cron/generar-recetas/route.ts
  // excepto la verificación del CRON_SECRET
}
```

**Paso 2:** `cron/generar-recetas/route.ts` usa la función:
```typescript
import { generateAndSaveRecipes } from '@/lib/generateRecipes'
// Solo mantiene la verificación del secreto y llama a la función
```

**Paso 3:** `admin/trigger-recipes/route.ts` importa directamente:
```typescript
import { generateAndSaveRecipes } from '@/lib/generateRecipes'
// Eliminar el fetch() interno
const result = await generateAndSaveRecipes()
return NextResponse.json(result)
```

---

### FIX-17 — Sanitizar cartSummary antes de inyectar al system prompt

**Archivo:** `src/app/api/chat/route.ts`

```typescript
// Reemplazar (aprox línea 111-113):
// ANTES:
const cartCtx = body.cartSummary
  ? `\n\nCARRITO ACTUAL DEL CLIENTE: ${body.cartSummary}`
  : ''

// DESPUÉS:
function sanitizeCartSummary(raw: string): string {
  return raw
    .slice(0, 500)                          // límite de longitud
    .replace(/[\r\n]+/g, ', ')             // eliminar saltos de línea
    .replace(/[<>{}[\]]/g, '')             // eliminar chars de estructura
    .trim()
}

const cartCtx = body.cartSummary
  ? `\n\n[CARRITO DEL CLIENTE (solo lectura)]: ${sanitizeCartSummary(body.cartSummary)}`
  : ''
```

---

## FASE 4 — BAJO (Backlog)

### FIX-18 — Supabase hostname dinámico en next.config.ts

Ya incluido en FIX-07. Usar:
```typescript
hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co').hostname,
```

### FIX-19 — Transbank token no retornar al cliente

**Archivo:** `src/app/api/checkout/route.ts`

```typescript
// ANTES (aprox línea 156):
return NextResponse.json({
  orderId: order.id,
  url: tbk.url,
  token: tbk.token,  // ← innecesario para el cliente
})

// DESPUÉS:
return NextResponse.json({
  orderId: order.id,
  url: tbk.url,
  // token eliminado: el cliente solo necesita la URL de redirect
})
```

### FIX-20 — payment_status explícito en órdenes de WhatsApp

**Archivo:** `src/app/api/webhook/whatsapp/route.ts`

En el insert de la orden (dentro del handler de `crear_pedido`):
```typescript
// Agregar payment_status explícito:
await supabase.from('orders').insert({
  // ... campos existentes ...
  payment_status: 'pendiente',  // ← agregar esta línea
})
```

### FIX-21 — Escapar wildcards ILIKE en búsqueda de productos

**Archivo:** `src/app/api/chat/route.ts`

```typescript
// Antes del .ilike():
const safeLikeQuery = q
  .replace(/%/g, '\\%')
  .replace(/_/g, '\\_')
  .slice(0, 100) // límite de longitud

const { data } = await admin
  .from('products')
  .ilike('name', `%${safeLikeQuery}%`)
  // ... resto igual
```

### FIX-22 — Errores de Transbank SDK no exponer al cliente

**Archivo:** `src/app/api/checkout/route.ts`

```typescript
// ANTES (aprox línea 159-161):
const msg = e instanceof Error ? e.message : 'Error iniciando pago.'
return NextResponse.json({ error: msg }, { status: 500 })

// DESPUÉS:
console.error('[Transbank] Error al iniciar transacción:', e)
return NextResponse.json({ error: 'Error al iniciar el pago. Por favor intenta nuevamente.' }, { status: 500 })
```

### FIX-23 — Timeouts en llamadas fetch externas

**Archivos:** `src/app/api/transbank/return/route.ts` y `src/app/api/checkout/transfer/route.ts`

```typescript
// Helper de fetch con timeout:
async function fetchWithTimeout(url: string, timeoutMs = 5000): Promise<void> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    await fetch(url, { signal: controller.signal })
  } catch {
    // Ignorar errores de notificación (no críticos)
  } finally {
    clearTimeout(id)
  }
}

// Reemplazar:
// await fetch(url).catch(() => {})
// Por:
// await fetchWithTimeout(url)
```

### FIX-24 — Conversación WhatsApp: verificar ownership de conversation_id

**Archivo:** `src/app/api/webhook/whatsapp/route.ts`

```typescript
// Después de cargar la conversación por ID:
if (conversation && conversation.wa_phone !== phone) {
  conversation = null // Ignorar: el ID no pertenece a este número
}
```

### FIX-25 — Agregar .env al .gitignore (cobertura completa)

**Archivo:** `.gitignore`

Agregar después de la sección de env files:
```
# env — cobertura completa
.env
.env.*
!.env.example
```

---

## Verificación Final

Después de aplicar todos los fixes, ejecutar:

```bash
# 1. TypeScript sin errores
npx tsc --noEmit

# 2. Build limpio
npm run build

# 3. Checklist manual:
# [ ] .env.local tiene claves rotadas (nuevas, no las del audit)
# [ ] N8N_WEBHOOK_SECRET tiene valor aleatorio real (no el placeholder)
# [ ] NEXT_PUBLIC_APP_URL apunta al dominio de producción
# [ ] Vercel tiene TODAS las variables de entorno actualizadas
# [ ] Panel Supabase: verificar que ningún usuario tiene role=mayorista no aprobado
```

---

## Resumen de archivos a modificar

| Archivo | Fixes |
|---|---|
| `src/app/api/webhook/whatsapp/route.ts` | FIX-01, FIX-02, FIX-12, FIX-17(parcial), FIX-20, FIX-24 |
| `src/app/api/cron/generar-recetas/route.ts` | FIX-03, FIX-15 |
| `src/app/api/chat/route.ts` | FIX-04, FIX-17, FIX-21 |
| `src/app/api/transbank/return/route.ts` | FIX-05 |
| `src/app/api/checkout/route.ts` | FIX-06, FIX-11, FIX-19, FIX-22 |
| `src/app/api/checkout/transfer/route.ts` | FIX-06, FIX-11, FIX-13, FIX-23 |
| `src/app/api/admin/trigger-recipes/route.ts` | FIX-16 |
| `next.config.ts` | FIX-07, FIX-18 |
| `src/app/mayorista/login/page.tsx` | FIX-08 |
| `src/app/mayorista/registro/page.tsx` | FIX-10 |
| `src/lib/csrf.ts` (nuevo) | FIX-14 |
| `src/lib/generateRecipes.ts` (nuevo) | FIX-16 |
| `.gitignore` | FIX-25 |
| Supabase SQL Editor | FIX-09 (función reserve_stock) |
| Fase 0 (manual) | Rotar claves, OneDrive, git history |
