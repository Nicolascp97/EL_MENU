-- MIGRATION 0017 — Presentaciones con la cantidad declarada en el nombre
--
-- Tres productos traen la cantidad en el nombre pero no en los datos, así que
-- el catálogo mostraba "Caja" o "Paquete" sin decir cuánto lleva el cliente.
-- Solo se corrigen estos tres, que son inequívocos. El resto de las cajas
-- (Caja Plátanos, Caja piña, etc.) las completa el dueño desde el panel, que
-- ahora tiene el campo de contenido.
--
-- Convención usada: envase + contenido en un solo string ('caja 17kg'), igual
-- que los formatos que ya existían en la base ('malla 17kg', 'saco 24kg',
-- 'caja 14u'). Ver src/lib/units.ts.
--
-- Es segura de correr más de una vez: cada UPDATE se filtra con IS DISTINCT
-- FROM, así que si los valores ya están puestos no toca ninguna fila.

-- Limón Plateado 17kg — el nombre dice 17kg; la caja se vende en ambos canales,
-- por eso también se corrige la unidad mayorista (era el hueco de la v1: el
-- catálogo mayorista, que es donde se venden las cajas, seguía diciendo "Caja").
UPDATE products
SET unit = 'caja 17kg',
    unit_wholesale = CASE WHEN unit_wholesale IS NOT NULL THEN 'caja 17kg' ELSE unit_wholesale END
WHERE name = 'Limón Plateado 17kg'
  AND (unit IS DISTINCT FROM 'caja 17kg'
       OR (unit_wholesale IS NOT NULL AND unit_wholesale IS DISTINCT FROM 'caja 17kg'));

-- Pack Cebollas 3u — el nombre dice 3 unidades, unit_qty estaba en 1.
UPDATE products
SET unit = 'unid',
    unit_qty = 3
WHERE name = 'Pack Cebollas 3u'
  AND (unit IS DISTINCT FROM 'unid' OR unit_qty IS DISTINCT FROM 3);

-- Cebollín Docena — una docena son 12 unidades.
UPDATE products
SET unit = 'paq 12u',
    unit_qty = 1
WHERE name = 'Cebollín Docena'
  AND (unit IS DISTINCT FROM 'paq 12u' OR unit_qty IS DISTINCT FROM 1);
