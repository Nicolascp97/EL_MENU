-- ============================================================
-- MIGRATION 0005 — Campos de comprobante Transbank en orders
-- Requeridos por Transbank para validación y puesta en producción
-- ============================================================

-- Arreglar constraint de payment_method (eliminar amipass y edenred)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders
  ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('webpay', 'transfer'));

-- Código de autorización (6 dígitos que entrega Transbank al aprobar)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS transbank_authorization_code TEXT;

-- Últimos 4 dígitos de la tarjeta (Transbank lo devuelve enmascarado)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS transbank_card_last4 TEXT;

-- Tipo de pago:
--   VD = Débito / Redcompra
--   VN = Crédito Venta Normal (sin cuotas)
--   VC = Crédito Venta en Cuotas
--   S2 = Crédito 2 cuotas sin interés
--   SI = Sin interés (más de 2 cuotas)
--   NC = N cuotas sin interés
--   P  = Prepago
ALTER TABLE orders ADD COLUMN IF NOT EXISTS transbank_payment_type TEXT;

-- Número de cuotas (0 o 1 = sin cuotas, >1 = con cuotas)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS transbank_installments INTEGER DEFAULT 0;

-- Fecha/hora exacta de la transacción según Transbank
ALTER TABLE orders ADD COLUMN IF NOT EXISTS transbank_transaction_date TIMESTAMPTZ;
