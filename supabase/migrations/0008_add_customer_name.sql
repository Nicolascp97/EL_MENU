-- MIGRATION 0008 — Nombre del cliente en orders
--
-- El frontend captura el nombre del cliente en el checkout, pero hasta ahora
-- nunca se guardaba en la tabla orders. Esto causaba que la notificación de
-- WhatsApp mostrara "undefined" en lugar del nombre del cliente.
-- Columna nullable para no romper las 59 órdenes históricas (quedan sin nombre).

ALTER TABLE orders ADD COLUMN IF NOT EXISTS name TEXT;
