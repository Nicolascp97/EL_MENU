# El Menú — Estado del Proyecto

> Última actualización: **2026-05-12** (post Step 5 + 6 — checkout Transbank y detalle de pedido)
> Stack: Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind v4 · Supabase (PG + Auth + Storage + Realtime) · Anthropic Claude · Kie.ai (imágenes) · Transbank Webpay · Vercel

---

## Resumen ejecutivo

El proyecto está aproximadamente al **75% del camino a producción**. Está terminada toda la base — Supabase con 144 productos reales y 185 imágenes IA, auth de mayoristas, catálogos minorista/mayorista con identidad visual diferenciada, buscador, carrito persistente, **checkout completo con Transbank Webpay Plus**, **detalle de pedido**, panel admin con guard de rol, infraestructura de Storage. Falta el **agente IA Meni** (web + WhatsApp), el **cron de recetas**, **unificar la home con Supabase** y el **deploy a Vercel** con dominio.

---

## 1. Lo que está listo ✅

### 1.1 Infraestructura Supabase
- Proyecto `xneydkfzcveigmbtpltk` con 7 tablas: `categories`, `products`, `zones`, `profiles`, `orders`, `recipes`, `conversations`
- 4 migrations aplicadas: `0001_role_payment_recipes`, `0002_harden_security_warnings`, `0003_add_wholesale_min_order`, `0004_add_wholesale_only`
- RLS habilitada en todas las tablas + policies por rol
- Trigger `handle_new_user` crea profile automáticamente al registrarse
- Realtime habilitado en `orders` y `conversations`
- Bucket público `product-images` en Storage (~5MB max, jpg/png/webp)
- Advisors de seguridad: **0 issues**

### 1.2 Catálogo de productos
- **144 productos** en **8 categorías** (verduras, frutas, hierbas, tubérculos, cítricos, legumbres, frutos secos, almacén)
- Precios minorista + mayorista cuando aplica
- Bandera `wholesale_only` para cajas/sacos/mallas grandes que solo van a /mayorista
- 25 productos marcados `featured = true` (sección Ofertas)
- Fuente: `tabla-productos-minoristras.md` + `tabla-productos-mayoristas.md` (los archivos en la raíz del proyecto)
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
- **`/mayorista`** (público para ver): hero dorado, solo `role=mayorista|admin` puede comprar — para anónimos/minoristas muestra pill "🔒 Solo empresas" y banner "Registrate como empresa"
- `CatalogModeTabs` sticky para alternar
- `CategoryStrip` con cards grandes (emoji 56px + count por categoría)
- Sección virtual **🏷️ Ofertas** (filtra productos cuyo nombre contiene "oferta")
- Banners contextuales según rol (cross-sell mayorista → minorista, etc)

### 1.5 Buscador
- Normalización de acentos (typeás "limon" → matchea "Limón")
- Búsqueda sobre nombre + descripción + categoría
- Sincronización con URL (`/catalogo?q=tomate&cat=verduras`) con debounce 300ms — links compartibles
- Botón ✕ para limpiar
- Funciona desde search bar del home Y desde el hero de cada catálogo

### 1.6 Auth y registro mayorista (Step 4 del blueprint)
- **`/mayorista/login`** — email + password, signInWithPassword, redirige a `?next=…`
- **`/mayorista/registro`** — email/password/nombre/teléfono, `signUp({ data: { role: 'mayorista' } })`, handle confirmación de email
- **`src/proxy.ts`** corre en todas las rutas (refresh de tokens Supabase) y redirige `/admin` + `/mi-cuenta` si no hay sesión
- **`src/app/admin/layout.tsx`** chequea `profile.role === 'admin'` (autorización a nivel de layout)
- **`UserMenu`** dropdown con perfil, rol (badge color-coded), links contextuales, **logout** vía Server Action `signOutAction`
- **`/mi-cuenta`** con datos personales + lista de pedidos + botón cerrar sesión

### 1.7 Home y navegación
- Top bar con info de despacho
- Navbar con búsqueda, carrito badge (real, useCart + zustand persist), UserMenu
- Hero con CTAs reales (form de búsqueda → /catalogo)
- Pills de categorías → links a `/catalogo?cat=…`
- Cards circles → links a `/catalogo?cat=…`
- Sección "Asistente IA" (placeholder hasta Step 7, click → WhatsApp con mensaje precargado)
- Sección B2B → /mayorista
- Testimonials, recetas (mock), footer
- WhatsApp + Instagram + Facebook con URLs reales (`@el_menu._`)
- CartDrawer integrado (apertura desde botón carrito)

### 1.8 Componentes y librerías
- `src/lib/supabase/client.ts` (browser), `server.ts` (SSR), `admin.ts` (service role)
- `src/hooks/useCart.ts` (zustand + persist localStorage)
- `src/components/auth/UserMenu.tsx`
- `src/components/catalog/CatalogClient.tsx`, `CatalogHero.tsx`, `CatalogModeTabs.tsx`, `CategoryStrip.tsx`, `ProductCard.tsx`, `CartDrawer.tsx`, `Navbar.tsx`
- `src/types/database.ts` con tipos para todas las tablas

### 1.9 Checkout con Transbank Webpay Plus (Step 5 ✅)
- `transbank-sdk@6.1.1` instalado
- `src/lib/transbank.ts` con `createWebpayPlus()` — usa credenciales de integración por default; cuando `TRANSBANK_ENVIRONMENT=production` exige `TRANSBANK_COMMERCE_CODE` + `TRANSBANK_API_KEY_SECRET`
- `POST /api/checkout` — recalcula precios server-side según rol (`minorista`/`mayorista`/`admin`), valida stock + comuna + mínimo de pedido, crea `order` con `payment_status='pendiente'`, inicia `tx.create(buyOrder, sessionId, total, returnUrl)` y devuelve `{ orderId, url, token }`
- `GET/POST /api/transbank/return` — endpoint de retorno que ejecuta `tx.commit(token_ws)`, actualiza `orders.payment_status` a `pagado`/`fallido` según `response_code === 0 && status === 'AUTHORIZED'`, maneja cancelación (TBK_TOKEN sin token_ws), redirige a `/checkout/confirmacion?status=…&orderId=…`
- `/checkout/page.tsx` — server component que carga zonas + datos del perfil (prefill); `CheckoutClient.tsx` con form (nombre, teléfono, dirección, comuna, notas) + `OrderSummary.tsx` con totales dinámicos por comuna y validación de mínimo
- Submit del form: POST a `/api/checkout`, recibe `{ url, token }`, vacía el carrito, construye un `<form>` con `token_ws` oculto y lo postea programáticamente al `url` de Transbank
- `CartDrawer.tsx` ahora tiene 2 CTAs: **Pagar con tarjeta** (→ `/checkout`) y **Pedir por WhatsApp** (legacy)

### 1.10 Detalle de pedido (Step 6 ✅)
- `/pedido/[id]/page.tsx` — server component que valida acceso:
  - Pedidos de invitados (user_id NULL) son accesibles con la URL (vínculo único)
  - Pedidos con dueño requieren sesión del dueño o rol admin
- Muestra: número (`#${id.slice(0,8)}`), fecha, items con precios unitarios, total, dirección + comuna, teléfono, notas, estado (badge color-coded), `payment_status`, canal
- CTAs: seguir comprando + consultar por WhatsApp con el número pre-cargado en el mensaje

### 1.11 Configuración
- `next.config.ts` con `turbopack.root` y `remotePatterns` para Supabase Storage
- `src/proxy.ts` (renombrado de middleware.ts por Next 16)
- Dev server limpio sin warnings

---

## 2. Lo que falta para producción ⏳

### 2.1 Step 7 — Chat widget Meni (web)
**Estimado:** 2 días
- [ ] `/app/api/chat/route.ts` — streaming con Anthropic SDK; system prompt de Meni; herramientas para consultar `products`, `zones`, crear `orders`
- [ ] `src/hooks/useChat.ts` — estado de mensajes, isOpen, isLoading
- [ ] `src/components/chat/ChatWidget.tsx` — botón flotante bottom-right
- [ ] `src/components/chat/ChatModal.tsx` — modal con burbujas
- [ ] Integrar `<ChatWidget />` en el layout principal
- [ ] En home: cambiar botón "Chatear con el asistente" (que hoy va a wa.me) para que abra ChatModal
- [ ] `/app/api/webhook/whatsapp/route.ts` — mismo sistema vía n8n con secret de auth
- [ ] Persistir conversación en tabla `conversations` (ya existe en DB)

### 2.2 Step 8 — Recetas IA
**Estimado:** 1 día
- [ ] `/app/api/cron/generar-recetas/route.ts` — verificar `Authorization: Bearer CRON_SECRET`, llamar Claude con productos en stock, parsear JSON, hacer `DELETE FROM recipes WHERE active=true` + `INSERT` de 3 nuevas
- [ ] `vercel.json` con `crons: [{ path: '/api/cron/generar-recetas', schedule: '0 6 * * 1' }]` (lunes 6 AM)
- [ ] `src/components/catalog/RecipesSection.tsx` — cards reales con ingredientes + "Agregar al carrito"
- [ ] Integrar en home reemplazando la sección actual (hoy hardcoded)
- [ ] `/app/admin/recetas/page.tsx` — botón "Regenerar ahora" + lista de recetas activas, toggle active

### 2.3 Step 9 — Unificar home con Supabase
**Estimado:** 0.5 día
- [ ] Cambiar [src/app/(catalog)/page.tsx](src/app/(catalog)/page.tsx) para que sea Server Component y fetchee productos reales (`featured=true AND active=true`)
- [ ] Reemplazar arrays hardcoded `OFFERS`, `POPULAR`, `NEW` dentro de `CarouselTabs` por queries
- [ ] Mantener el CSS inline (ya aprobado visualmente) — solo cambiar la fuente de datos
- [ ] El badge "Destacado" y "−X%" ya está en `ProductCard` para reutilizar

### 2.4 Step 10 — Deploy a producción
**Estimado:** 1 día
- [ ] Crear repo en GitHub (`elmenu-app` o `elmenu-plan3`)
- [ ] Push del código
- [ ] Conectar repo a Vercel (plan **Pro** $20/mes — necesario para crons)
- [ ] Configurar **TODAS** las env vars (sección 4 abajo)
- [ ] Apuntar dominio personalizado (¿qué dominio compraron?)
- [ ] Activar Vercel Cron
- [ ] Test del flujo completo en prod
- [ ] Apuntar webhook de Transbank al dominio prod
- [ ] Configurar n8n con `N8N_WEBHOOK_BASE_URL` apuntando al dominio prod

### 2.5 Mejoras menores pendientes
- [ ] **Imagen del placeholder default** en [public/placeholders/default.svg](public/placeholders/default.svg) — hoy es un SVG genérico
- [ ] **404 page** custom (`/app/not-found.tsx`)
- [ ] **Loading states** en `/catalogo` y `/mayorista` (Suspense + skeleton)
- [ ] **SEO**: meta tags por página, sitemap.xml, robots.txt, Open Graph image
- [ ] **Analytics** (opcional): Vercel Analytics o Google Analytics
- [ ] **Email de orden creada** — cuando se crea un pedido, mandar mail a Celso (vía Resend, Supabase Edge Function, o Vercel function)
- [ ] **Favoritos** — la columna `profiles.favorites UUID[]` existe en DB pero no hay UI ni hook (defer to v2)

---

## 3. Checklist pre-producción

### 3.1 Supabase (consola supabase.com)
- [ ] Auth → Providers → Email → **Confirm email**: decidir si ON (más seguro, requiere SMTP) o OFF (testing más ágil)
- [ ] Auth → URL Configuration → **Site URL** = dominio final
- [ ] Auth → Email Templates → personalizar con marca El Menú (opcional)
- [ ] Settings → Database → Backups: verificar daily backup habilitado
- [ ] (Opcional) Pasar a plan Pro ($25/mes) para más recursos + Point-in-time recovery

### 3.2 Primer usuario admin
1. Registrate como mayorista desde `/mayorista/registro` con el email de Celso
2. Confirmá email si está ON
3. Subir el rol manualmente:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE id = (
     SELECT id FROM auth.users WHERE email = 'celso@email.cl'
   );
   ```

### 3.3 Transbank
- [ ] Verificar credenciales de **producción** con Celso (no las de integración)
- [ ] `TRANSBANK_COMMERCE_CODE` + `TRANSBANK_API_KEY_SECRET` en env vars de Vercel
- [ ] Webhook de confirmación apuntado a `https://{dominio}/api/transbank`
- [ ] Probar con tarjeta de **integración** primero antes de live

### 3.4 Vercel
- [ ] Plan **Pro** activado (cron es exclusivo de Pro)
- [ ] Variables de entorno cargadas (ver sección 4)
- [ ] Dominio personalizado verificado (DNS apuntado)
- [ ] Preview deployments habilitados para branches
- [ ] Cron activado vía `vercel.json` (lo creamos en Step 8)

### 3.5 Pruebas de aceptación
- [ ] Visitante anónimo: ve `/`, `/catalogo`, `/mayorista` con imágenes correctas
- [ ] Mayorista nuevo: registro → confirmación email → login → ve precios mayoristas → agrega al carrito → checkout Transbank → pago aprobado
- [ ] Mayorista existente: login → /mi-cuenta → ve pedido nuevo → recibe email confirmación (cuando implementemos)
- [ ] Admin: login → /admin → ve pedido en tiempo real (Realtime)
- [ ] Admin: /admin/productos → CRUD productos (necesita implementarse — hoy es solo lectura)
- [ ] Chat web: usuario habla con Meni → arma pedido → envía a carrito
- [ ] WhatsApp: cliente manda mensaje → n8n → endpoint → Meni responde → pedido creado
- [ ] Cron lunes 6 AM: recetas se regeneran automáticamente

---

## 4. Variables de entorno

### 4.1 Actualmente configuradas en `.env.local` (dev)
| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (cliente browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (bypass RLS, server-only) |
| `ANTHROPIC_API_KEY` | Claude API para Meni (Step 7+) |
| `NEXT_PUBLIC_WA_NUMBER` | Número WhatsApp Celso (56954952395) |
| `NEXT_PUBLIC_APP_URL` | URL base de la app (localhost en dev) |
| `KIE_API_KEY` | Generación de imágenes (solo dev/admin, no se usa en runtime) |

### 4.2 Faltantes para producción
| Variable | Para qué | Cuándo se necesita |
|---|---|---|
| `TRANSBANK_COMMERCE_CODE` | Código comercio Transbank | Step 5 |
| `TRANSBANK_API_KEY_SECRET` | Secret Transbank | Step 5 |
| `TRANSBANK_ENVIRONMENT` | `'integration'` o `'production'` | Step 5 |
| `N8N_WEBHOOK_BASE_URL` | URL base del n8n | Step 7 |
| `N8N_WEBHOOK_SECRET` | Secret para validar webhooks de n8n | Step 7 |
| `CRON_SECRET` | Token bearer para `/api/cron/*` | Step 8 |
| `RESEND_API_KEY` *(opcional)* | Envío de emails transaccionales | mejora |

---

## 5. Archivos clave del proyecto

```
elmenu-app/
├── ESTADO-DEL-PROYECTO.md        ← este documento
├── AGENTS.md                     ← reglas para agentes IA (Next 16, no use lo viejo)
├── tabla-productos-minoristras.md ← fuente del seed minorista
├── tabla-productos-mayoristas.md ← fuente del seed mayorista
├── next.config.ts                ← Turbopack root + remotePatterns
├── src/
│   ├── proxy.ts                  ← guard /admin y /mi-cuenta (ex middleware)
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── (catalog)/page.tsx    ← HOME (mock data — pendiente Step 9)
│   │   ├── catalogo/page.tsx     ← Catálogo minorista público
│   │   ├── mayorista/
│   │   │   ├── page.tsx          ← Catálogo mayorista público (compra condicionada)
│   │   │   ├── login/page.tsx
│   │   │   └── registro/page.tsx
│   │   ├── mi-cuenta/page.tsx    ← Perfil + pedidos + logout
│   │   ├── admin/
│   │   │   ├── layout.tsx        ← role check === 'admin'
│   │   │   ├── page.tsx          ← pedidos en tiempo real (Realtime)
│   │   │   └── productos/page.tsx
│   │   ├── auth/actions.ts       ← signOutAction (Server Action)
│   │   └── api/
│   │       └── webhook/whatsapp/route.ts (placeholder)
│   ├── components/
│   │   ├── auth/UserMenu.tsx
│   │   └── catalog/
│   │       ├── Navbar.tsx
│   │       ├── CatalogClient.tsx       ← orquestador (filtros, grid)
│   │       ├── CatalogHero.tsx         ← hero por modo + banner contextual
│   │       ├── CatalogModeTabs.tsx     ← tabs Minorista | Mayorista
│   │       ├── CategoryStrip.tsx       ← cards grandes de categorías
│   │       ├── ProductCard.tsx         ← card con imagen, precio, badge
│   │       ├── CartDrawer.tsx
│   │       ├── CategoryFilter.tsx (legacy, no se usa)
│   │       └── SearchBar.tsx (legacy, no se usa)
│   ├── hooks/useCart.ts          ← zustand + persist
│   ├── lib/
│   │   ├── supabase/{client,server,admin}.ts
│   │   └── utils.ts (cn, formatPrice, slugify)
│   └── types/database.ts         ← tipos de DB
├── supabase/
│   ├── schema.sql                ← base
│   ├── seed.sql                  ← 144 productos + zona + 8 categorías
│   └── migrations/
│       ├── 0001_role_payment_recipes.sql
│       ├── 0002_harden_security_warnings.sql
│       ├── 0003_add_wholesale_min_order.sql
│       └── 0004_add_wholesale_only.sql
├── scripts/
│   ├── generate-product-images.mjs   ← Kie.ai → Supabase Storage → DB
│   └── import-orphan-image.mjs       ← rescatar tareas huérfanas pagas
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

---

## 7. Costos mensuales estimados en producción

| Servicio | Costo | Notas |
|---|---:|---|
| Vercel Pro | $20/mes | Necesario para cron |
| Supabase Free → Pro | $0–25/mes | Free alcanza para arrancar; Pro recomendado >100 usuarios |
| Anthropic Claude API | ~$10–50/mes | Pay-as-you-go según uso del chat |
| Transbank | variable | Comisión por transacción (Celso ya paga) |
| n8n cloud (opcional) | $20/mes | Si no, self-hosted gratis en VPS |
| Kie.ai (imágenes) | one-time | Solo regenerar productos nuevos (~$0.06/imagen) |
| Dominio | $10–20/año | .cl o .com |
| **Total fijo** | **~$50–115/mes** | Sin contar Transbank |

---

## 8. Próximos pasos sugeridos

**Prioridad 1 — Para vender (lo que falta para MVP en producción):**
1. ~~Step 5 (Transbank checkout)~~ — ✅ DONE
2. ~~Step 6 (pedido confirmación)~~ — ✅ DONE
3. Step 10 (deploy a Vercel + dominio) — para que esté en internet
4. Configurar credenciales Transbank live de Celso
5. Crear admin manualmente + probar flujo end-to-end con tarjeta de prueba

**Prioridad 2 — Diferenciación:**
6. Step 7 (Meni chat web) — diferencial competitivo principal
7. Step 9 (home dinámica) — reemplazar mocks por data real

**Prioridad 3 — Operación:**
8. Step 8 (recetas IA cron) — feature de marketing/retención
9. WhatsApp via n8n (parte del Step 7)
10. Emails transaccionales (Resend o Edge Function)
11. SEO, 404, analytics, loading states

**Tiempo estimado total para llegar a producción mínima viable (P1):** ~1–2 días de desarrollo restantes (deploy a Vercel + dominio + setup de Transbank live).

---

## 9. Cómo probar el checkout end-to-end (dev local)

1. Asegurate que el dev server esté corriendo: `npm run dev`
2. Visitá `http://localhost:3000/catalogo`, agregá productos al carrito por **al menos $20.000** (mínimo minorista)
3. Abrí el carrito → click **Pagar con tarjeta** → te redirige a `/checkout`
4. Completá el form: nombre, teléfono, dirección, elegí comuna (cualquiera de las 21 de Santiago), notas opcional
5. Click **Pagar … con Webpay** → vas a la pantalla de Transbank de integración
6. Usá la **tarjeta de prueba**:
   - **Tarjeta:** `4051 8856 0000 0044`
   - **CVV:** `123`
   - **Vencimiento:** `11/27`
   - **Rut:** `11.111.111-1`
   - **Clave dinámica:** `123`
7. Transbank confirma → te redirige a `/checkout/confirmacion?status=success&orderId=…`
8. Click **Ver detalle del pedido** → `/pedido/[id]` muestra el resumen completo

Para probar **cancelación**: en la pantalla de Transbank, click "Anular compra" → te lleva a `/checkout/confirmacion?status=cancelled`.

Para probar **error**: usá CVV `000` o cualquier dato inválido → Transbank rechaza → te lleva a `/checkout/confirmacion?status=failed`.

Más tarjetas de prueba (rechazadas, débito, etc.) en https://www.transbankdevelopers.cl/documentacion/como_empezar#tarjetas-de-prueba

---

*Documento actualizado tras Step 5 + 6 (checkout Transbank + detalle de pedido). Actualizar después de cada step grande.*
