import type { ModeratorSettings, SettingsSnapshot } from '@lzt/shared'
import { create } from 'zustand'

interface SettingsState {
  snapshot: SettingsSnapshot | null
  setSnapshot: (snapshot: SettingsSnapshot) => void
  patch: (patch: Partial<ModeratorSettings>) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  snapshot: null,
  setSnapshot: (snapshot) => set({ snapshot }),
  patch: async (patch) => {
    const next = await window.moderator.settings.set(patch)
    set({ snapshot: next })
  },
}))
