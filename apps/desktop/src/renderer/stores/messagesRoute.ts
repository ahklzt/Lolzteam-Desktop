import { create } from 'zustand'

interface MessagesRouteState {
  selectedId: number | null
  nonce: number
  select: (conversationId: number | null) => void
}

export const useMessagesRoute = create<MessagesRouteState>((set) => ({
  selectedId: null,
  nonce: 0,
  select: (conversationId) =>
    set((state) => ({ selectedId: conversationId, nonce: state.nonce + 1 })),
}))
