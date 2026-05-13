-- ============================================================
-- MIGRATION 0004 — products.wholesale_only
-- Bandera para productos que solo deben aparecer en /mayorista
-- (cajas, sacos, mallas grandes). /catalogo filtra por
-- wholesale_only = false.
-- Aplicado vía MCP el 2026-05-11.
-- ============================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS wholesale_only BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_products_wholesale_only ON products(wholesale_only);

COMMENT ON COLUMN products.wholesale_only IS 'Si true, el producto solo aparece en /mayorista (típicamente: cajas, sacos, mallas grandes).';
