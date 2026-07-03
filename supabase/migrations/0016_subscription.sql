-- MIGRATION 0016 — Suscripción mensual (aviso de cobro en el panel admin)
--
-- Guarda el estado de cobro de ESTA app (single-tenant: una copia por cliente).
-- Fila única (id = 1). El estado active/grace/overdue NO se guarda: se calcula en
-- vivo a partir de next_due_date (ver src/lib/subscription.ts).
--
-- Solo el service role (admin client) lee/escribe esta tabla. Con RLS activo y
-- SIN políticas, PostgREST bloquea a anon/authenticated — que es justo lo que
-- queremos: el cliente jamás puede ver ni tocar su propia suscripción.

CREATE TABLE IF NOT EXISTS subscription (
  id            INTEGER PRIMARY KEY DEFAULT 1,
  next_due_date DATE NOT NULL,
  amount_clp    INTEGER NOT NULL DEFAULT 20500,  -- CLP, sin decimales
  last_paid_at  TIMESTAMPTZ,
  CONSTRAINT subscription_single_row CHECK (id = 1)
);

-- Seed: próximo vencimiento 1 de agosto de 2026, monto $20.500.
INSERT INTO subscription (id, next_due_date, amount_clp)
VALUES (1, '2026-08-01', 20500)
ON CONFLICT (id) DO NOTHING;

-- RLS activo, sin políticas → solo el service role accede (bypassa RLS).
ALTER TABLE subscription ENABLE ROW LEVEL SECURITY;
