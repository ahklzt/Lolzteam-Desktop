import type { AuthStatus } from '@lzt/shared'
import { create } from 'zustand'

interface SessionState {
  status: AuthStatus | null
  setStatus: (status: AuthStatus | null) => void
  refresh: () => Promise<AuthStatus>
  logout: () => Promise<void>
}

export const useSession = create<SessionState>((set) => ({
  status: null,
  setStatus: (status) => set({ status }),
  refresh: async () => {
    const status = await window.moderator.auth.getStatus()
    set({ status })
    return status
  },
  logout: async () => {
    await window.moderator.auth.logout()
  },
}))
