# El Menú — Estado del Proyecto

> Última actualización: **2026-05-14** (Sesión completa: Meni IA, admin, step cards 3D, footer, polish final)
> Stack: Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind v4 · Supabase (PG + Auth + Storage + Realtime) · Anthropic Claude Sonnet 4.6 · Kie.ai · Remotion · Transbank Webpay · Vercel

---

## Resumen ejecutivo

El proyecto está al **99% del camino a producción**. Todo el código está terminado y en producción en Vercel. Lo único que falta son **3 pasos operacionales que dependen exclusivamente de Celso**: credenciales Transbank producción, activar CallMeBot, y apuntar el dominio `elmenu.cl`.

---

## 1. Lo que está listo ✅

### 1.1 Infraestructura Supabase
- Proyecto `xneydkfzcveigmbtpltk` con 7 tablas: `categories`, `products`, `zones`, `profiles`, `orders`, `recipes`, `conversations`
- 4 migrations aplicadas: `0001_role_payment_recipes`, `0002_harden_security_warnings`, `0003_add_wholesale_min_order`, `0004_add_wholesale_only`
- RLS habilitada en todas las tablas + policies por rol
- Trigger `handle_new_user` crea profile automáticamente al registrarse
- Realtime habilitado en `orders` y `conversations`
- Bucket público `product-images` en Storage (~5MB max, jpg/png/webp)
- Advisors de seguridad: **0 issues críticos**

### 1.2 Catálogo de productos
- **144 productos** en **8 categorías** (verduras, frutas, hierbas, tubérculos, cítricos, legumbres, frutos secos, almacén)
- Precios minorista + mayorista cuando aplica
- Bandera `wholesale_only` para cajas/sacos/mallas grandes que solo van a /mayorista
- 25 productos marcados `featured = true` (sección Ofertas)
- Zona única "Santiago" con 27 comunas, despacho $2.990, mínimo minorista $20.000 / mayorista $60.000

### 1.3 Imágenes IA — 185 imágenes
- Generadas con **Kie.ai · nano-banana-2** (Google Gemini 2.5 Flash Image)
- 2 fondos coherentes: **crema marfil `#F5EFE0`** (minorista) y **arena tibio `#E8DCC4`** (mayorista)
- Script reutilizable: [`scripts/generate-product-images.mjs`](scripts/generate-product-images.mjs)

### 1.4 Catálogos visuales
- **`/catalogo`** (público, retail): hero verde, todos pueden comprar
- **`/mayorista`** (público para ver): hero dorado, solo `role=mayorista|admin` puede comprar
- `CatalogModeTabs` sticky, `CategoryStrip`, sección virtual Ofertas, banners contextuales por rol

### 1.5 Buscador
- Normalización de acentos ("limon" → matchea "Limón")
- Búsqueda sobre nombre + descripción + categoría con debounce 300ms
- Sincronización con URL (`?q=tomate&cat=verduras`) — links compartibles

### 1.6 Auth y registro mayorista
- `/mayorista/login` + `/mayorista/registro`
- `src/proxy.ts` middleware de sesiones + guards de rutas
- `UserMenu` con perfil, rol, logout vía Server Action
- `/mi-cuenta` con datos personales + lista de pedidos

### 1.7 Home rediseñada ✅
- **Mapa interactivo Leaflet** — 27 comunas verdes, GeoJSON local, búsqueda con autocomplete
- Sección "¿Cómo funciona?", carrusel productos destacados, recetas IA
- Sección Meni actualizada: botón "Hablar con Meni" abre el chat web directamente (no redirige a WhatsApp)
- **IMPORTANTE:** Todo el CSS del home va en el string `const CSS` de `HomeClient.tsx`, no en globals.css

### 1.8 Checkout con Transbank Webpay Plus ✅
- `transbank-sdk@6.1.1`, `src/lib/transbank.ts` con toggle integration/production
- `POST /api/checkout` — recalcula precios server-side, valida stock + comuna + mínimo, crea orden
- `GET/POST /api/transbank/return` — commit, actualiza `payment_status`, notifica WhatsApp, redirige

### 1.9 Notificación WhatsApp al pago exitoso ✅
- Implementado en `/api/transbank/return/route.ts` con **CallMeBot** (API gratuita)
- Mensaje al local: pedido ID, total, teléfono cliente, dirección, lista de productos
- Variable de entorno: `CALLMEBOT_API_KEY` (pendiente activación por Celso — ver sección 2.1)

### 1.10 Admin panel rediseñado ✅
- **Sidebar oscuro** (`#1B2B1E`) con nav activo, avatar, "Ver sitio", logout
- **Dashboard de pedidos**: KPI strip (pedidos hoy, ingresos, ticket promedio, urgentes), pipeline kanban 4 columnas, badge EN VIVO con animación, EmptyState ilustrado
- **`/admin/zonas`**: edición inline de precios, mínimos y comunas con flash feedback
- **`/admin/recetas`**: toggle active/inactive, regenerar con IA, badge "última generación"
- **`/admin/productos`**: gestión de nombre/precio/stock/imagen
- Sidebar como Client Component separado (`AdminSidebar.tsx`) para usar `usePathname()`
- Nav items: Pedidos · Productos · Zonas · Recetas IA

### 1.11 OG Image ✅
- `public/og-image.png` — 1280×720px generada con Canva IA (design ID: DAHJqVE6Z3E)
- Conectada en `layout.tsx` → `openGraph.images` y `twitter.images`

### 1.12 Step 7 — Meni, agente IA de chat web ✅ COMPLETADO

**Arquitectura:** endpoint REST + tool use loop (max 5 iteraciones) + Zustand global para estado del chat.

**Archivos creados:**
- `src/app/api/chat/route.ts` — endpoint POST, sistema prompt Meni, 3 herramientas Anthropic:
  - `buscar_productos`: búsqueda ilike con retry de plural→singular (`limones`→`limon`)
  - `ver_zonas`: devuelve comunas y precios de despacho
  - `agregar_al_carrito`: acumula items y los resuelve a `Product` completo al final
  - Devuelve `{ message, products?, addedToCart? }`
- `src/hooks/useChatStore.ts` — Zustand global `{ isOpen, openChat, closeChat }` compartido entre componentes
- `src/hooks/useChat.ts` — mensajes, isLoading, sendMessage con useRef para stale closure; soporte de `displayText` (texto visual vs texto enviado a API)
- `src/components/chat/ChatWidget.tsx` — FAB 🥦 + modal 380×560px desktop / full-screen mobile:
  - Tarjetas de producto **clickeables** (botón `+ Agregar`): agrega al carrito inmediatamente, envía `[seleccionó: nombre]` a la API
  - Emoji lookup por nombre de producto (35 patrones: 🍅 tomate, 🥑 palta, 🧄 ajo, etc.)
  - Badge "✓ Agregado al carrito" con unidad legible (`"1 kg"` → `"kg"`)
  - Oculto en rutas `/admin*`
  - Bienvenida automática al abrir por primera vez

**Integración en el home:**
- `HomeClient.tsx` importa `useChatStore` → botón "Hablar con Meni" llama `openChat()`
- Sin redirección a WhatsApp

**System prompt de Meni:**
- Formato de respuesta conversacional con bullets (no tablas markdown)
- Búsqueda en singular con tilde: "limón" no "limones"
- Manejo de selección por tarjeta: no re-agrega al carrito si viene `[seleccionó:]`

### 1.13 Step cards de ¿Cómo funciona? ✅
- 4 imágenes PNG (`public/steps/step1-4.png`) — 1080×1350px, fondo verde oscuro `#1B2B1E`
- Generadas con **Kie.ai · nano-banana-2**: número 3D metálico dorado sobre fondo verde, sin texto
- Compuestas con **Remotion** (`SUSI-cowork/src/ElMenuSteps.tsx`): imagen Kie.ai + dot pattern SVG + gradiente + emoji + título Fraunces + descripción + sparkle
- Pipeline: `python scripts/generate_kie.py` → `npx remotion still src/Root.tsx ElMenu-Step[N]` → `copy out\ElMenu-Step[N].png elmenu-app\public\steps\step[N].png`
- En el home: `<article className="producer producer-img"><img src="/steps/step{i+1}.png" /></article>` — sin CSS de gradientes, sin emojis sobreimpuestos

### 1.14 Footer limpiado ✅
- Eliminado el bloque "Pagamos con: Webpay · Khipu · Flow · Mercado Pago" del footer
- Queda solo: `© 2026 El Menú SpA · Todos los derechos reservados`

### 1.15 Deploy ✅
- Repo en GitHub: `Nicolascp97/EL_MENU` · rama `master`
- Vercel conectado con auto-deploy en push a master
- Env vars cargadas en Vercel Dashboard
- Build: 0 errores TypeScript, ~20 rutas generadas

---

## 2. Lo que falta para producción ⏳

### 2.1 Pendientes operacionales (dependen de Celso)

#### Activar notificaciones WhatsApp — CallMeBot
El código está implementado. Solo falta activar el servicio:
1. Celso agrega **+34 644 65 70 34** como contacto en WhatsApp
2. Le envía el mensaje exacto: `I allow callmebot to send me messages`
3. Recibe una API key por respuesta automática
4. Agregar en Vercel → Settings → Environment Variables: `CALLMEBOT_API_KEY = <key recibida>`
5. Hacer Redeploy

#### Transbank producción
- [ ] Celso entrega `TRANSBANK_COMMERCE_CODE` + `TRANSBANK_API_KEY_SECRET` reales
- [ ] Agregar en Vercel env vars + `TRANSBANK_ENVIRONMENT=production`
- [ ] Probar flujo completo con tarjeta real en dominio live antes de anunciar

#### Supabase Site URL
- [ ] Supabase Dashboard → Authentication → URL Configuration → **Site URL** = dominio final
- Sin esto, los links de confirmación de email apuntan a localhost

#### Dominio
- [ ] Apuntar `elmenu.cl` a Vercel (DNS → CNAME a `cname.vercel-dns.com`)
- [ ] Vercel → Settings → Domains → agregar dominio

### 2.2 Pendientes técnicos menores
- [ ] **`CRON_SECRET`** en Vercel env vars (sin esto el cron de recetas falla con 401)
- [ ] **Loading states** en `/catalogo` y `/mayorista` (Suspense + skeleton)
- [ ] **Analytics** (Vercel Analytics — 1 línea de código)
- [ ] **Emails transaccionales** (Resend) — orden confirmada al cliente (opcional para MVP)

### 2.3 Diferido a v2
- Favoritos (columna `profiles.favorites UUID[]` ya existe en DB, falta UI)
- Página `/recetas/[id]` con pasos de preparación (requiere columna `steps` en tabla)
- WhatsApp vía n8n → mismo `/api/chat` endpoint (webhook placeholder ya existe)
- Persistir conversaciones de Meni en tabla `conversations`

---

## 3. Checklist pre-lanzamiento

### 3.1 Supabase
- [ ] Auth → **Site URL** = dominio final
- [ ] Auth → Confirm email: ON (seguro) o OFF (más ágil para lanzamiento)
- [ ] Settings → Database → Backups: daily backup habilitado

### 3.2 Primer usuario admin
```sql
UPDATE profiles SET role = 'admin' WHERE id = (
  SELECT id FROM auth.users WHERE email = 'celso@email.cl'
);
```

### 3.3 Pruebas de aceptación
- [ ] Visitante anónimo: ve `/`, `/catalogo`, `/mayorista`, usa Meni
- [ ] Meni encuentra productos, los agrega al carrito, guía al checkout
- [ ] Mayorista: registro → login → precios mayoristas → checkout → pago
- [ ] Pago exitoso → notificación WhatsApp al +56954952395
- [ ] Admin: pedidos en tiempo real, edición de productos, zonas, recetas

---

## 4. Variables de entorno

| Variable | Para qué | Estado |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL proyecto Supabase | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (browser) | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (server) | ✅ |
| `ANTHROPIC_API_KEY` | Claude API para Meni | ✅ en uso |
| `NEXT_PUBLIC_WA_NUMBER` | WhatsApp Celso (`56954952395`) | ✅ |
| `NEXT_PUBLIC_APP_URL` | URL base de la app | ✅ |
| `CRON_SECRET` | Bearer para `/api/cron/*` | ⏳ agregar en Vercel |
| `CALLMEBOT_API_KEY` | Notificaciones WhatsApp al local | ⏳ pendiente activación |
| `TRANSBANK_ENVIRONMENT` | `integration` dev / `production` prod | ⏳ cambiar a production |
| `TRANSBANK_COMMERCE_CODE` | Código comercio producción | ⏳ Celso lo entrega |
| `TRANSBANK_API_KEY_SECRET` | Secret Transbank producción | ⏳ Celso lo entrega |

---

## 5. Archivos clave del proyecto

```
elmenu-app/
├── ESTADO-DEL-PROYECTO.md
├── AGENTS.md                        ← reglas para agentes IA (Next 16)
├── .env.example                     ← plantilla sin secretos (commiteado)
├── vercel.json                      ← cron lunes 6 AM para recetas
├── src/
│   ├── proxy.ts                     ← middleware: refresh sesiones + guard rutas
│   ├── app/
│   │   ├── layout.tsx               ← metadata OG + ChatWidget global
│   │   ├── (catalog)/
│   │   │   ├── page.tsx             ← Server wrapper (pre-fetcha featured + recipes)
│   │   │   └── _components/
│   │   │       ├── HomeClient.tsx   ← home completa (~1000 líneas, CSS en string const)
│   │   │       └── RecipesSection.tsx
│   │   ├── catalogo/page.tsx
│   │   ├── mayorista/
│   │   ├── mi-cuenta/page.tsx
│   │   ├── admin/
│   │   │   ├── layout.tsx           ← role check + AdminSidebar
│   │   │   ├── _components/AdminSidebar.tsx  ← Client Component con usePathname()
│   │   │   ├── page.tsx             ← KPI + kanban pedidos (Realtime)
│   │   │   ├── productos/page.tsx
│   │   │   ├── zonas/page.tsx       ← edición inline comunas + precios
│   │   │   └── recetas/page.tsx     ← toggle + regenerar IA
│   │   └── api/
│   │       ├── chat/route.ts        ← Meni: tool use loop (buscar/zonas/carrito)
│   │       ├── checkout/route.ts
│   │       ├── transbank/return/    ← commit + CallMeBot WhatsApp
│   │       ├── cron/generar-recetas/
│   │       ├── admin/trigger-recipes/
│   │       └── webhook/whatsapp/    ← placeholder n8n (v2)
│   ├── components/
│   │   ├── chat/ChatWidget.tsx      ← FAB + modal + tarjetas clickeables
│   │   ├── ZonesMap.tsx
│   │   ├── catalog/…
│   │   ├── admin/…
│   │   └── checkout/…
│   ├── hooks/
│   │   ├── useCart.ts               ← Zustand + persist localStorage
│   │   ├── useChat.ts               ← mensajes + sendMessage con displayText
│   │   └── useChatStore.ts          ← Zustand global isOpen/openChat/closeChat
│   ├── lib/
│   │   ├── supabase/{client,server,admin}.ts
│   │   ├── transbank.ts
│   │   └── utils.ts
│   └── types/database.ts
├── public/
│   ├── og-image.png                 ← 1280×720px Canva IA
│   ├── comunal-rm.geojson           ← 52 comunas RM para Leaflet
│   ├── steps/                       ← 4 step cards PNG (Kie.ai + Remotion)
│   │   ├── step1.png
│   │   ├── step2.png
│   │   ├── step3.png
│   │   └── step4.png
│   └── logo/
└── scripts/
    ├── generate-product-images.mjs
    └── import-orphan-image.mjs
```

---

## 6. Cómo probar checkout end-to-end (dev local)

1. `npm run dev` → `http://localhost:3000/catalogo`
2. Agregar productos por al menos **$20.000**
3. Carrito → Pagar → `/checkout` → completar form
4. Tarjeta de integración Transbank:
   - **Número:** `4051 8856 0000 0044`
   - **CVV:** `123` · **Venc:** `11/27` · **RUT:** `11.111.111-1` · **Clave:** `123`
5. Confirmación → `/checkout/confirmacion?status=success`

Para cancelación: "Anular compra" en Transbank → `status=cancelled`
Para error: CVV `000` → `status=failed`

---

## 7. Costos mensuales estimados

| Servicio | Costo | Notas |
|---|---:|---|
| Vercel Pro | $20/mes | Necesario para cron; Free alcanza para MVP sin cron |
| Supabase Free → Pro | $0–25/mes | Free OK para arrancar |
| Anthropic Claude API | ~$10–50/mes | Pay-as-you-go según uso de Meni |
| Transbank | variable | Comisión por transacción (Celso ya tiene cuenta) |
| Dominio | $10–20/año | elmenu.cl |
| **Total fijo** | **~$30–95/mes** | Sin contar Transbank |

---

*Documento actualizado tras: Step 7 completado (Meni chat web con tool use, tarjetas clickeables, emoji lookup, búsqueda plural→singular), admin rediseñado (sidebar oscuro, KPI, kanban), notificaciones WhatsApp (CallMeBot), OG image (Canva IA). El proyecto está listo para producción pendiendo solo pasos operacionales de Celso.*
