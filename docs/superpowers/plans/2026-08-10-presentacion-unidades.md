# Presentación de unidades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar siempre la presentación real de productos minoristas y mayoristas, incluido `unit_qty`, sin cambiar lógica de venta.

**Architecture:** Un resolver puro en `src/lib/units.ts` elegirá la presentación efectiva y formateará etiqueta y precio equivalente. Las vistas solo renderizarán sus resultados. La migración actualizará tres filas de `products`, sin crear tablas ni cambiar RLS.

**Tech Stack:** Next.js 16, TypeScript, Node test runner, Playwright, Supabase SQL.

## Global Constraints

- No modificar `api/checkout/*`, `api/transbank/*`, `src/lib/orderMessage.ts` ni `src/lib/notify.ts`.
- No inferir pesos o cantidades de nombres ambiguos.
- No aplicar la migración remota ni hacer push a `master` sin instrucción explícita adicional.
- Ejecutar `npm run build` limpio antes de cualquier entrega o commit.

---

### Task 1: Resolver de presentación puro

**Files:**
- Create: `src/lib/units.ts`
- Create: `tests/units.test.ts`

**Interfaces:**
- Produces: `resolvePresentation(product, { wholesale })` con `{ label, perMeasure }`.
- Consumes: `Product` y `formatPrice`.

- [ ] **Step 1: Write the failing test**

Cubrir `gr + 250`, `unid + 3`, `malla 17kg`, `caja + 1`, fallback mayorista y equivalente por kilo/unidad.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/units.test.mts`
Expected: FAIL porque `src/lib/units.ts` no existe.

- [ ] **Step 3: Write minimal implementation**

Implementar selección de unidad mayorista idéntica a checkout, detección de unidades limpias y descriptivas, y equivalencia solo para gramos/kilos/unidades con cantidad distinta de uno.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/units.test.mts`
Expected: PASS.

### Task 2: Usar el resolver en todas las vistas

**Files:**
- Modify: `src/components/catalog/ProductCard.tsx`
- Modify: `src/components/catalog/CartDrawer.tsx`
- Modify: `src/components/checkout/OrderSummary.tsx`
- Modify: `src/app/pedido/[id]/page.tsx`
- Modify: `src/app/(catalog)/_components/HomeClient.tsx`
- Modify: `src/components/chat/ChatWidget.tsx`
- Modify: `src/components/admin/OrdersRealtimeClient.tsx`

**Interfaces:**
- Consumes: `resolvePresentation()` from Task 1.
- Produces: consistent labels in every client-facing product display.

- [ ] **Step 1: Write failing UI assertions**

Extender la prueba Playwright para que Almendra muestre `250 gr` en `/catalogo` y `500 gr` en `/mayorista`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/e2e/e2e/01-homepage.spec.ts --grep "Almendra"`
Expected: FAIL con las etiquetas actuales `/ gr`.

- [ ] **Step 3: Implement minimal view replacements**

Reemplazar concatenaciones de `unit` por la etiqueta resuelta. Mostrar `perMeasure` solo donde el diseño dispone de una segunda línea; conservar el precio actual y la estructura visual.

- [ ] **Step 4: Run targeted tests**

Run: `node --test --import tsx tests/units.test.ts` y la prueba Playwright anterior.
Expected: PASS.

### Task 3: Backfill inequívoco y verificación integral

**Files:**
- Create: `supabase/migrations/0017_backfill_unit_qty.sql`

**Interfaces:**
- Produces: valores de presentación correctos para tres nombres exactos; cero efectos sobre otras filas.

- [ ] **Step 1: Add idempotent SQL**

Actualizar solo `Limón Plateado 17kg` a `unit='caja 17kg', unit_qty=1`; `Pack Cebollas 3u` a `unit='unid', unit_qty=3`; y `Cebollín Docena` a `unit='Paquete (12 unidades)', unit_qty=1`, con coincidencias exactas de nombre y condiciones que permitan reejecución.

- [ ] **Step 2: Review SQL scope**

Run: `Get-Content supabase/migrations/0017_backfill_unit_qty.sql`
Expected: exactamente tres nombres, sin DDL, grants ni RLS.

- [ ] **Step 3: Verify integration**

Run: `npm run lint`, `npm run build`, y la suite disponible de Playwright.
Expected: exit 0 en cada comando.
