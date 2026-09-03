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
      <div
        className="w-full max-w-[480px] text-center"
        style={{
          background:   '#FFF4EC',
          border:       '2px solid #E8621A',
          borderRadius: 16,
          padding:      '14px 16px',
          marginBottom: 14,
        }}
      >
        <p style={{ color: '#9A3B0C', fontWeight: 700, fontSize: 14, lineHeight: 1.4 }}>
          Tu pedido todavía NO llega al restaurante.
        </p>
        <p style={{ color: '#9A3B0C', fontWeight: 500, fontSize: 13, marginTop: 2 }}>
          Toca el botón de abajo y presiona enviar en WhatsApp para confirmarlo.
        </p>
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="confirm-wa-btn block w-full max-w-[480px] text-center text-white animate-pulse"
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
    </div>
  )
}
