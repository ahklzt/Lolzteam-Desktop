import { create } from 'zustand'

interface MailTargetState {
  pending: string | null
  setPending: (value: string | null) => void
}

export const useMailTarget = create<MailTargetState>((set) => ({
  pending: null,
  setPending: (pending) => set({ pending }),
}))
