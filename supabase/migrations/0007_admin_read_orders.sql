-- MIGRATION 0007 — Acceso del admin a TODOS los pedidos
--
-- Problema: orders solo tenía la política user_own_orders (auth.uid() = user_id),
-- así que el panel admin (que lee con el JWT del admin) NO veía los pedidos de
-- clientes ni los de invitado (user_id NULL). Resultado: el dashboard mostraba
-- 0 pedidos aunque existieran. Tampoco podía actualizar el estado en el kanban
-- (UPDATE bloqueado) ni recibir los cambios por Realtime.
--
-- Reusa el helper is_admin() creado en 0006.

DROP POLICY IF EXISTS "admin_all_orders" ON orders;
CREATE POLICY "admin_all_orders" ON orders
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
