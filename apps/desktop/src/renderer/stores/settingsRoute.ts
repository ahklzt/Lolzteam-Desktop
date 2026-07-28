import { create } from 'zustand'
import type { SettingsTab } from '~/features/settings/SettingsView'

interface SettingsRouteState {
  tab: SettingsTab | null
  nonce: number
  open: (tab: SettingsTab) => void
  clear: () => void
}

export const useSettingsRoute = create<SettingsRouteState>((set) => ({
  tab: null,
  nonce: 0,
  open: (tab) => set((state) => ({ tab, nonce: state.nonce + 1 })),
  clear: () => set({ tab: null }),
}))
