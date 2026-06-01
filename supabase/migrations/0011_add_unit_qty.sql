-- MIGRATION 0011 — Cantidad por unidad de venta (presentación del producto)
--
-- Permite expresar "cuánto se lleva el cliente por cada unidad". Por ejemplo,
-- una Aceituna nacional retail: unit='gr', unit_qty=250 → "(250 gr)".
-- En mayorista: unit_wholesale='kg', unit_qty_wholesale=1 → "(1 Kg)".
--
-- Ambas columnas son numeric. Si unit_qty_wholesale queda en NULL, el sistema
-- cae a unit_qty (igual que unit_wholesale cae a unit cuando no se setea).
-- Defaults a 1 para no romper los productos existentes.

ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_qty           NUMERIC DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_qty_wholesale NUMERIC;
