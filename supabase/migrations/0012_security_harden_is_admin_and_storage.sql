-- MIGRATION 0012 — Endurecimiento de seguridad (advisors de Supabase)
--
-- 1) is_admin() ya no es invocable por usuarios anónimos vía PostgREST
--    (/rest/v1/rpc/is_admin). Se revoca EXECUTE de PUBLIC y anon.
--    `authenticated` CONSERVA EXECUTE porque las policies RLS de admin_*
--    (orders, products, recipes, zones, storage) evalúan is_admin() en contexto
--    del rol `authenticated` — sin ese permiso, cualquier usuario logueado
--    recibe 403 en esas tablas (lección aprendida en prod).
--    `anon` no tiene ninguna policy que use is_admin(), así que revocarlo es seguro.
--
-- 2) El bucket público product-images tenía una policy SELECT amplia que permitía
--    LISTAR todos los archivos vía la API de Storage. Las imágenes se sirven por la
--    URL pública (/storage/v1/object/public/...), que NO pasa por esta policy, y la
--    app solo usa getPublicUrl() (nunca .list()), así que quitarla no rompe nada.

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DROP POLICY IF EXISTS public_read_product_images ON storage.objects;

-- Nota: queda 1 advisor de seguridad (leaked password protection) que NO es SQL;
-- se activa en el panel: Authentication → Sign In / Up → Password → "Leaked password
-- protection" (chequea contra HaveIBeenPwned). No afecta a usuarios existentes.
