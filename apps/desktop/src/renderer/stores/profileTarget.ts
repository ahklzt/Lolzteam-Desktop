import { create } from 'zustand'

interface ProfileTargetState {
  query: string | null
  nonce: number
  openProfile: (query: string | number) => void
  clear: () => void
}

export const useProfileTarget = create<ProfileTargetState>((set) => ({
  query: null,
  nonce: 0,
  openProfile: (query) =>
    set((state) => ({ query: String(query), nonce: state.nonce + 1 })),
  clear: () => set({ query: null }),
}))
