-- ============================================================
-- Migración: Soporte para Amipass y Edenred
-- Ejecutar en Supabase SQL Editor (es idempotente — seguro de re-ejecutar)
-- ============================================================

-- NOTA: payment_status ya es TEXT CHECK (no ENUM), por lo que NO se necesita
-- ALTER TYPE. Solo se añade la columna payment_method.

-- 1. Añadir columna payment_method (nullable para no romper historial)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT
  CHECK (payment_method IN ('webpay', 'transfer', 'amipass', 'edenred'));

-- 2. Backfill: deducir método de pago en órdenes históricas
--    Órdenes con transbank_token → Webpay
UPDATE orders
  SET payment_method = 'webpay'
  WHERE transbank_token IS NOT NULL
    AND payment_method IS NULL;

--    El resto → Transferencia (creadas antes de esta columna)
UPDATE orders
  SET payment_method = 'transfer'
  WHERE payment_method IS NULL;

-- 3. Índice para reportes admin y filtros
CREATE INDEX IF NOT EXISTS idx_orders_payment_method
  ON orders(payment_method);
