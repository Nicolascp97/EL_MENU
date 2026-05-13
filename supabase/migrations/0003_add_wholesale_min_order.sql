-- ============================================================
-- MIGRATION 0003 — separar pedido mínimo minorista / mayorista
-- Hasta ahora zones.min_order aplicaba a todos los clientes.
-- A partir de Celso quiere dos umbrales distintos por rol.
-- ============================================================

ALTER TABLE zones
  ADD COLUMN IF NOT EXISTS min_order_wholesale INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN zones.min_order            IS 'Pedido mínimo CLP para clientes minoristas (rol minorista / guest)';
COMMENT ON COLUMN zones.min_order_wholesale  IS 'Pedido mínimo CLP para clientes mayoristas (rol mayorista)';
