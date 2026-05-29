'use client'

import { buildCustomerWhatsAppMessage, type OrderForMessage } from '@/lib/orderMessage'

type Props = {
  order: OrderForMessage
}

export default function ConfirmarPedidoWhatsAppButton({ order }: Props) {
  const phone = (process.env.NEXT_PUBLIC_WA_NUMBER ?? '').replace(/\D/g, '')
  if (!phone) return null

  const text = buildCustomerWhatsAppMessage(order)
  const href = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`

  return (
    <div className="mt-8 flex flex-col items-center">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="confirm-wa-btn block w-full max-w-[480px] text-center text-white"
        style={{
          background:    '#E8621A',
          padding:       '18px 24px',
          borderRadius:  9999,
          fontSize:      18,
          fontWeight:    700,
          lineHeight:    1.2,
          letterSpacing: '0.01em',
        }}
      >
        📲 Confirmar pedido por WhatsApp
      </a>
      <p
        className="mt-3 text-center"
        style={{ color: '#6B7280', fontWeight: 500, fontSize: 13 }}
      >
        ⚠️ Importante: tócalo para que nos enteremos de tu Pedido.
      </p>
    </div>
  )
}
