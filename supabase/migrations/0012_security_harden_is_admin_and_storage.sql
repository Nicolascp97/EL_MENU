-- MIGRATION 0012 — Endurecimiento de seguridad (advisors de Supabase)
--
-- Resuelve 3 advisors de seguridad detectados tras 1 semana en producción:
--
-- 1) is_admin() era invocable por cualquiera vía PostgREST (/rest/v1/rpc/is_admin),
--    incluso sin sesión. Al ser SECURITY DEFINER, corre con privilegios del dueño,
--    así que exponerla es riesgoso. Se revoca EXECUTE de PUBLIC/anon/authenticated.
--    IMPORTANTE: la función SIGUE funcionando dentro de las policies RLS — la
--    evaluación de una policy NO requiere que el rol tenga EXECUTE sobre la función
--    (verificado empíricamente con un REVOKE + query como authenticated + ROLLBACK
--    antes de aplicar esto). service_role y postgres conservan EXECUTE (backend).
--
-- 2) El bucket público product-images tenía una policy SELECT amplia que permitía
--    LISTAR todos los archivos vía la API de Storage. Las imágenes se sirven por la
--    URL pública (/storage/v1/object/public/...), que NO pasa por esta policy, y la
--    app solo usa getPublicUrl() (nunca .list()), así que quitarla no rompe nada.

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS public_read_product_images ON storage.objects;

-- Nota: queda 1 advisor de seguridad (leaked password protection) que NO es SQL;
-- se activa en el panel: Authentication → Sign In / Up → Password → "Leaked password
-- protection" (chequea contra HaveIBeenPwned). No afecta a usuarios existentes.
