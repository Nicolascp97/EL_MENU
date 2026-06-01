-- MIGRATION 0010 — Unit por canal (mayorista) + permisos de subida de imágenes
--
-- 1. Agrega columna `unit_wholesale` a products. Si está seteada, las órdenes
--    mayoristas usan ese valor en lugar del `unit` retail. Permite, por ejemplo,
--    que la Aceituna nacional sea "250 gr" en retail y "1 Kg" en mayorista.
--
-- 2. Da permiso al admin para subir/actualizar/borrar imágenes en el bucket
--    `product-images`, para que el dueño pueda reemplazar las fotos de
--    productos desde el panel admin sin pasar por el equipo dev.
--    Reutiliza el helper public.is_admin() creado en 0006.

ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_wholesale TEXT;

-- ─── Storage policies para que el admin escriba en el bucket product-images ──
DROP POLICY IF EXISTS "admin_upload_product_images" ON storage.objects;
CREATE POLICY "admin_upload_product_images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "admin_update_product_images" ON storage.objects;
CREATE POLICY "admin_update_product_images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "admin_delete_product_images" ON storage.objects;
CREATE POLICY "admin_delete_product_images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin());
