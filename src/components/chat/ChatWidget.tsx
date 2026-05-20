'use client'
import { useEffect, useRef, useState, KeyboardEvent } from 'react'
import { usePathname } from 'next/navigation'
import { useChat, type ChatMessage } from '@/hooks/useChat'
import { useCart } from '@/hooks/useCart'
import { formatPrice } from '@/lib/utils'
import type { Product } from '@/types/database'

const PRODUCT_EMOJI: [RegExp, string][] = [
  [/tomate|cherry/i, '🍅'],
  [/palta|avocado/i, '🥑'],
  [/limón|limon|lemon/i, '🍋'],
  [/naranja|mandarina/i, '🍊'],
  [/manzana/i, '🍎'],
  [/pera/i, '🍐'],
  [/uva/i, '🍇'],
  [/frutilla|fresa/i, '🍓'],
  [/mango/i, '🥭'],
  [/kiwi/i, '🥝'],
  [/piña|ananas/i, '🍍'],
  [/sandia|sandía/i, '🍉'],
  [/melón|melon/i, '🍈'],
  [/durazno|nectarín|nectarin/i, '🍑'],
  [/cereza/i, '🍒'],
  [/coco/i, '🥥'],
  [/banana|plátano|platano/i, '🍌'],
  [/ajo/i, '🧄'],
  [/cebolla/i, '🧅'],
  [/zanahoria/i, '🥕'],
  [/papa|patata/i, '🥔'],
  [/choclo|corn|maíz/i, '🌽'],
  [/pepino/i, '🥒'],
  [/pimentón|pimiento/i, '🫑'],
  [/berenjena/i, '🍆'],
  [/brócoli|brocoli|coliflor/i, '🥦'],
  [/lechuga|espinaca|acelga/i, '🥬'],
  [/champiñon|champinon|hongo/i, '🍄'],
  [/jengibre/i, '🫚'],
  [/maní|mani|cacahuete/i, '🥜'],
  [/nuez|nueces|almendra|pistach/i, '🌰'],
  [/huevo/i, '🥚'],
  [/miel/i, '🍯'],
]

function getEmoji(product: Product): string {
  for (const [regex, emoji] of PRODUCT_EMOJI) {
    if (regex.test(product.name)) return emoji
  }
  return product.category?.emoji ?? '🥦'
}

function ProductMiniCard({ product, onAdd }: { product: Product; onAdd?: () => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onAdd}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: hovered && onAdd ? '#E8F5E9' : '#F0FFF4',
        border: `1px solid ${hovered && onAdd ? '#A5D6A7' : '#D8F3DC'}`,
        borderRadius: 10, padding: '8px 12px', marginTop: 6,
        cursor: onAdd ? 'pointer' : 'default',
        transition: 'background .15s, border-color .15s',
      }}
    >
      <span style={{ fontSize: 22, lineHeight: 1 }}>{getEmoji(product)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 13, fontWeight: 600, color: '#1B2B1E',
          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
        }}>
          {product.name}
        </p>
        <p style={{ margin: 0, fontSize: 12, color: '#2D6A4F' }}>
          {formatPrice(product.price)} / {product.unit}
        </p>
      </div>
      {onAdd && (
        <span style={{
          fontSize: 11, fontWeight: 700, color: '#2D6A4F',
          background: hovered ? '#C8E6C9' : '#D8F3DC',
          borderRadius: 20, padding: '4px 10px',
          whiteSpace: 'nowrap', flexShrink: 0,
          transition: 'background .15s',
        }}>
          + Agregar
        </span>
      )}
    </div>
  )
}

function MessageBubble({ msg, onAddProduct }: { msg: ChatMessage; onAddProduct?: (p: Product) => void }) {
  const isUser = msg.role === 'user'
  const displayText = msg.displayText ?? msg.text

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 10,
    }}>
      <div style={{
        maxWidth: '82%',
        background: isUser ? '#1B2B1E' : '#F5F7F5',
        color: isUser ? '#fff' : '#1B2B1E',
        borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        padding: '10px 14px',
        fontSize: 14,
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {displayText}
      </div>

      {/* Product cards — clickeables solo en mensajes del asistente */}
      {msg.products && msg.products.length > 0 && (
        <div style={{ maxWidth: '82%', width: '100%', marginTop: 4 }}>
          {msg.products.map(p => (
            <ProductMiniCard
              key={p.id}
              product={p}
              onAdd={onAddProduct ? () => onAddProduct(p) : undefined}
            />
          ))}
        </div>
      )}

      {/* Cart confirmation */}
      {msg.addedToCart && msg.addedToCart.length > 0 && (
        <div style={{
          maxWidth: '82%', marginTop: 6,
          background: '#E8F5E9', border: '1px solid #C8E6C9',
          borderRadius: 10, padding: '8px 12px',
        }}>
          <p style={{
            margin: '0 0 4px', fontSize: 11, fontWeight: 700,
            color: '#2D6A4F', textTransform: 'uppercase', letterSpacing: '.5px',
          }}>
            ✓ Agregado al carrito
          </p>
          {msg.addedToCart.map(({ product, qty }) => {
            // unit "1 kg" → "kg" so display reads "× 1 kg" not "× 1 1 kg"
            const unit = product.unit.startsWith('1 ') ? product.unit.slice(2) : product.unit
            return (
              <p key={product.id} style={{ margin: '2px 0', fontSize: 12, color: '#1B2B1E' }}>
                {product.name} × {qty} {unit}
              </p>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TypingDots() {
  return (
    <div style={{
      display: 'flex', gap: 4, alignItems: 'center',
      padding: '10px 14px', background: '#F5F7F5',
      borderRadius: '18px 18px 18px 4px', width: 'fit-content',
    }}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className={`typing-dot typing-dot-${i}`}
          style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#9DC4AA', display: 'block',
          }}
        />
      ))}
    </div>
  )
}

export default function ChatWidget() {
  const pathname = usePathname()
  const { messages, setMessages, isLoading, isOpen, openChat, closeChat, sendMessage } = useChat()
  const { items } = useCart()
  const cartIsOpen = useCart(s => s.isOpen)
  const [input, setInput] = useState('')
  const [showBubble, setShowBubble] = useState(false)
  const [viewportW, setViewportW] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const processedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const update = () => setViewportW(window.innerWidth)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // When cart is open on desktop, shift FAB to the left of the drawer (384px wide)
  const fabRight = (cartIsOpen && viewportW >= 640) ? 384 + 16 : 24

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Auto-show speech bubble after delay, hide when chat opens
  useEffect(() => {
    if (isOpen) { setShowBubble(false); return }
    const t = setTimeout(() => setShowBubble(true), 3500)
    return () => clearTimeout(t)
  }, [isOpen])

  // Auto-hide speech bubble after 6s
  useEffect(() => {
    if (!showBubble) return
    const t = setTimeout(() => setShowBubble(false), 6000)
    return () => clearTimeout(t)
  }, [showBubble])

  // Welcome message on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        text: '¡Hola! Soy Menucito 🌿\n¿Qué necesitas hoy? Te ayudo a armar tu pedido.',
      }])
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync addedToCart items into Zustand cart
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (!last?.addedToCart || processedRef.current.has(last.id)) return
    processedRef.current.add(last.id)

    last.addedToCart.forEach(({ product, qty }) => {
      const { items: cartItems, addItem, updateQty } = useCart.getState()
      if (!cartItems.find(i => i.product.id === product.id)) {
        addItem(product)
      }
      updateQty(product.id, qty)
    })
  }, [messages])

  // Don't render on admin pages
  if (pathname.startsWith('/admin')) return null

  const cartSummary = items.length > 0
    ? items.map(i => `${i.product.name} x${i.qty}`).join(', ')
    : undefined

  async function handleSelectProduct(product: Product) {
    // Agregar al carrito inmediatamente en el frontend
    const { items: cartItems, addItem, updateQty } = useCart.getState()
    const existing = cartItems.find(i => i.product.id === product.id)
    if (existing) {
      updateQty(product.id, existing.qty + 1)
    } else {
      addItem(product)
    }

    // Calcular summary con el carrito ya actualizado
    const { items: updatedItems } = useCart.getState()
    const updatedSummary = updatedItems.map(i => `${i.product.name} x${i.qty}`).join(', ')

    // Enviar a la API con texto interno para Meni, mostrar nombre del producto en el chat
    const emoji = product.category?.emoji ?? '🥦'
    await sendMessage(
      `[seleccionó: ${product.name}]`,
      updatedSummary,
      `${emoji} ${product.name}`,
    )
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    await sendMessage(text, cartSummary)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      <style>{`
        @keyframes typingBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: .5; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
        .typing-dot-0 { animation: typingBounce 1.2s .0s infinite; }
        .typing-dot-1 { animation: typingBounce 1.2s .2s infinite; }
        .typing-dot-2 { animation: typingBounce 1.2s .4s infinite; }

        @keyframes chatSlideIn {
          from { opacity: 0; transform: translateY(12px) scale(.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .chat-modal { animation: chatSlideIn .2s ease; }

        @keyframes bubblePop {
          from { opacity:0; transform:scale(.88) translateY(8px); }
          to   { opacity:1; transform:scale(1)   translateY(0);   }
        }
        .menucito-bubble {
          animation: bubblePop .28s cubic-bezier(.34,1.56,.64,1);
          transform-origin: bottom right;
        }

        @keyframes fabPulse {
          0%,100% { box-shadow: 0 4px 22px rgba(232,98,26,.5); }
          50%     { box-shadow: 0 6px 32px rgba(232,98,26,.78), 0 0 0 11px rgba(232,98,26,.1); }
        }
        .menucito-fab {
          animation: fabPulse 3s ease-in-out infinite;
          transition: transform .15s ease;
        }
        .menucito-fab:hover  { transform: scale(1.1) !important; animation-play-state: paused; }
        .menucito-fab:active { transform: scale(0.94) !important; }

        @media (max-width: 480px) {
          .chat-modal {
            bottom: 0 !important; right: 0 !important; left: 0 !important;
            width: 100% !important; max-height: 100dvh !important;
            height: 100dvh !important; border-radius: 0 !important;
          }
          .menucito-fab-wrap { bottom: 16px !important; right: 16px !important; }
        }
      `}</style>

      {/* FAB — Menucito robot */}
      {!isOpen && (
        <div
          className="menucito-fab-wrap"
          style={{
            position: 'fixed', bottom: 24, right: fabRight, zIndex: 1000,
            display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10,
            transition: 'right 0.38s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}
        >
          {/* Speech bubble */}
          {showBubble && (
            <div
              className="menucito-bubble"
              onClick={() => { openChat(); setShowBubble(false) }}
              style={{
                background: '#fff',
                borderRadius: 14,
                padding: '10px 16px',
                boxShadow: '0 4px 20px rgba(0,0,0,.13)',
                fontSize: 14,
                fontWeight: 600,
                color: '#1B2B1E',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                position: 'relative',
                userSelect: 'none',
              }}
            >
              ¿Te ayudo con tu pedido?
              {/* Arrow pointing down-right toward FAB */}
              <span style={{
                position: 'absolute', bottom: -7, right: 22,
                width: 0, height: 0,
                borderLeft: '7px solid transparent',
                borderRight: '7px solid transparent',
                borderTop: '7px solid #fff',
                filter: 'drop-shadow(0 2px 1px rgba(0,0,0,.06))',
              }} />
            </div>
          )}

          {/* Robot button + antenna */}
          <div style={{ position: 'relative', width: 64, height: 64 }}>
            {/* Leaf antenna — floats above the button */}
            <div style={{
              position: 'absolute', top: -18, left: '50%',
              transform: 'translateX(-50%)',
              pointerEvents: 'none', zIndex: 2,
            }}>
              <svg width="24" height="20" viewBox="0 0 24 20" fill="none">
                <line x1="12" y1="20" x2="12" y2="11" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M12 11 C9 6 3 8 4 12 C5 15 10 14 12 11Z" fill="#52B788"/>
                <path d="M12 11 C15 6 21 8 20 12 C19 15 14 14 12 11Z" fill="#74C69D"/>
              </svg>
            </div>

            {/* Main FAB button */}
            <button
              className="menucito-fab"
              onClick={() => { openChat(); setShowBubble(false) }}
              onMouseEnter={() => setShowBubble(true)}
              aria-label="Abrir chat con Menucito"
              style={{
                width: 64, height: 64, borderRadius: '50%',
                background: '#E8621A', border: 'none',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {/* Robot face SVG */}
              <svg width="36" height="30" viewBox="0 0 36 30" fill="none" overflow="visible">
                {/* Head bg */}
                <rect x="3" y="2" width="30" height="24" rx="7" fill="rgba(255,255,255,0.13)"/>
                {/* Ear nubs */}
                <rect x="0" y="10" width="3" height="7" rx="1.5" fill="rgba(255,255,255,0.28)"/>
                <rect x="33" y="10" width="3" height="7" rx="1.5" fill="rgba(255,255,255,0.28)"/>
                {/* Left eye */}
                <circle cx="12" cy="13" r="4.5" fill="white"/>
                <circle cx="12" cy="13" r="2.4" fill="#1B2B1E"/>
                <circle cx="13" cy="12" r="0.9" fill="white"/>
                {/* Right eye */}
                <circle cx="24" cy="13" r="4.5" fill="white"/>
                <circle cx="24" cy="13" r="2.4" fill="#1B2B1E"/>
                <circle cx="25" cy="12" r="0.9" fill="white"/>
                {/* Smile */}
                <path d="M10 23 Q18 29 26 23" stroke="rgba(255,255,255,0.82)" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Chat modal */}
      {isOpen && (
        <div
          className="chat-modal"
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 1001,
            width: 380, height: 560,
            background: '#fff', borderRadius: 20,
            boxShadow: '0 8px 40px rgba(0,0,0,.18)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            background: '#1B2B1E', padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: '50%',
              background: '#E8621A',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="22" height="18" viewBox="0 0 36 30" fill="none">
                <rect x="3" y="2" width="30" height="24" rx="7" fill="rgba(255,255,255,0.13)"/>
                <rect x="0" y="10" width="3" height="7" rx="1.5" fill="rgba(255,255,255,0.28)"/>
                <rect x="33" y="10" width="3" height="7" rx="1.5" fill="rgba(255,255,255,0.28)"/>
                <circle cx="12" cy="13" r="4.5" fill="white"/>
                <circle cx="12" cy="13" r="2.4" fill="#1B2B1E"/>
                <circle cx="13" cy="12" r="0.9" fill="white"/>
                <circle cx="24" cy="13" r="4.5" fill="white"/>
                <circle cx="24" cy="13" r="2.4" fill="#1B2B1E"/>
                <circle cx="25" cy="12" r="0.9" fill="white"/>
                <path d="M10 23 Q18 29 26 23" stroke="rgba(255,255,255,0.82)" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 700, color: '#fff', fontSize: 15 }}>Menucito</p>
              <p style={{ margin: 0, fontSize: 11, color: '#9DC4AA' }}>Asistente de El Menú</p>
            </div>
            <button
              onClick={() => closeChat()}
              aria-label="Cerrar chat"
              style={{
                width: 30, height: 30, borderRadius: '50%',
                border: 'none', background: 'rgba(255,255,255,.1)',
                color: '#fff', cursor: 'pointer', fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '16px 14px',
            display: 'flex', flexDirection: 'column',
          }}>
            {messages.map(msg => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                onAddProduct={msg.role === 'assistant' ? handleSelectProduct : undefined}
              />
            ))}
            {isLoading && (
              <div style={{ marginBottom: 10 }}>
                <TypingDots />
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '10px 12px', borderTop: '1px solid #E8F1E9',
            display: 'flex', gap: 8, flexShrink: 0,
            background: '#fff',
          }}>
            <input
              type="text"
              placeholder="Escribe tu consulta..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              style={{
                flex: 1, padding: '10px 14px',
                borderRadius: 22, border: '1.5px solid #D5E8D9',
                fontSize: 14, outline: 'none', background: '#F9FDF9',
                color: '#1B2B1E',
              }}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              aria-label="Enviar"
              style={{
                width: 40, height: 40, borderRadius: '50%',
                border: 'none',
                background: isLoading || !input.trim() ? '#D5E8D9' : '#1B2B1E',
                color: isLoading || !input.trim() ? '#9DC4AA' : '#fff',
                cursor: isLoading || !input.trim() ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'background .15s',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
