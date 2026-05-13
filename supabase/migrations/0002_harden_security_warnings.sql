-- ============================================================
-- MIGRATION 0002 — Endurecer warnings del database linter
-- Aplicado vía MCP el 2026-05-11. Idempotente.
-- ============================================================

-- ─── conversations: deny por defecto (solo service_role) ────
DROP POLICY IF EXISTS "service_role_only_conversations" ON conversations;
CREATE POLICY "service_role_only_conversations" ON conversations
  FOR ALL USING (false) WITH CHECK (false);

-- ─── orders: evitar suplantación en INSERT ──────────────────
DROP POLICY IF EXISTS "user_insert_order" ON orders;
DROP POLICY IF EXISTS "insert_own_or_guest_order" ON orders;
CREATE POLICY "insert_own_or_guest_order" ON orders
  FOR INSERT
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- ─── handle_new_user(): fijar search_path y revocar EXECUTE ─
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
