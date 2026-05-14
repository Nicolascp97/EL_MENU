'use client'
import { useState, useRef, useCallback } from 'react'
import { useChatStore } from './useChatStore'
import type { Product } from '@/types/database'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  displayText?: string   // texto visual en el chat (puede diferir del texto enviado a la API)
  products?: Product[]
  addedToCart?: { product: Product; qty: number }[]
}

type ApiMsg = { role: 'user' | 'assistant'; content: string }

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { isOpen, openChat, closeChat } = useChatStore()
  const msgsRef = useRef<ChatMessage[]>([])

  const sendMessage = useCallback(async (text: string, cartSummary?: string, displayText?: string) => {
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text, displayText }
    const withUser = [...msgsRef.current, userMsg]
    msgsRef.current = withUser
    setMessages(withUser)
    setIsLoading(true)

    // Solo enviamos text a la API, no displayText
    const apiMessages: ApiMsg[] = withUser.map(m => ({ role: m.role, content: m.text }))

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, cartSummary }),
      })
      if (!res.ok) throw new Error('Error de red')
      const data = await res.json()

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: data.message ?? 'Sin respuesta',
        products: data.products,
        addedToCart: data.addedToCart,
      }
      const withAssistant = [...msgsRef.current, assistantMsg]
      msgsRef.current = withAssistant
      setMessages(withAssistant)
    } catch {
      const errMsg: ChatMessage = {
        id: `e-${Date.now()}`,
        role: 'assistant',
        text: 'Tuve un problema al conectarme. Intenta de nuevo 🙏',
      }
      const withErr = [...msgsRef.current, errMsg]
      msgsRef.current = withErr
      setMessages(withErr)
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { messages, setMessages, isLoading, isOpen, openChat, closeChat, sendMessage }
}
