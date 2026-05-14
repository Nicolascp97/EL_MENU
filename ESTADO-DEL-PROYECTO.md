# El Menú — Estado del Proyecto

> Última actualización: **2026-05-14** (Step 8+9 completado: home dinámica + carrusel productos + recetas IA en DB + admin recetas + cron Vercel)
> Stack: Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind v4 · Supabase (PG + Auth + Storage + Realtime) · Anthropic Claude · Kie.ai (imágenes) · Transbank Webpay · Vercel

---

## Resumen ejecutivo

El proyecto está al **90% del camino a producción**. Toda la funcionalidad core está terminada y el build compila limpio (0 errores TypeScript, 0 warnings). El código está commiteado y listo para hacer push a GitHub y conectar a Vercel. Lo único que falta para el MVP es el **deploy en sí** (push + env vars + dominio), y opcionalmente el **agente IA Meni** como diferenciador.

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
- Fuente: `tabla-productos-minoristras.md` + `tabla-productos-mayoristas.md` (archivos en la raíz del proyecto)
- Zona única "Santiago" con 21 comunas, despacho $2.990, mínimo minorista $20.000 / mayorista $60.000

### 1.3 Imágenes IA — 185 imágenes
- Generadas con **Kie.ai · nano-banana-2** (Google Gemini 2.5 Flash Image)
- 2 fondos coherentes: **crema marfil `#F5EFE0`** (minorista) y **arena tibio `#E8DCC4`** (mayorista)
- Convención: `products.images[0]` = bg minorista, `images[1]` = bg mayorista (cuando aplica)
- ProductCard elige el slot correcto según `wholesaleMode`
- Script reutilizable: [`scripts/generate-product-images.mjs`](scripts/generate-product-images.mjs)
- Script de rescate para tasks huérfanas: [`scripts/import-orphan-image.mjs`](scripts/import-orphan-image.mjs)

### 1.4 Catálogos visuales
- **`/catalogo`** (público, retail): hero verde, todos pueden comprar
- **`/mayorista`** (público para ver): hero dorado, solo `role=mayorista|admin` puede comprar — para anónimos/minoristas muestra pill "🔒 Solo empresas" y banner "Regístrate como empresa"
- `CatalogModeTabs` sticky para alternar
- `CategoryStrip` con cards grandes (emoji 56px + count por categoría)
- Sección virtual **🏷️ Ofertas** (filtra productos cuyo nombre contiene "oferta")
- Banners contextuales según rol (cross-sell mayorista → minorista, etc)

### 1.5 Buscador
- Normalización de acentos (escribes "limon" → matchea "Limón")
- Búsqueda sobre nombre + descripción + categoría
- Sincronización con URL (`/catalogo?q=tomate&cat=verduras`) con debounce 300ms — links compartibles
- Botón ✕ para limpiar
- Funciona desde search bar del home Y desde el hero de cada catálogo

### 1.6 Auth y registro mayorista
- **`/mayorista/login`** — email + password, signInWithPassword, redirige a `?next=…`
- **`/mayorista/registro`** — email/password/nombre/teléfono, `signUp({ data: { role: 'mayorista' } })`, handle confirmación de email
- **`src/proxy.ts`** corre en todas las rutas (refresh de tokens Supabase) y redirige `/admin` + `/mi-cuenta` si no hay sesión
- **`src/app/admin/layout.tsx`** chequea `profile.role === 'admin'` (autorización a nivel de layout)
- **`UserMenu`** dropdown con perfil, rol (badge color-coded), links contextuales, **logout** vía Server Action `signOutAction`
- **`/mi-cuenta`** con datos personales + lista de pedidos + botón cerrar sesión

### 1.7 Home rediseñada ✅
- **Mapa interactivo Leaflet** con CartoDB Positron — sistema binario verde/gris
  - Verde (`#22C55E`) = 27 comunas con despacho · Gris (`#94A3B8`) = sin cobertura
  - GeoJSON local: `public/comunal-rm.geojson` (GADM, 52 comunas RM, ~92KB) — sin dependencia externa
  - Barra de búsqueda con autocomplete glassmorphism + flyTo a la comuna buscada
  - Popup al tocar/hover: nombre comuna, "✓ Hacemos despacho aquí", "$2.990 · Mínimo $20.000"
  - Toggle "Ver las 27 comunas ▼" bajo el mapa → grilla expandible (4 col desktop, 2 col mobile)
  - Sin tarjeta de tienda overlay (se eliminó para que el mapa se vea completo)
  - `norm()` stripea espacios además de diacríticos — crítico porque GADM usa "ElBosque" sin espacios
- **Sección "¿Cómo funciona?"** — 4 pasos animados
- Topbar con Dancing Script, Navbar móvil con drawer izquierdo, sin carrito en home
- **IMPORTANTE:** El home (`(catalog)/page.tsx`) es un Client Component gigante (~950 líneas) con `const CSS` string. TODO el CSS del home va dentro de ese string, no en globals.css ni Tailwind.
- **Secciones 3 y 6 del JSX no existen aún** (el numerado salta 2→4 y 5→7) — se construirán en Step 9

### 1.8 Checkout con Transbank Webpay Plus ✅
- `transbank-sdk@6.1.1` instalado
- `src/lib/transbank.ts` con `createWebpayPlus()` — usa credenciales de integración por default; cuando `TRANSBANK_ENVIRONMENT=production` exige variables de producción
- `POST /api/checkout` — recalcula precios server-side según rol, valida stock + comuna + mínimo, crea `order`, inicia transacción Transbank
- `GET/POST /api/transbank/return` — commit de transacción, actualiza `payment_status`, redirige a `/checkout/confirmacion`
- `/checkout/page.tsx` — prefill con datos del perfil; `CheckoutClient.tsx` con form + `OrderSummary.tsx` con totales dinámicos por zona y validación de mínimo

### 1.9 Detalle de pedido ✅
- `/pedido/[id]/page.tsx` — control de acceso (dueño o admin), muestra items, totales, estado, CTAs

### 1.10 Deploy-ready ✅ (nuevo)
- **Build limpio**: `npm run build` → 0 errores TypeScript, 0 warnings, 14 rutas generadas
- **`src/app/error.tsx`** — página de error con marca + "Intentar nuevamente" + "Volver al inicio"
- **`src/app/not-found.tsx`** — 404 con marca y link al catálogo
- **`src/app/layout.tsx`** — metadata completa: `metadataBase`, `title template`, `description`, `openGraph`, `twitter`, `icons`, `robots`
- **`.env.example`** — documenta las 11 variables de entorno sin exponer secretos
- **`next.config.ts`** — `poweredByHeader: false` (no exponer versión Next.js en headers HTTP)
- **`.gitignore`** — corregido para no excluir `.env.example` pero sí `.env.local` y `.env.production`
- **Todo el copy en español chileno** — eliminado todo el voceo argentino (vos/podés/tenés/Registrate) en los 7 archivos donde aparecía

### 1.11 Admin
- `/admin` — listado de pedidos en tiempo real con Supabase Realtime (badge por estado, filtro)
- `/admin/productos` — gestión de productos con edición de nombre/precio/stock/imagen

---

## 2. Lo que falta para producción ⏳

### 2.1 Step 10 — Deploy ✅ COMPLETADO
- Repo en GitHub: `Nicolascp97/EL_MENU` · rama `master`
- Vercel conectado y con deploy activo (commit `98b3e02` en producción)
- Env vars cargadas en Vercel Dashboard
- **Pendiente aún:** dominio personalizado, credenciales Transbank producción, test end-to-end en prod

### 2.2 Step 8 + Step 9 — Recetas IA + Home dinámica ✅ COMPLETADO

**Archivos creados/modificados:**
- `src/app/(catalog)/page.tsx` ← Server wrapper async (pre-fetcha featured + recipes)
- `src/app/(catalog)/_components/HomeClient.tsx` ← Client Component (era page.tsx)
- `src/app/(catalog)/_components/RecipesSection.tsx` ← Client Component con useCart
- `src/app/api/cron/generar-recetas/route.ts` ← cron Bearer auth, usa claude-sonnet-4-6
- `src/app/api/admin/trigger-recipes/route.ts` ← proxy seguro admin
- `src/app/admin/recetas/page.tsx` ← gestión editorial + toggle + regenerar
- `vercel.json` ← cron lunes 6 AM `0 6 * * 1`

**DB:** 6 recetas insertadas con product_ids reales:
🥗 Ensalada Primavera con Palta · 🥦 Crema de Brócoli con Almendras · 🥤 Jugo Verde Detox · 🍲 Cazuela de Porotos · 🫘 Ensalada de Garbanzos · 🥭 Smoothie Tropical

**Pendiente operacional:** Agregar `CRON_SECRET` en Vercel Dashboard → Environment Variables.

### 2.3 Step 7 — Chat Meni (diferenciador, no bloqueante)
**Estimado:** 2 días

**Arquitectura aprobada:** Un solo endpoint `/api/chat/route.ts` sirve a dos clientes:
- **Web:** `ChatWidget.tsx` llama directamente al endpoint
- **WhatsApp:** WhatsApp Business API → n8n → mismo `/api/chat` endpoint

- [ ] `/api/chat/route.ts` — streaming con Anthropic SDK, system prompt de Meni, tools para consultar productos/zonas/crear pedidos
- [ ] `src/hooks/useChat.ts` — estado de mensajes, isOpen, isLoading
- [ ] `src/components/chat/ChatWidget.tsx` + `ChatModal.tsx`
- [ ] Integrar en layout; cambiar botón home WhatsApp → ChatModal
- [ ] `/api/webhook/whatsapp/route.ts` — mismo sistema vía n8n
- [ ] Persistir conversaciones en tabla `conversations` (ya existe en DB)

### 2.4 Mejoras menores
- [ ] **Loading states** en `/catalogo` y `/mayorista` (Suspense + skeleton)
- [ ] **Analytics** (Vercel Analytics o Google Analytics)
- [ ] **Email de orden creada** (Resend o Supabase Edge Function) — notificar a Celso
- [ ] **Página de admin/zonas** — gestión de comunas y precios de despacho desde el panel
- [ ] **Favoritos** — columna `profiles.favorites UUID[]` existe en DB pero sin UI (defer to v2)
- [ ] **OG image** — crear `/public/og-image.png` (1200×630px) para redes sociales

---

## 3. Checklist pre-producción

### 3.1 Supabase (consola supabase.com)
- [ ] Auth → Providers → Email → **Confirm email**: decidir ON (seguro) o OFF (más ágil para testing)
- [ ] Auth → URL Configuration → **Site URL** = dominio final
- [ ] Auth → Email Templates → personalizar con marca El Menú (opcional)
- [ ] Settings → Database → Backups: verificar daily backup habilitado

### 3.2 Primer usuario admin
1. Regístrate como mayorista desde `/mayorista/registro` con el email de Celso
2. Confirma email si está ON
3. Sube el rol manualmente en Supabase SQL Editor:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE id = (
     SELECT id FROM auth.users WHERE email = 'celso@email.cl'
   );
   ```

### 3.3 Transbank
- [ ] Verificar credenciales de **producción** con Celso
- [ ] `TRANSBANK_COMMERCE_CODE` + `TRANSBANK_API_KEY_SECRET` en env vars de Vercel
- [ ] `TRANSBANK_ENVIRONMENT=production` en Vercel (Preview puede quedar en `integration`)
- [ ] Probar con tarjeta de integración antes de live

### 3.4 Pruebas de aceptación (flujo completo)
- [ ] Visitante anónimo: ve `/`, `/catalogo`, `/mayorista` con imágenes correctas
- [ ] Mayorista nuevo: registro → confirmación email → login → precios mayoristas → checkout → pago aprobado
- [ ] Admin: login → `/admin` → ve pedidos en tiempo real → `/admin/productos` → edita producto
- [ ] Mapa Leaflet carga en home con zonas coloreadas y tooltip al hover

---

## 4. Variables de entorno

### 4.1 Configuradas en `.env.local` (dev)
| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (cliente browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (bypass RLS, server-only) |
| `ANTHROPIC_API_KEY` | Claude API para Meni (Step 7+) |
| `NEXT_PUBLIC_WA_NUMBER` | Número WhatsApp Celso (`56954952395`) |
| `NEXT_PUBLIC_APP_URL` | URL base de la app (`http://localhost:3000` en dev) |
| `TRANSBANK_ENVIRONMENT` | `integration` en dev, `production` en prod |
| `TRANSBANK_COMMERCE_CODE` | Código comercio (integración usa default del SDK) |
| `TRANSBANK_API_KEY_SECRET` | Secret (integración usa default del SDK) |
| `N8N_WEBHOOK_BASE_URL` | URL base del n8n (para Step 7) |
| `N8N_WEBHOOK_SECRET` | Secret para validar webhooks (para Step 7) |

> Ver `.env.example` en la raíz del proyecto para la lista completa con descripciones.

### 4.2 Adicionales para producción
| Variable | Para qué | Cuándo |
|---|---|---|
| `CRON_SECRET` | Token bearer para `/api/cron/*` | Step 8 |
| `RESEND_API_KEY` *(opcional)* | Envío de emails transaccionales | mejora |

---

## 5. Archivos clave del proyecto

```
elmenu-app/
├── ESTADO-DEL-PROYECTO.md          ← este documento
├── AGENTS.md                        ← reglas para agentes IA (Next 16, no usar convenciones viejas)
├── .env.example                     ← plantilla de variables de entorno (commiteado, sin secretos)
├── tabla-productos-minoristras.md   ← fuente del seed minorista
├── tabla-productos-mayoristas.md    ← fuente del seed mayorista
├── next.config.ts                   ← Turbopack root + remotePatterns + poweredByHeader:false
├── src/
│   ├── proxy.ts                     ← guard /admin y /mi-cuenta (renombrado de middleware en Next 16)
│   ├── app/
│   │   ├── layout.tsx               ← metadata completa (OG, Twitter, favicon, robots)
│   │   ├── error.tsx                ← página de error con marca
│   │   ├── not-found.tsx            ← 404 con marca
│   │   ├── (catalog)/page.tsx       ← HOME (mock data — pendiente Step 9)
│   │   ├── catalogo/page.tsx        ← Catálogo minorista público
│   │   ├── mayorista/
│   │   │   ├── page.tsx             ← Catálogo mayorista (compra condicionada por rol)
│   │   │   ├── login/page.tsx
│   │   │   └── registro/page.tsx
│   │   ├── mi-cuenta/page.tsx       ← Perfil + pedidos + logout
│   │   ├── admin/
│   │   │   ├── layout.tsx           ← role check === 'admin'
│   │   │   ├── page.tsx             ← pedidos en tiempo real (Supabase Realtime)
│   │   │   └── productos/page.tsx   ← gestión de productos
│   │   ├── auth/actions.ts          ← signOutAction (Server Action)
│   │   ├── checkout/
│   │   │   ├── page.tsx             ← prefill con datos del perfil
│   │   │   └── confirmacion/page.tsx
│   │   ├── pedido/[id]/page.tsx     ← detalle de pedido (control de acceso)
│   │   └── api/
│   │       ├── checkout/route.ts    ← crea orden + inicia Transbank
│   │       ├── transbank/return/    ← commit + actualiza payment_status
│   │       └── webhook/whatsapp/    ← placeholder para n8n (Step 7)
│   ├── components/
│   │   ├── ZonesMap.tsx             ← mapa Leaflet interactivo (ssr:false, CartoDB Positron)
│   │   ├── auth/UserMenu.tsx
│   │   ├── catalog/
│   │   │   ├── Navbar.tsx
│   │   │   ├── CatalogClient.tsx    ← orquestador (filtros, grid)
│   │   │   ├── CatalogHero.tsx      ← hero por modo + banner contextual
│   │   │   ├── CatalogModeTabs.tsx  ← tabs Minorista | Mayorista
│   │   │   ├── CategoryStrip.tsx    ← cards grandes de categorías
│   │   │   ├── ProductCard.tsx      ← card con imagen, precio, badge
│   │   │   └── CartDrawer.tsx
│   │   ├── admin/
│   │   │   ├── OrdersRealtimeClient.tsx
│   │   │   └── ProductsAdminClient.tsx
│   │   └── checkout/
│   │       ├── CheckoutClient.tsx
│   │       └── OrderSummary.tsx
│   ├── hooks/useCart.ts             ← zustand + persist localStorage
│   ├── lib/
│   │   ├── supabase/{client,server,admin}.ts
│   │   ├── transbank.ts             ← wrapper Webpay Plus con toggle integration/production
│   │   └── utils.ts                 ← cn, formatPrice, slugify
│   └── types/database.ts            ← tipos de todas las tablas
├── supabase/
│   ├── schema.sql                   ← esquema base
│   ├── seed.sql                     ← 144 productos + zona + 8 categorías
│   └── migrations/ (4 archivos)
├── scripts/
│   ├── generate-product-images.mjs  ← Kie.ai → Supabase Storage → DB
│   └── import-orphan-image.mjs      ← rescatar tareas huérfanas pagas
└── public/
    ├── logo/{elmenu-color,elmenu-white}.png
    └── placeholders/default.svg
```

---

## 6. Memorias del proyecto (en `.claude/`)

El agente IA mantiene memoria persistente con decisiones de diseño:

- `project_lalista_urls.md` — URLs públicas de Celso en lalista.de
- `project_seed_strategy.md` — cómo se mapean precios, featured, unidades
- `project_catalog_modes.md` — lógica de canPurchase y banners por rol
- `project_social_urls.md` — Instagram, Facebook, WhatsApp, mail oficiales
- `project_pending_tasks.md` — tareas pendientes de steps anteriores

---

## 7. Costos mensuales estimados en producción

| Servicio | Costo | Notas |
|---|---:|---|
| Vercel Pro | $20/mes | Necesario para cron (Step 8); Free alcanza para MVP |
| Supabase Free → Pro | $0–25/mes | Free alcanza para arrancar; Pro recomendado >100 usuarios |
| Anthropic Claude API | ~$10–50/mes | Pay-as-you-go según uso del chat Meni |
| Transbank | variable | Comisión por transacción (Celso ya paga) |
| n8n cloud (opcional) | $20/mes | Si no, self-hosted gratis en VPS |
| Kie.ai (imágenes) | one-time | Solo para productos nuevos (~$0.06/imagen) |
| Dominio | $10–20/año | .cl o .com |
| **Total fijo** | **~$50–115/mes** | Sin contar Transbank ni Kie.ai |

---

## 8. Próximos pasos sugeridos

**Completado ✅**
1. ~~Steps 1–6~~ — Supabase, catálogos, auth, checkout, detalle de pedido
2. ~~Auditoría Vercel~~ — build limpio, error pages, SEO, .env.example, español chileno
3. ~~Step 10~~ — Deploy en Vercel activo (GitHub → Vercel auto-deploy en push a master)
4. ~~Mapa Leaflet~~ — rediseño completo con GeoJSON local, búsqueda, lista expandible

**Completado ✅ — Step 8 + 9:**
5. Home dinámica con Supabase + Sección 3 (carrusel productos) + Sección 6 (recetas IA) + cron + admin recetas + 6 recetas en DB

**Siguiente después del Step 8+9:**
6. **[OPERACIONAL - URGENTE]** Agregar `CRON_SECRET` en Vercel Dashboard → Environment Variables (sin esto el cron de recetas falla con 401)
7. Credenciales Transbank producción + test end-to-end en dominio live
8. Step 7 (Meni chat) — un solo agente para web + WhatsApp vía n8n
9. OG image (`/public/og-image.png` 1200×630px)
10. Analytics (Vercel Analytics — 1 línea)
11. Emails transaccionales (Resend)
12. Dominio personalizado (elmenu.cl)
13. Página `/recetas/[id]` — detalle de receta con preparación paso a paso (actualmente las recetas no tienen campo `steps`, sería agregar a la tabla y al cron)

---

## 9. Cómo probar el checkout end-to-end (dev local)

1. Dev server corriendo: `npm run dev`
2. Ir a `http://localhost:3000/catalogo`, agregar productos por **al menos $20.000**
3. Carrito → **Pagar con tarjeta** → `/checkout`
4. Completar form: nombre, teléfono, dirección, elegir comuna
5. Click **Pagar … con Webpay** → pantalla de integración Transbank
6. Tarjeta de prueba:
   - **Número:** `4051 8856 0000 0044`
   - **CVV:** `123` · **Vencimiento:** `11/27` · **Rut:** `11.111.111-1` · **Clave dinámica:** `123`
7. Confirmación → `/checkout/confirmacion?status=success` → **Ver detalle** → `/pedido/[id]`

Para cancelación: click "Anular compra" en Transbank → `status=cancelled`
Para error: CVV `000` → `status=failed`

Más tarjetas de prueba: https://www.transbankdevelopers.cl/documentacion/como_empezar#tarjetas-de-prueba

---

*Documento actualizado tras: Step 8+9 completado (home dinámica, carrusel productos, recetas IA con 6 recetas en DB, admin recetas, cron Vercel, diseño profesional de RecipesSection). Commits `e774a00`, `<próximo>` — en producción en Vercel.*
