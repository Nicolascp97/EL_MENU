'use client'
import { create } from 'zustand'

type ChatUIStore = {
  isOpen: boolean
  openChat: () => void
  closeChat: () => void
}

export const useChatStore = create<ChatUIStore>((set) => ({
  isOpen: false,
  openChat: () => set({ isOpen: true }),
  closeChat: () => set({ isOpen: false }),
}))
