-- MIGRATION 0006 — Políticas RLS de escritura para el admin
--
-- Problema: el panel admin (productos, zonas, recetas) escribe usando el client
-- del navegador con el JWT del usuario, no el service role. La schema original
-- asumía "service role bypasses RLS — no necesita políticas extra", pero nunca
-- creó políticas de INSERT/UPDATE/DELETE para esas tablas. Con RLS activo y sin
-- política permisiva, PostgREST rechaza la escritura en silencio (HTTP 200,
-- 0 filas afectadas, sin error) → la UI hacía update optimista y parecía guardar,
-- pero la DB nunca cambiaba.

-- Helper: ¿el usuario actual es admin?
-- SECURITY DEFINER lee profiles saltándose RLS, evitando recursión al usarse
-- dentro de las políticas de abajo.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
$$;

-- PRODUCTS — el admin puede crear/editar/borrar (y ver inactivos para gestionarlos)
DROP POLICY IF EXISTS "admin_write_products" ON products;
CREATE POLICY "admin_write_products" ON products
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ZONES — edición inline de precios, comunas y mínimos
DROP POLICY IF EXISTS "admin_write_zones" ON zones;
CREATE POLICY "admin_write_zones" ON zones
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- RECIPES — toggle activo/inactivo y gestión manual
DROP POLICY IF EXISTS "admin_write_recipes" ON recipes;
CREATE POLICY "admin_write_recipes" ON recipes
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
