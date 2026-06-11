-- MIGRATION 0015 — Comunas exclusivas para mayoristas
--
-- Agrega la columna `mayorista_only_communes` a la tabla zones.
-- Las comunas listadas aquí no aparecen en el checkout minorista,
-- pero sí están disponibles para clientes mayoristas y admin.
-- Maipú se marca como primera comuna exclusiva mayorista.

ALTER TABLE zones ADD COLUMN IF NOT EXISTS mayorista_only_communes text[] DEFAULT '{}';

UPDATE zones
SET mayorista_only_communes = ARRAY['Maipú']
WHERE 'Maipú' = ANY(communes);
