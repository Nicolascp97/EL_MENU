-- ============================================================
-- EL MENÚ — Schema Supabase
-- Ejecutar en Supabase SQL Editor (orden importa)
-- ============================================================

-- Extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── CATEGORIES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name      TEXT NOT NULL,
  slug      TEXT NOT NULL UNIQUE,
  emoji     TEXT DEFAULT '🥦',
  "order"   INTEGER DEFAULT 0
);

-- ─── PRODUCTS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT NOT NULL,
  description      TEXT,
  price            INTEGER NOT NULL,        -- CLP, sin decimales
  price_wholesale  INTEGER,                 -- precio mayorista (NULL si no se vende a mayoristas)
  category_id      UUID REFERENCES categories(id) ON DELETE SET NULL,
  stock            INTEGER NOT NULL DEFAULT 0,
  unit             TEXT NOT NULL DEFAULT 'kg',
  images           TEXT[] DEFAULT '{}',
  active           BOOLEAN DEFAULT true,
  featured         BOOLEAN DEFAULT false,
  wholesale_only   BOOLEAN NOT NULL DEFAULT false,  -- true: solo aparece en /mayorista
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ZONES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zones (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                  TEXT NOT NULL,
  communes              TEXT[] NOT NULL DEFAULT '{}',
  delivery_price        INTEGER NOT NULL DEFAULT 0,
  min_order             INTEGER NOT NULL DEFAULT 0,  -- minorista / guest
  min_order_wholesale   INTEGER NOT NULL DEFAULT 0   -- mayorista (rol mayorista)
);

-- ─── PROFILES (extiende auth.users) ─────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name      TEXT,
  phone     TEXT,
  address   TEXT,
  role      TEXT NOT NULL DEFAULT 'minorista'
              CHECK (role IN ('minorista', 'mayorista', 'admin')),
  favorites UUID[] DEFAULT '{}'
);

-- ─── ORDERS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  channel         TEXT NOT NULL DEFAULT 'web' CHECK (channel IN ('web', 'whatsapp')),
  status          TEXT NOT NULL DEFAULT 'nuevo'
                    CHECK (status IN ('nuevo', 'preparando', 'listo', 'en_camino', 'entregado', 'cancelado')),
  items           JSONB NOT NULL DEFAULT '[]',
  total           INTEGER NOT NULL,
  address         TEXT NOT NULL,
  commune         TEXT NOT NULL,
  phone           TEXT NOT NULL,
  notes           TEXT,
  payment_status  TEXT NOT NULL DEFAULT 'pendiente'
                    CHECK (payment_status IN ('pendiente', 'pagado', 'fallido')),
  transbank_token TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── RECIPES (generadas por IA semanalmente) ────────────────
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

-- ─── CONVERSATIONS (agente IA WhatsApp) ─────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wa_phone    TEXT NOT NULL,
  messages    JSONB NOT NULL DEFAULT '[]',
  status      TEXT NOT NULL DEFAULT 'activa'
                CHECK (status IN ('activa', 'escalada', 'cerrada')),
  order_id    UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ÍNDICES ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured);
CREATE INDEX IF NOT EXISTS idx_products_wholesale_only ON products(wholesale_only);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(wa_phone);
CREATE INDEX IF NOT EXISTS idx_recipes_active ON recipes(active);
CREATE INDEX IF NOT EXISTS idx_recipes_generated ON recipes(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

-- Políticas públicas de lectura (catálogo + recetas activas)
CREATE POLICY "public_read_categories" ON categories FOR SELECT USING (true);
CREATE POLICY "public_read_products" ON products FOR SELECT USING (active = true);
CREATE POLICY "public_read_zones" ON zones FOR SELECT USING (true);
CREATE POLICY "public_read_recipes" ON recipes FOR SELECT USING (active = true);

-- Políticas de usuario autenticado
CREATE POLICY "user_own_profile" ON profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "user_own_orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_insert_order" ON orders
  FOR INSERT WITH CHECK (true); -- cualquiera puede crear pedido

-- Admin (service role bypasses RLS — no necesita políticas extra)

-- ─── TRIGGER: crear profile automáticamente al registrarse ──
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

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── REALTIME ───────────────────────────────────────────────
-- Habilitar Realtime en orders para el panel admin
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
