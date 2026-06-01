# El Menú — Blueprint

> # 🚨 ATENCIÓN — SISTEMA EN PRODUCCIÓN
>
> Este proyecto está **LIVE en https://www.el-menu.cl** procesando pedidos y cobros **reales** con Transbank Webpay Plus en modo producción. Cualquier cambio que llegue a `master` se despliega a producción **automáticamente en ~45 segundos** (Vercel + GitHub auto-deploy).
>
> **Un cambio mal hecho puede:**
> - Caerse pagos reales y perderse plata del dueño
> - Romper notificaciones de pedidos al WhatsApp del dueño
> - Bloquear el panel admin y dejar al dueño ciego
> - Tirar el sitio entero (ya pasó: un typo en `NEXT_PUBLIC_SUPABASE_URL` lo tuvo caído 3 días)
>
> **NO HACER sin autorización explícita del dueño:**
> - 🛑 Modificar `proxy.ts`, `lib/notify.ts`, `lib/orderMessage.ts`, `api/checkout/*`, `api/transbank/*`
> - 🛑 Aplicar migraciones nuevas en Supabase
> - 🛑 Cambiar o agregar variables de entorno en Vercel
> - 🛑 Desactivar políticas RLS o borrar columnas de tablas con datos
> - 🛑 Cambiar `TRANSBANK_ENVIRONMENT` a `integration` (corta los pagos)
> - 🛑 Tocar el workflow de n8n, las credenciales de YCloud o el chip emisor
> - 🛑 Pushear directo a `master` sin haber corrido `npm run build` local y validado que pasa limpio
>
> **Si algo deja de funcionar:** el sitio sirve el último deploy `READY`, no el último commit. Si `master` no compila, producción queda **congelada en un commit viejo** y a veces tarda en notarse. Verificar siempre el estado en Vercel Dashboard antes de asumir que el código actual es el que corre.
>
> **Cambios seguros sin pedir permiso:** copy, textos, estilos, fixes visuales claros. Igual probar local antes y mantener el commit chico.

---

> **Una verdulería online real en operación.** Vende frutas, verduras, hierbas y almacén en Santiago de Chile a clientes minoristas (B2C) y mayoristas (B2B) en simultáneo, desde una sola plataforma.
>
> **Estado:** ENTREGADO y LIVE en producción · https://www.el-menu.cl · pagos reales con Transbank Webpay Plus.

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) + TypeScript |
| UI | Tailwind v4 + Fraunces/Inter |
| Datos + Auth | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| Pagos | Transbank Webpay Plus (production) + Transferencia bancaria |
| IA conversacional | Anthropic Claude (Menucito web · Sonnet 4.6) |
| Notificaciones | `notify.ts` → n8n webhook → YCloud → WhatsApp del dueño |
| Hosting | Vercel (auto-deploy en push a master) |

---

## Quién usa el sistema

| Actor | Cómo entra | Qué hace |
|---|---|---|
| **Minorista** (B2C) | `/catalogo` sin login | Compra por unidad/kg. Carrito → Webpay o transferencia |
| **Mayorista** (B2B) | `/mayorista/registro` (aprobación instantánea) | Ve precios mayoristas y mínimos distintos, compra caja/saco/malla |
| **Dueño / Admin** | `/login` (rol admin) | Gestiona pedidos en tiempo real, productos, zonas, recetas, mayoristas |
| **Cliente sin saber qué pedir** | Chat web "Menucito" | Le pide al agente IA que arme el pedido por él |

---

## Capacidades core

1. **Catálogo dual** — Minorista y mayorista comparten DB pero ven precios distintos. Productos pueden marcarse `wholesale_only` (caja/saco) o `featured` (sección Ofertas).
2. **Checkout end-to-end** — Carrito Zustand persistente · validación server-side de stock/precios/zona · pago real con Webpay o transferencia con datos bancarios reales · idempotencia con `transbank_token`.
3. **Menucito (chat IA)** — Claude con tool use: `buscar_productos`, `ver_zonas`, `agregar_al_carrito`. FAB en cada página excepto admin. Bienvenida automática.
4. **Notificación automática al dueño por WhatsApp** — 5 eventos: `pedido_transferencia`, `pedido_webpay`, `registro_mayorista`, `mayorista_aprobado`, `stock_bajo`. Mensaje formateado por n8n y enviado vía YCloud.
5. **Botón naranjo en confirmación** — Después de pagar, el cliente toca un botón que abre WhatsApp en su teléfono con el pedido formateado idéntico a la notificación automática. El mensaje le llega al dueño desde el WhatsApp real del cliente (sirve como respaldo y abre el chat para responder).
6. **Panel admin** — Kanban de pedidos en tiempo real (Realtime), edición inline de productos/zonas, toggle activo/destacado/stock, aprobación de mayoristas, cancelación con doble confirmación.
7. **Recetas semanales con IA** — Cron Vercel lunes 6:00 AM genera 6 recetas con Claude usando productos en temporada. Listadas en el home.
8. **Modo mantenimiento** — Variable de entorno `MAINTENANCE_MODE=true` activa una página 503 desde `proxy.ts` sin necesidad de redeploy.

---

## Arquitectura (alto nivel)

```
Cliente (web)         Cliente (WhatsApp)              Dueño
    │                         │                         │
    ▼                         ▼                         ▼
┌──────────────────────────────────────────────────────────┐
│      Next.js 16 / App Router  ─  Vercel  ─  master       │
│  Catálogo · Menucito · Checkout · Panel admin · APIs     │
└──────────────────────────┬───────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   ┌─────────┐       ┌──────────┐      ┌─────────────────┐
   │Supabase │       │Transbank │      │  n8n webhook    │
   │ DB+Auth │       │ Webpay+  │      │  + YCloud  + WA │
   │+Realtime│       │  Plus    │      │  → dueño        │
   └─────────┘       └──────────┘      └─────────────────┘
        ▲                                       ▲
        │                                       │
   Anthropic                              Botón naranjo
   Claude (Menucito)                      (cliente envía
                                           desde su WA)
```

---

## Modelo de datos (resumen)

- `products` — 144 ítems · `price` minorista, `price_wholesale` opcional, `unit` (kg/unid/paq/…), `stock`, `featured`, `wholesale_only`, `active`
- `orders` — `items` JSONB con `unit_price` por línea · `customer_type` ('minorista'|'mayorista') · `name`, `phone`, `address`, `commune`, `total`, `payment_method`, `payment_status`, `status` (kanban: nuevo→preparando→listo→en_camino→entregado/cancelado) · campos Transbank al pagar
- `zones` — 27 comunas RM, `delivery_price`, `min_order`, `min_order_wholesale`
- `profiles` — extiende `auth.users` con `role` ('minorista'|'mayorista'|'admin')
- `categories`, `recipes` (IA), `conversations` (Menucito web)

**RLS habilitada en todas.** El admin escribe con su JWT (no service role) gracias al helper `is_admin()` y políticas dedicadas (migraciones 0006 + 0007).

---

## Estructura del repo

```
elmenu-app/
├── src/
│   ├── app/
│   │   ├── (catalog)/_components/HomeClient.tsx   # home (~1000 líneas, CSS embebido)
│   │   ├── catalogo/, mayorista/                  # vistas catálogo
│   │   ├── checkout/, checkout/confirmacion/      # compra y resultado
│   │   ├── admin/{productos,zonas,recetas,mayoristas,_components}
│   │   ├── pedido/[id]/                           # detalle público del pedido
│   │   └── api/
│   │       ├── chat/                              # Menucito (tool use loop)
│   │       ├── checkout/, checkout/transfer/      # creación de orden
│   │       ├── transbank/return/                  # commit + idempotencia
│   │       ├── admin/, notify/registro/           # endpoints internos
│   │       └── cron/generar-recetas/              # cron semanal
│   ├── components/{catalog,checkout,chat,admin}/
│   ├── lib/
│   │   ├── notify.ts          # → n8n (5 eventos)
│   │   ├── orderMessage.ts    # helper compartido del mensaje (botón + n8n)
│   │   ├── transbank.ts, csrf.ts, generateRecipes.ts
│   │   └── supabase/{client,server,admin}.ts
│   ├── hooks/                 # Zustand: useCart, useChat, useChatStore
│   ├── proxy.ts               # sesiones Supabase + MAINTENANCE_MODE (Next 16)
│   └── types/database.ts
├── supabase/
│   ├── schema.sql, seed.sql
│   └── migrations/0001..0009  # incluye RLS admin + name + customer_type
├── public/{logo,steps,placeholders}/
├── AGENTS.md       # advertencia: Next 16 rompe APIs viejas
├── CLAUDE.md       # → AGENTS.md
└── vercel.json     # cron lunes 6am
```

---

## Sistemas externos (importantes para entender el flujo completo)

- **n8n workflow "El Menú — Notificaciones al Dueño"** — webhook `https://nicoagenteia.app.n8n.cloud/webhook/elmenu-notificaciones`. Valida `x-webhook-secret` y arma el mensaje vía Set node con ternario por `$json.body.event`. HTTP node llama YCloud sendDirectly.
- **YCloud (WhatsApp Business API)** — número emisor (chip dedicado del negocio) envía al WhatsApp del dueño. Sujeto a la ventana de 24h de WhatsApp.
- **Plantilla `pedido_elmenu`** — pendiente aprobación Meta. Cuando apruebe, hay que cambiar el HTTP node a `type: template` con 8 variables. Esto elimina el problema de la ventana de 24h.

---

## Lo que NO es (importante para no asumir)

- ❌ **No es multi-tenant.** Es una sola verdulería. No hay separación por organización.
- ❌ **No es marketplace.** El dueño es el único vendedor.
- ❌ **No tiene app mobile nativa.** Es web responsive.
- ❌ **No integra logística externa** (Uber, Rappi). El dueño coordina despacho a mano.
- ❌ **No procesa devoluciones automáticas.** Se manejan offline por WhatsApp.
- ❌ **No envía email** transaccional. Toda la comunicación con el dueño es WhatsApp; con el cliente es la página de confirmación.

---

## Convenciones críticas

- **Next.js 16** rompe APIs antiguas. Antes de tocar cualquier cosa de Next, leer `node_modules/next/dist/docs/` (ver `AGENTS.md`).
- **`proxy.ts` es el único middleware permitido en Next 16.** `middleware.ts` fue eliminado y NO debe volver. El modo mantenimiento vive dentro de `proxy.ts`.
- **El panel admin escribe con el client del navegador**, no con service role. Toda escritura admin requiere su política RLS (`is_admin()`). Si una operación admin del panel falla silenciosamente, lo más probable es RLS.
- **`notify.ts` envía campos sueltos al webhook**, no el mensaje completo. El texto se arma en el Set node de n8n. El botón naranjo y el Set node deben producir el MISMO formato — el helper `orderMessage.ts` es la fuente de verdad para ambos.
- **Las plantillas de WhatsApp NO permiten saltos de línea, tabs ni 4+ espacios en variables.** Eso afecta el diseño de la plantilla `pedido_elmenu` (productos van en una sola línea separados por `·`).
- **El admin hace updates optimistas** en `ProductsAdminClient.tsx` sin chequear el resultado del UPDATE — un riesgo conocido pendiente de hardening.

---

## Cómo correr local

```bash
cd elmenu-app
npm install
# .env.local necesita:
#   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
#   ANTHROPIC_API_KEY
#   NEXT_PUBLIC_APP_URL (en dev: http://localhost:3000)
#   TRANSBANK_ENVIRONMENT=integration  (NUNCA production en dev)
#   CRON_SECRET
#   N8N_WEBHOOK_BASE_URL, N8N_WEBHOOK_SECRET (opcional en dev; si faltan, notify.ts hace console.log y no rompe)
npm run dev
```

Build de producción: `npm run build` (debe pasar limpio antes de pushear a master).
