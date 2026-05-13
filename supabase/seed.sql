-- ============================================================
-- EL MENÚ — Seed de datos
-- Catálogo real de Celso (fuente: tabla-productos-minoristras.md
-- y tabla-productos-mayoristas.md, 2026-05-11).
-- 144 productos en 8 categorías. featured=true marca los items
-- en CAMPANASO + EXTRA OFERTAS. wholesale_only=true son cajas/
-- sacos/mallas grandes que solo aparecen en /mayorista.
-- Ejecutar DESPUÉS de schema.sql + migraciones 0001-0004.
-- Idempotente vía DELETE inicial.
-- ============================================================

-- Wipe para reseteo limpio
DELETE FROM products;
DELETE FROM categories;
DELETE FROM zones;

-- ─── CATEGORÍAS ─────────────────────────────────────────────
INSERT INTO categories (name, slug, emoji, "order") VALUES
  ('Verduras',     'verduras',     '🥬', 1),
  ('Frutas',       'frutas',       '🍎', 2),
  ('Hierbas',      'hierbas',      '🌿', 3),
  ('Tubérculos',   'tuberculos',   '🥔', 4),
  ('Cítricos',     'citricos',     '🍋', 5),
  ('Legumbres',    'legumbres',    '🫘', 6),
  ('Frutos Secos', 'frutos-secos', '🌰', 7),
  ('Almacén',      'almacen',      '🍯', 8);

-- ─── ZONA DE DESPACHO ───────────────────────────────────────
INSERT INTO zones (name, communes, delivery_price, min_order, min_order_wholesale) VALUES
  ('Santiago',
   ARRAY[
     'Santiago', 'Providencia', 'Las Condes', 'Vitacura', 'Lo Barnechea',
     'Ñuñoa', 'La Reina', 'Macul', 'Peñalolén', 'La Florida',
     'Puente Alto', 'San Joaquín', 'San Miguel', 'La Cisterna', 'El Bosque',
     'La Granja', 'San Ramón', 'Pedro Aguirre Cerda', 'Estación Central',
     'Maipú', 'Cerrillos'
   ],
   2990, 20000, 60000);

-- ─── PRODUCTOS ──────────────────────────────────────────────
INSERT INTO products (name, description, price, price_wholesale, category_id, stock, unit, featured, wholesale_only) VALUES

  -- ═══ CAMPANASO (ofertas destacadas) ═══════════════════════
  ('Pack Cebollas Grandes',   'Pack de 5 cebollas grandes en oferta.',         1500,  NULL, (SELECT id FROM categories WHERE slug='tuberculos'),   30, '5 unid',   true, false),
  ('Malla Cebollas 42u',      'Malla con 42 cebollas, ideal para granel.',    11500,  NULL, (SELECT id FROM categories WHERE slug='tuberculos'),   12, 'malla 42u',true, false),
  ('Saco Papas Lavadas',      'Saco de papas lavadas, 24 kg.',                11900, 11900, (SELECT id FROM categories WHERE slug='tuberculos'),   15, 'saco 24kg',true, false),
  ('Tomate Oferta',           'Tomate fresco al kilo, en oferta.',             1400,  1300, (SELECT id FROM categories WHERE slug='verduras'),     60, '1 kg',     true, false),
  ('Palta Hass Pequeña',      'Palta Hass pequeña, en su punto, al kilo.',     2500,  2500, (SELECT id FROM categories WHERE slug='frutas'),       40, '1 kg',     true, false),
  ('Palta Hass Grande',       'Palta Hass grande peruana, cremosa, al kilo.',  4800,  3200, (SELECT id FROM categories WHERE slug='frutas'),       30, '1 kg',     true, false),
  ('Limón Oferta',            'Limón fresco al kilo, en oferta.',               990,   690, (SELECT id FROM categories WHERE slug='citricos'),     60, '1 kg',     true, false),
  ('Pimentón Verde Oferta',   'Pimentón verde fresco, en oferta.',              800,   900, (SELECT id FROM categories WHERE slug='verduras'),     50, '1 unid',   true, false),
  ('Frutilla Oferta',         'Frutilla fresca de temporada, en oferta.',      2990,  NULL, (SELECT id FROM categories WHERE slug='frutas'),       25, '1 kg',     true, false),
  ('Pepino Oferta',           'Pepino fresco, en oferta.',                      600,   600, (SELECT id FROM categories WHERE slug='verduras'),     50, '1 unid',   true, false),
  ('Pimentón Rojo Oferta',    'Pimentón rojo fresco, en oferta.',               900,   850, (SELECT id FROM categories WHERE slug='verduras'),     40, '1 unid',   true, false),
  ('Miel Natural 1kg',        'Miel natural pura, sin aditivos.',              6990,  5000, (SELECT id FROM categories WHERE slug='almacen'),      20, '1 kg',     true, false),
  ('Miel de Panal 230g',      'Miel de panal natural, antes $4.990 ahora $3.990.', 3990, 3400, (SELECT id FROM categories WHERE slug='almacen'),      15, '230 gr',   true, false),

  -- ═══ EXTRA OFERTAS ════════════════════════════════════════
  ('Clementina Oferta',       'Clementina dulce al kilo, en oferta.',          1800,  NULL, (SELECT id FROM categories WHERE slug='citricos'),     30, '1 kg',     true, false),
  ('Frutilla Oferta Especial','Frutilla oferta especial al kilo.',             2900,  NULL, (SELECT id FROM categories WHERE slug='frutas'),       20, '1 kg',     true, false),
  ('Pack Pepinos Primera',    'Pack de 3 pepinos primera calidad.',            1800,  NULL, (SELECT id FROM categories WHERE slug='verduras'),     20, '3 unid',   true, false),
  ('Mix Almendra y Nueces',   'Mix de almendras y nueces, 230 gr.',            2990,  NULL, (SELECT id FROM categories WHERE slug='frutos-secos'), 20, '230 gr',   true, false),
  ('Porotos Burros 1kg',      'Porotos burros del año, al kilo.',              3300,  NULL, (SELECT id FROM categories WHERE slug='legumbres'),    20, '1 kg',     true, false),
  ('Porotos Burros 500g',     'Porotos burros del año, 500 gr.',               1890,  NULL, (SELECT id FROM categories WHERE slug='legumbres'),    25, '500 gr',   true, false),
  ('Lentejas del Año 1kg',    'Lentejas del año, al kilo.',                    3600,  NULL, (SELECT id FROM categories WHERE slug='legumbres'),    20, '1 kg',     true, false),
  ('Lentejas del Año 500g',   'Lentejas del año, 500 gr.',                     1890,  NULL, (SELECT id FROM categories WHERE slug='legumbres'),    25, '500 gr',   true, false),
  ('Pack Papas Nuevas',       'Pack de papas nuevas, 3 kg.',                   2000,  NULL, (SELECT id FROM categories WHERE slug='tuberculos'),   20, '3 kg',     true, false),
  ('Malla Cebollas 40u',      'Malla con 40 cebollas (aprox).',                9500, 10000, (SELECT id FROM categories WHERE slug='tuberculos'),   15, 'malla 40u',true, false),
  ('Ajos Importados',         'Pack de 3 ajos importados.',                    1290,  NULL, (SELECT id FROM categories WHERE slug='tuberculos'),   25, '3 unid',   true, false),
  ('Zapallos Italianos Arica','Pack de 3 zapallos italianos de Arica.',        1500,  NULL, (SELECT id FROM categories WHERE slug='verduras'),     20, '3 unid',   true, false),

  -- ═══ FRUTAS PRIMERA ═══════════════════════════════════════
  ('Maracuyá 1kg',            'Maracuyá fresca, al kilo.',                     3890,  NULL, (SELECT id FROM categories WHERE slug='frutas'),       15, '1 kg',   false, false),
  ('Maracuyá 500g',           'Maracuyá fresca, 500 gr.',                      1950,  NULL, (SELECT id FROM categories WHERE slug='frutas'),       20, '500 gr', false, false),
  ('Uva Verde',               'Uva verde extra, al kilo.',                     2990,  2900, (SELECT id FROM categories WHERE slug='frutas'),       25, '1 kg',   false, false),
  ('Clementina',              'Clementina fresca al kilo.',                    1890,  NULL, (SELECT id FROM categories WHERE slug='citricos'),     40, '1 kg',   false, false),
  ('Kiwi',                    'Kiwi extra al kilo.',                           2500,  NULL, (SELECT id FROM categories WHERE slug='frutas'),       20, '1 kg',   false, false),
  ('Mango Peruano',           'Mango peruano fresco, unidad.',                 1490,  NULL, (SELECT id FROM categories WHERE slug='frutas'),       25, '1 unid', false, false),
  ('Mango Peruano 1kg',       'Mango peruano fresco, al kilo.',                3790,  NULL, (SELECT id FROM categories WHERE slug='frutas'),       20, '1 kg',   false, false),
  ('Manzana Roja',            'Manzana roja de exportación, al kilo.',         1990,  NULL, (SELECT id FROM categories WHERE slug='frutas'),       40, '1 kg',   false, false),
  ('Mix Manzanas',            'Mix de manzanas extra, al kilo.',               1990,  NULL, (SELECT id FROM categories WHERE slug='frutas'),       30, '1 kg',   false, false),
  ('Manzana Verde',           'Manzana verde de exportación, al kilo.',        1990,  NULL, (SELECT id FROM categories WHERE slug='frutas'),       35, '1 kg',   false, false),
  ('Naranja',                 'Naranja fresca, al kilo.',                      1800,  NULL, (SELECT id FROM categories WHERE slug='citricos'),     40, '1 kg',   false, false),
  ('Piña',                    'Piña primera calidad, unidad.',                 3990,  3500, (SELECT id FROM categories WHERE slug='frutas'),       15, '1 unid', false, false),
  ('Plátano',                 'Plátano Ecuador, al kilo.',                     1800,  1500, (SELECT id FROM categories WHERE slug='frutas'),       50, '1 kg',   false, false),
  ('Frutilla 500g',           'Frutilla de zona, 500 gr.',                     1500,  NULL, (SELECT id FROM categories WHERE slug='frutas'),       25, '500 gr', false, false),
  ('Frutilla',                'Frutilla de zona, al kilo.',                    2900,  2500, (SELECT id FROM categories WHERE slug='frutas'),       20, '1 kg',   false, false),
  ('Plátano Verde',           'Plátano verde, al kilo.',                       2990,  2500, (SELECT id FROM categories WHERE slug='frutas'),       20, '1 kg',   false, false),
  ('Plátano Macho Amarillo',  'Plátano macho amarillo, al kilo.',              2990,  2800, (SELECT id FROM categories WHERE slug='frutas'),       20, '1 kg',   false, false),
  ('Pera de Agua',            'Pera de agua de exportación, al kilo.',         1690,  NULL, (SELECT id FROM categories WHERE slug='frutas'),       25, '1 kg',   false, false),
  ('Pera de Agua 500g',       'Pera de agua de exportación, 500 gr.',          1090,  NULL, (SELECT id FROM categories WHERE slug='frutas'),       20, '500 gr', false, false),

  -- ═══ VERDURAS FREESH (mapeadas a sus categorías canónicas) ═══
  ('Acelga',                  'Acelga fresca, paquete primavera.',             1900, 2900, (SELECT id FROM categories WHERE slug='verduras'),     25, '1 paq',    false, false),
  ('Ají Verde 6u',            'Ají verde chileno, pack de 6 unidades.',         990, NULL, (SELECT id FROM categories WHERE slug='verduras'),     30, '6 unid',   false, false),
  ('Apio',                    'Apio fresco, mata entera.',                     2000, 2000, (SELECT id FROM categories WHERE slug='verduras'),     20, '1 unid',   false, false),
  ('Beterraga Pack 5u',       'Beterraga extra, pack de 5 unidades.',          1990, NULL, (SELECT id FROM categories WHERE slug='verduras'),     20, '5 unid',   false, false),
  ('Beterraga Pack 3u',       'Beterraga fresca, pack de 3 unidades.',          990, 1500, (SELECT id FROM categories WHERE slug='verduras'),     25, '3 unid',   false, false),
  ('Brócoli',                 'Brócoli fresco primera calidad.',               1500, 1500, (SELECT id FROM categories WHERE slug='verduras'),     25, '1 unid',   false, false),
  ('Champiñón 200g',          'Champiñón primera calidad, 200 gr.',            1990, NULL, (SELECT id FROM categories WHERE slug='verduras'),     15, '200 gr',   false, false),
  ('Coliflor',                'Coliflor fresca primera calidad.',              1690, 1500, (SELECT id FROM categories WHERE slug='verduras'),     20, '1 unid',   false, false),
  ('Choclo Americano',        'Choclo americano dulce.',                        800,  700, (SELECT id FROM categories WHERE slug='verduras'),     35, '1 unid',   false, false),
  ('Espinaca 500g',           'Espinaca fresca, 500 gr.',                      1490, NULL, (SELECT id FROM categories WHERE slug='verduras'),     20, '500 gr',   false, false),
  ('Lechuga Costina',         'Lechuga costina extra fresca.',                 1200, 1000, (SELECT id FROM categories WHERE slug='verduras'),     30, '1 unid',   false, false),
  ('Lechuga Escarola',        'Lechuga escarola extra fresca.',                1200, 1000, (SELECT id FROM categories WHERE slug='verduras'),     25, '1 unid',   false, false),
  ('Lechuga Marina',          'Lechuga marina extra fresca.',                  1200, 1000, (SELECT id FROM categories WHERE slug='verduras'),     25, '1 unid',   false, false),
  ('Palta Hass 500g',         'Palta Hass nacional, 500 gr.',                  2500, NULL, (SELECT id FROM categories WHERE slug='frutas'),       35, '500 gr',   false, false),
  ('Pepino',                  'Pepino primera fresco.',                         690,  600, (SELECT id FROM categories WHERE slug='verduras'),     40, '1 unid',   false, false),
  ('Pimentón Verde',          'Pimentón verde fresco.',                         990,  900, (SELECT id FROM categories WHERE slug='verduras'),     40, '1 unid',   false, false),
  ('Pimentón Rojo',           'Pimentón rojo fresco.',                          990,  850, (SELECT id FROM categories WHERE slug='verduras'),     35, '1 unid',   false, false),
  ('Pimentón Amarillo',       'Pimentón amarillo fresco.',                     1290, NULL, (SELECT id FROM categories WHERE slug='verduras'),     20, '1 unid',   false, false),
  ('Poroto Verde 500g',       'Poroto verde fresco, 500 gr.',                  1690, NULL, (SELECT id FROM categories WHERE slug='verduras'),     20, '500 gr',   false, false),
  ('Medio Repollo',           'Medio repollo fresco.',                         1490, NULL, (SELECT id FROM categories WHERE slug='verduras'),     20, '1/2 unid', false, false),
  ('Repollo',                 'Repollo fresco entero.',                        1990, 1900, (SELECT id FROM categories WHERE slug='verduras'),     20, '1 unid',   false, false),
  ('Tomate Cherry 300g',      'Tomate cherry cóctel, 300 gr.',                 1990, NULL, (SELECT id FROM categories WHERE slug='verduras'),     20, '300 gr',   false, false),
  ('Tomate 500g',             'Tomate fresco, 500 gr.',                         890, NULL, (SELECT id FROM categories WHERE slug='verduras'),     30, '500 gr',   false, false),
  ('Tomate Larga Vida',       'Tomate larga vida al kilo.',                    1700, NULL, (SELECT id FROM categories WHERE slug='verduras'),     35, '1 kg',     false, false),
  ('Zanahoria 500g',          'Zanahoria fresca, medio kilo.',                  890, NULL, (SELECT id FROM categories WHERE slug='verduras'),     40, '500 gr',   false, false),
  ('Zanahoria',               'Zanahoria fresca al kilo.',                     1490,  900, (SELECT id FROM categories WHERE slug='verduras'),     45, '1 kg',     false, false),
  ('Zapallo Italiano',        'Zapallo italiano fresco, unidad.',               890,  500, (SELECT id FROM categories WHERE slug='verduras'),     40, '1 unid',   false, false),
  ('Ajo Chileno',             'Ajo chileno fresco, unidad.',                    390,  350, (SELECT id FROM categories WHERE slug='tuberculos'),   50, '1 unid',   false, false),
  ('Cebolla Grande',          'Cebolla blanca grande, unidad.',                 350, NULL, (SELECT id FROM categories WHERE slug='tuberculos'),  100, '1 unid',   false, false),
  ('Cebolla Morada 1kg',      'Cebolla morada cóctel, al kilo.',               1990, 1500, (SELECT id FROM categories WHERE slug='tuberculos'),   30, '1 kg',     false, false),
  ('Cebolla Morada 500g',     'Cebolla morada cóctel, medio kilo.',             990, NULL, (SELECT id FROM categories WHERE slug='tuberculos'),   30, '500 gr',   false, false),
  ('Papa Nueva',              'Papa nueva al kilo.',                            890, NULL, (SELECT id FROM categories WHERE slug='tuberculos'),   60, '1 kg',     false, false),
  ('Papa Camote',             'Papa camote dulce al kilo.',                    2490, NULL, (SELECT id FROM categories WHERE slug='tuberculos'),   30, '1 kg',     false, false),
  ('Zapallo Camote 550g',     'Zapallo camote nacional, 550 gr.',              1490, NULL, (SELECT id FROM categories WHERE slug='tuberculos'),   25, '550 gr',   false, false),
  ('Albahaca',                'Albahaca fresca, paquete.',                     1200, 1000, (SELECT id FROM categories WHERE slug='hierbas'),      20, '1 paq',    false, false),
  ('Cebollín',                'Cebollín extra fresco, paquete.',                890,  750, (SELECT id FROM categories WHERE slug='hierbas'),      25, '1 paq',    false, false),
  ('Ciboulette',              'Ciboulette fresco, paquete.',                    690,  400, (SELECT id FROM categories WHERE slug='hierbas'),      20, '1 paq',    false, false),
  ('Cilantro',                'Cilantro fresco, paquete.',                      990, 1000, (SELECT id FROM categories WHERE slug='hierbas'),      25, '1 paq',    false, false),
  ('Menta',                   'Menta natural fresca, paquete.',                1890, NULL, (SELECT id FROM categories WHERE slug='hierbas'),      15, '1 paq',    false, false),
  ('Perejil',                 'Perejil fresco, paquete.',                       990, 1000, (SELECT id FROM categories WHERE slug='hierbas'),      25, '1 paq',    false, false),
  ('Limón',                   'Limón fresco al kilo.',                          990,  690, (SELECT id FROM categories WHERE slug='citricos'),     60, '1 kg',     false, false),
  ('Limón Sutil',             'Limón sutil para coctel, al kilo.',             3400, 3200, (SELECT id FROM categories WHERE slug='citricos'),     20, '1 kg',     false, false),
  ('Aceituna Nacional',       'Aceituna nacional, 250 gr.',                    1900, NULL, (SELECT id FROM categories WHERE slug='almacen'),      15, '250 gr',   false, false),
  ('Cochayuyo',               'Cochayuyo nacional, paquete.',                  2490, NULL, (SELECT id FROM categories WHERE slug='almacen'),      15, '1 paq',    false, false),

  -- ═══ LEGUMBRES-HUEVO + ALMACÉN extras + FRUTOS SECOS ════
  ('Miel de Panal 320g',      'Miel de panal natural, 320 gr.',                3990, NULL, (SELECT id FROM categories WHERE slug='almacen'),      12, '320 gr',   false, false),
  ('Miel Natural 500g',       'Miel natural pura, 500 gr.',                    4990, NULL, (SELECT id FROM categories WHERE slug='almacen'),      15, '500 gr',   false, false),
  ('Harina Tostada',          'Harina tostada artesanal, medio kilo.',         1800, NULL, (SELECT id FROM categories WHERE slug='almacen'),      20, '500 gr',   false, false),
  ('Carbón Espino',           'Carbón de espino para asado, bolsa.',           3300, NULL, (SELECT id FROM categories WHERE slug='almacen'),      20, '1 unid',   false, false),
  ('Chuchoca',                'Chuchoca para cazuelas, 500 gr.',               1490, NULL, (SELECT id FROM categories WHERE slug='almacen'),      15, '500 gr',   false, false),
  ('Huevo Blanco 12u',        'Huevo blanco super, docena.',                   4200, NULL, (SELECT id FROM categories WHERE slug='almacen'),      30, '12 unid',  false, false),
  ('Huevo Blanco 30u',        'Huevo blanco super, bandeja de 30.',            9900, NULL, (SELECT id FROM categories WHERE slug='almacen'),      20, '30 unid',  false, false),
  ('Huesillos Grandes',       'Huesillos grandes, 250 gr.',                    2990, NULL, (SELECT id FROM categories WHERE slug='almacen'),      15, '250 gr',   false, false),
  ('Huesillo Jumbo 500g',     'Huesillo jumbo, medio kilo.',                   6000, NULL, (SELECT id FROM categories WHERE slug='almacen'),      12, '500 gr',   false, false),
  ('Huesillo Jumbo 1kg',      'Huesillo jumbo, al kilo.',                      7990, NULL, (SELECT id FROM categories WHERE slug='almacen'),      10, '1 kg',     false, false),
  ('Harina Pan',              'Harina pan, al kilo.',                          1890, NULL, (SELECT id FROM categories WHERE slug='almacen'),      20, '1 kg',     false, false),
  ('Garbanzo 500g',           'Garbanzos seleccionados, medio kilo.',          1900, NULL, (SELECT id FROM categories WHERE slug='legumbres'),    20, '500 gr',   false, false),
  ('Mote 500g',               'Mote pelado, medio kilo.',                      1590, NULL, (SELECT id FROM categories WHERE slug='legumbres'),    20, '500 gr',   false, false),
  ('Poroto Negro 500g',       'Poroto negro del año, medio kilo.',             1890, NULL, (SELECT id FROM categories WHERE slug='legumbres'),    20, '500 gr',   false, false),
  ('Jengibre 250g',           'Jengibre fresco, 250 gr.',                      1990, NULL, (SELECT id FROM categories WHERE slug='hierbas'),      15, '250 gr',   false, false),
  ('Almendra',                'Almendra natural, 250 gr.',                     2990, NULL, (SELECT id FROM categories WHERE slug='frutos-secos'), 20, '250 gr',   false, false),
  ('Linaza',                  'Linaza, 500 gr.',                               2000, NULL, (SELECT id FROM categories WHERE slug='frutos-secos'), 20, '500 gr',   false, false),
  ('Maní sin Sal',            'Maní sin sal, 250 gr.',                         1490, NULL, (SELECT id FROM categories WHERE slug='frutos-secos'), 25, '250 gr',   false, false),
  ('Maní con Sal',            'Maní con sal, 250 gr.',                         1490, NULL, (SELECT id FROM categories WHERE slug='frutos-secos'), 25, '250 gr',   false, false),
  ('Nuez',                    'Nuez pelada, 250 gr.',                          3000, NULL, (SELECT id FROM categories WHERE slug='frutos-secos'), 20, '250 gr',   false, false),
  ('Pasa Rubia',              'Pasa rubia, 500 gr.',                           2500, NULL, (SELECT id FROM categories WHERE slug='frutos-secos'), 20, '500 gr',   false, false),
  ('Semilla de Zapallo',      'Semilla de zapallo, 250 gr.',                   2800, NULL, (SELECT id FROM categories WHERE slug='frutos-secos'), 15, '250 gr',   false, false),
  ('Polulos',                 'Polulos para palomitas, paquete.',              1600, NULL, (SELECT id FROM categories WHERE slug='frutos-secos'), 20, '1 paq',    false, false),
  ('Maravilla Pelada',        'Semilla de maravilla pelada, 500 gr.',          2800, NULL, (SELECT id FROM categories WHERE slug='frutos-secos'), 15, '500 gr',   false, false),

  -- ═══ MAYORISTA-ONLY (wholesale_only=true → no aparecen en /catalogo) ═══
  ('Ají Verde 500g',          'Ají verde fresco, 500 gr.',                     2300, 2300, (SELECT id FROM categories WHERE slug='verduras'),    20, '500 gr',      false, true),
  ('Diente de Dragón 500g',   'Diente de dragón, 500 gr.',                     1800, 1800, (SELECT id FROM categories WHERE slug='verduras'),    10, '500 gr',      false, true),
  ('Espinaca 1kg',            'Espinaca fresca al kilo.',                      3000, 3000, (SELECT id FROM categories WHERE slug='verduras'),    15, '1 kg',        false, true),
  ('Lechuga Costina Caja',    'Caja de 10 lechugas costinas.',                13000,13000, (SELECT id FROM categories WHERE slug='verduras'),     8, 'caja 10u',    false, true),
  ('Lechuga Escarola Caja',   'Caja de lechuga escarola.',                    10000,10000, (SELECT id FROM categories WHERE slug='verduras'),     8, 'caja',        false, true),
  ('Lechuga Marina Caja',     'Caja de 14 lechugas marinas.',                 15000,15000, (SELECT id FROM categories WHERE slug='verduras'),     8, 'caja 14u',    false, true),
  ('Poroto Verde 1kg',        'Poroto verde fresco al kilo.',                  4500, 4500, (SELECT id FROM categories WHERE slug='verduras'),    15, '1 kg',        false, true),
  ('Pepino Caja',             'Caja de pepinos a granel.',                    20000,20000, (SELECT id FROM categories WHERE slug='verduras'),     8, '1 caja',      false, true),
  ('Pimentón Verde Caja',     'Caja de pimentón verde extra.',                25000,25000, (SELECT id FROM categories WHERE slug='verduras'),     6, '1 caja',      false, true),
  ('Pimentón Rojo Caja',      'Caja de pimentón rojo extra.',                 25000,25000, (SELECT id FROM categories WHERE slug='verduras'),     6, '1 caja',      false, true),
  ('Repollo Morado',          'Repollo morado fresco.',                        2000, 2000, (SELECT id FROM categories WHERE slug='verduras'),    15, '1 unid',      false, true),
  ('Rúcula 500g',             'Rúcula fresca, 500 gr.',                        3500, 3500, (SELECT id FROM categories WHERE slug='verduras'),    15, '500 gr',      false, true),
  ('Tomate Cherry 500g',      'Tomate cherry al medio kilo.',                  1500, 1500, (SELECT id FROM categories WHERE slug='verduras'),    20, '500 gr',      false, true),
  ('Caja Tomate Primera 18kg','Caja de tomate primera calidad, 18 kg.',       19000,19000, (SELECT id FROM categories WHERE slug='verduras'),    10, 'caja 18kg',   false, true),
  ('Champiñón 500g',          'Champiñón primera calidad, 500 gr.',            4900, 4900, (SELECT id FROM categories WHERE slug='verduras'),    12, '500 gr',      false, true),
  ('Zanahoria Saco 17kg',     'Saco de zanahoria, 17 kg.',                    14500,14500, (SELECT id FROM categories WHERE slug='verduras'),    10, 'saco 17kg',   false, true),
  ('Zapallo Italiano Caja',   'Caja de zapallo italiano.',                    18000,18000, (SELECT id FROM categories WHERE slug='verduras'),     8, '1 caja',      false, true),
  ('Pack Cebollas 4u',        'Pack de 4 cebollas en oferta.',                 1000, 1000, (SELECT id FROM categories WHERE slug='tuberculos'),  25, '4 unid',      false, true),
  ('Malla Cebolla Morada 17kg','Malla de cebolla morada, 17 kg aprox.',       15500,15500, (SELECT id FROM categories WHERE slug='tuberculos'),  10, 'malla 17kg',  false, true),
  ('Zapallo Camote 1kg',      'Zapallo camote al kilo.',                       1200, 1200, (SELECT id FROM categories WHERE slug='tuberculos'),  20, '1 kg',        false, true),
  ('Cilantro Toro',           'Cilantro toro, atado grande.',                 25000,25000, (SELECT id FROM categories WHERE slug='hierbas'),      5, '1 atado',     false, true),
  ('Cebollín Docena',         'Cebollín fresco, docena.',                      7900, 7900, (SELECT id FROM categories WHERE slug='hierbas'),     10, 'docena',      false, true),
  ('Menta 1kg',               'Menta fresca al kilo.',                         8500, 8500, (SELECT id FROM categories WHERE slug='hierbas'),     10, '1 kg',        false, true),
  ('Limón Plateado 17kg',     'Limón plateado, saco de 17 kg.',               10500,10500, (SELECT id FROM categories WHERE slug='citricos'),    10, 'saco 17kg',   false, true),
  ('Naranjas Caja',           'Caja de naranjas.',                            23000,23000, (SELECT id FROM categories WHERE slug='citricos'),     8, '1 caja',      false, true),
  ('Clementinas Caja',        'Caja de clementinas.',                         19000,19000, (SELECT id FROM categories WHERE slug='citricos'),     8, '1 caja',      false, true),
  ('Caja Frutilla',           'Caja de frutilla.',                            19000,19000, (SELECT id FROM categories WHERE slug='frutas'),       8, '1 caja',      false, true),
  ('Caja Manzana Roja Fuji',  'Caja de manzana roja Fuji.',                   29500,29500, (SELECT id FROM categories WHERE slug='frutas'),       6, '1 caja',      false, true),
  ('Caja Manzana Verde',      'Caja de manzana verde.',                       24000,24000, (SELECT id FROM categories WHERE slug='frutas'),       6, '1 caja',      false, true),
  ('Peras Caja',              'Caja de peras.',                               20500,20500, (SELECT id FROM categories WHERE slug='frutas'),       8, '1 caja',      false, true),
  ('Kiwis Caja',              'Caja de kiwis.',                               25400,25400, (SELECT id FROM categories WHERE slug='frutas'),       6, '1 caja',      false, true),
  ('Caja Plátanos',           'Caja de plátanos.',                            17500,17500, (SELECT id FROM categories WHERE slug='frutas'),      10, '1 caja',      false, true);
