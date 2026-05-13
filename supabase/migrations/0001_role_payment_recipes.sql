-- ============================================================
-- MIGRATION 0001 — role en profiles, payment en orders, tabla recipes
-- Idempotente: se puede correr varias veces sin romper nada
-- ============================================================

-- ─── profiles.role ──────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'minorista';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('minorista', 'mayorista', 'admin'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- ─── orders.payment_status + transbank_token ────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pendiente';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS transbank_token TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_status_check'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_payment_status_check
      CHECK (payment_status IN ('pendiente', 'pagado', 'fallido'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

-- ─── recipes (tabla nueva) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS recipes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         TEXT NOT NULL,
  description   TEXT,
  tag           TEXT DEFAULT 'TEMPORADA',
  time_minutes  INTEGER DEFAULT 20,
  servings      INTEGER DEFAULT 4,
  difficulty    TEXT DEFAULT 'Fácil' CHECK (difficulty IN ('Fácil', 'Medio', 'Difícil')),
  emoji         TEXT DEFAULT '🥗',
  ingredients   JSONB NOT NULL DEFAULT '[]',
  active        BOOLEAN DEFAULT true,
  generated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipes_active ON recipes(active);
CREATE INDEX IF NOT EXISTS idx_recipes_generated ON recipes(generated_at DESC);

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_recipes" ON recipes;
CREATE POLICY "public_read_recipes" ON recipes FOR SELECT USING (active = true);

-- ─── Actualizar trigger handle_new_user para incluir role ───
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, phone, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'role', 'minorista')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
