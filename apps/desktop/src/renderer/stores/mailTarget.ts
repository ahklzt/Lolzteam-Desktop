import { create } from 'zustand'

interface MailTargetState {
  pending: string | null
  openNonce: number
  setPending: (value: string | null) => void
  requestOpen: () => void
}

export const useMailTarget = create<MailTargetState>((set) => ({
  pending: null,
  openNonce: 0,
  setPending: (pending) => set({ pending }),
  requestOpen: () => set((state) => ({ openNonce: state.openNonce + 1 })),
}))
