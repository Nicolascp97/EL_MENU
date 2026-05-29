-- MIGRATION 0009 — Tipo de cliente en orders (mayorista | minorista)
--
-- Permite distinguir en la notificación de WhatsApp si el pedido vino de un
-- mayorista o del catálogo minorista. La diferencia es operativa: el mayorista
-- recibe caja/saco/malla completa; el minorista recibe por unidad o kg.
-- Lo derivamos de `useWholesale = role in ('mayorista','admin')` en checkout.
-- Nullable para no romper los pedidos históricos.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_type TEXT
  CHECK (customer_type IN ('minorista', 'mayorista'));
