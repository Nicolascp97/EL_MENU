-- MIGRATION 0013 — Rendimiento seguro (advisors de Supabase)
--
-- Solo cambios que PRESERVAN el comportamiento exacto. No se tocan las policies
-- "multiple permissive" (mergearlas en producción es riesgoso por la lógica
-- booleana y el beneficio es mínimo al volumen actual) ni se borran los índices
-- "unused" (el dato es débil con 1 semana de stats).
--
-- 1) RLS initplan: envolver auth.uid() en (select auth.uid()) hace que Postgres lo
--    evalúe UNA vez por query en lugar de una vez por fila. Es la corrección oficial
--    de Supabase y es semánticamente idéntica. Se recrean idénticas (mismo rol
--    public, mismo cmd, misma lógica), solo cambia auth.uid() → (select auth.uid()).

DROP POLICY user_own_profile ON public.profiles;
CREATE POLICY user_own_profile ON public.profiles
  FOR ALL TO public
  USING ((select auth.uid()) = id);

DROP POLICY user_own_orders ON public.orders;
CREATE POLICY user_own_orders ON public.orders
  FOR SELECT TO public
  USING ((select auth.uid()) = user_id);

DROP POLICY insert_own_or_guest_order ON public.orders;
CREATE POLICY insert_own_or_guest_order ON public.orders
  FOR INSERT TO public
  WITH CHECK ((user_id IS NULL) OR ((select auth.uid()) = user_id));

-- 2) Índices en foreign keys sin cubrir (acelera joins y borrados en cascada).
--    Crear un índice no cambia el comportamiento de ninguna query.

CREATE INDEX IF NOT EXISTS idx_conversations_order_id ON public.conversations(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
