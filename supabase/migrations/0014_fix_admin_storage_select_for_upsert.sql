-- MIGRATION 0014 — Restaurar acceso SELECT del admin en storage
--
-- La migración 0012 eliminó `public_read_product_images` (SELECT para PUBLIC)
-- para quitar el listado anónimo del bucket. Pero `upsert: true` en el SDK de
-- Supabase Storage requiere que el rol autenticado pueda SELECT el objeto
-- existente antes de decidir INSERT o UPDATE. Sin esta policy, el panel admin
-- falla al intentar cambiar fotos de productos.
--
-- Solución: policy SELECT exclusiva para admin (no lista a usuarios anónimos,
-- no afecta las URLs públicas que bypasean RLS, solo habilita el upsert).

CREATE POLICY "admin_select_product_images" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin());
